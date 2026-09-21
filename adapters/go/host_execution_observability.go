package flexdoc

import (
	"math"
	"math/rand"
	"sort"
	"sync"
	"time"
)

// This mirrors the Node and Python contract deliberately: the same reason
// vocabulary, the same metric names and labels, and the same export schema. An
// operator running a mixed fleet should read one document shape regardless of
// which runtime served the execute route, and a collector written for one
// runtime should not need a second parser for another.

// HostExecutionReason is a stable low-cardinality category for a non-successful execution.
//
// Rejection messages interpolate request values such as origins, field names
// and methods, so they are unbounded and cannot be used as a metric label.
// These can.
type HostExecutionReason string

// Stable reason categories shared with every other FlexDoc runtime.
const (
	ReasonMarkerMissing        HostExecutionReason = "marker-missing"
	ReasonExecutionDisabled    HostExecutionReason = "execution-disabled"
	ReasonAdmissionSaturated   HostExecutionReason = "admission-saturated"
	ReasonDestinationForbidden HostExecutionReason = "destination-forbidden"
	ReasonRedirectForbidden    HostExecutionReason = "redirect-forbidden"
	ReasonBodyMalformed        HostExecutionReason = "body-malformed"
	ReasonBodyTooLarge         HostExecutionReason = "body-too-large"
	ReasonUnsupportedMediaType HostExecutionReason = "unsupported-media-type"
	ReasonRequestInvalid       HostExecutionReason = "request-invalid"
	ReasonAuthUnsupported      HostExecutionReason = "auth-unsupported"
	ReasonUpstreamTimeout      HostExecutionReason = "upstream-timeout"
	ReasonUpstreamUnreachable  HostExecutionReason = "upstream-unreachable"
	ReasonUpstreamError        HostExecutionReason = "upstream-error"
)

// ObservationSchema identifies the operator export document shared across runtimes.
const ObservationSchema = "flexdoc.host-execution.observation/1"

var hostExecutionReasons = []HostExecutionReason{
	ReasonMarkerMissing, ReasonExecutionDisabled, ReasonAdmissionSaturated,
	ReasonDestinationForbidden, ReasonRedirectForbidden, ReasonBodyMalformed,
	ReasonBodyTooLarge, ReasonUnsupportedMediaType, ReasonRequestInvalid,
	ReasonAuthUnsupported, ReasonUpstreamTimeout, ReasonUpstreamUnreachable,
	ReasonUpstreamError,
}

// observationGaps names evidence an API host cannot observe by itself.
var observationGaps = []string{"browser-direct-transport-mix"}

// HostExecutionReasons returns the stable reason categories in contract order.
func HostExecutionReasons() []HostExecutionReason {
	out := make([]HostExecutionReason, len(hostExecutionReasons))
	copy(out, hostExecutionReasons)
	return out
}

// IsHostExecutionReason reports whether a value is one of the stable categories.
func IsHostExecutionReason(value string) bool {
	for _, reason := range hostExecutionReasons {
		if string(reason) == value {
			return true
		}
	}
	return false
}

// HostExecutionMetric is one dependency-free metric update that can be bridged
// to Prometheus or OpenTelemetry without FlexDoc owning a registry.
type HostExecutionMetric struct {
	Name   string
	Kind   string
	Value  float64
	Labels map[string]string
}

// MetricSink receives metric updates. Delivery is best effort: a sink that
// panics cannot fail an execution.
type MetricSink func(HostExecutionMetric)

// HostExecutionDurations is the duration distribution for one observation window.
type HostExecutionDurations struct {
	SampleCount int     `json:"sampleCount"`
	Sampled     bool    `json:"sampled"`
	MinMs       float64 `json:"minMs"`
	P50Ms       float64 `json:"p50Ms"`
	P95Ms       float64 `json:"p95Ms"`
	P99Ms       float64 `json:"p99Ms"`
	MaxMs       float64 `json:"maxMs"`
}

// HostExecutionSnapshot is the aggregate for one observation window.
type HostExecutionSnapshot struct {
	WindowStart         *string                 `json:"windowStart"`
	WindowEnd           *string                 `json:"windowEnd"`
	StartedExecutions   int                     `json:"startedExecutions"`
	UnmarkedRequests    int                     `json:"unmarkedRequests"`
	CompletedExecutions int                     `json:"completedExecutions"`
	Outcomes            map[string]int          `json:"outcomes"`
	InFlight            int                     `json:"inFlight"`
	PeakInFlight        int                     `json:"peakInFlight"`
	RejectionsByReason  map[string]int          `json:"rejectionsByReason"`
	ErrorsByReason      map[string]int          `json:"errorsByReason"`
	Durations           *HostExecutionDurations `json:"durations"`
}

// HostExecutionObservationReport is the operator export document.
type HostExecutionObservationReport struct {
	Schema      string                `json:"schema"`
	GeneratedAt string                `json:"generatedAt"`
	Runtime     string                `json:"runtime"`
	Observation HostExecutionSnapshot `json:"observation"`
	Gaps        []string              `json:"gaps"`
}

// HostExecutionObservation aggregates execution evidence for one window.
//
// Only counters and durations are retained. No URL, header, body, credential or
// per-request timestamp reaches this recorder, so the aggregate cannot carry
// request content by construction.
//
// Durations are retained up to the sample capacity and then replaced by
// reservoir sampling, so memory stays bounded for a host that runs indefinitely
// while percentiles stay representative of the whole window rather than only
// its opening. Counts stay exact regardless.
type HostExecutionObservation struct {
	mu                sync.Mutex
	capacity          int
	now               func() time.Time
	random            func() float64
	windowStart       *time.Time
	windowEnd         *time.Time
	started           int
	unmarked          int
	completed         int
	inFlight          int
	peakInFlight      int
	observedDurations int
	outcomes          map[string]int
	rejections        map[string]int
	errors            map[string]int
	durations         []float64
}

// NewHostExecutionObservation creates a recorder with the default 8192-sample capacity.
func NewHostExecutionObservation() *HostExecutionObservation {
	return NewHostExecutionObservationWithCapacity(8192)
}

// NewHostExecutionObservationWithCapacity creates a recorder retaining at most
// capacity durations before uniform sampling begins.
func NewHostExecutionObservationWithCapacity(capacity int) *HostExecutionObservation {
	if capacity < 1 {
		capacity = 1
	}
	observation := &HostExecutionObservation{
		capacity: capacity,
		now:      time.Now,
		random:   rand.Float64,
	}
	observation.Reset()
	return observation
}

// Reset discards all counts and starts a new window.
func (o *HostExecutionObservation) Reset() {
	o.mu.Lock()
	defer o.mu.Unlock()
	o.windowStart = nil
	o.windowEnd = nil
	o.started = 0
	o.unmarked = 0
	o.completed = 0
	o.inFlight = 0
	o.peakInFlight = 0
	o.observedDurations = 0
	o.outcomes = map[string]int{"success": 0, "rejected": 0, "error": 0}
	o.rejections = map[string]int{}
	o.errors = map[string]int{}
	o.durations = nil
}

// Record folds one metric update into the aggregate. It is safe to use as a
// MetricSink from concurrent request handlers.
func (o *HostExecutionObservation) Record(metric HostExecutionMetric) {
	o.mu.Lock()
	defer o.mu.Unlock()

	timestamp := o.now()
	if o.windowStart == nil {
		start := timestamp
		o.windowStart = &start
	}
	end := timestamp
	o.windowEnd = &end

	switch metric.Name {
	case "flexdoc_execute_requests_total":
		o.started++
	case "flexdoc_execute_in_flight":
		o.inFlight += int(metric.Value)
		if o.inFlight < 0 {
			o.inFlight = 0
		}
		if o.inFlight > o.peakInFlight {
			o.peakInFlight = o.inFlight
		}
	case "flexdoc_execute_completions_total":
		o.completed++
		if _, known := o.outcomes[metric.Labels["outcome"]]; known {
			o.outcomes[metric.Labels["outcome"]]++
		}
	case "flexdoc_execute_rejections_total":
		o.tally(o.rejections, metric.Labels["reason"])
	case "flexdoc_execute_unmarked_total":
		// Deliberately not folded into rejections: those describe validated
		// envelopes, and merging the two would double-count attempts.
		o.unmarked++
	case "flexdoc_execute_errors_total":
		o.tally(o.errors, metric.Labels["reason"])
	case "flexdoc_execute_duration_seconds":
		o.recordDuration(metric.Value)
	}
}

// Snapshot returns the current aggregate; safe to call at any time.
func (o *HostExecutionObservation) Snapshot() HostExecutionSnapshot {
	o.mu.Lock()
	defer o.mu.Unlock()

	snapshot := HostExecutionSnapshot{
		WindowStart:         formatInstant(o.windowStart),
		WindowEnd:           formatInstant(o.windowEnd),
		StartedExecutions:   o.started,
		UnmarkedRequests:    o.unmarked,
		CompletedExecutions: o.completed,
		Outcomes:            copyCounts(o.outcomes),
		InFlight:            o.inFlight,
		PeakInFlight:        o.peakInFlight,
		RejectionsByReason:  copyCounts(o.rejections),
		ErrorsByReason:      copyCounts(o.errors),
	}
	if len(o.durations) == 0 {
		return snapshot
	}

	ordered := make([]float64, len(o.durations))
	copy(ordered, o.durations)
	sort.Float64s(ordered)
	snapshot.Durations = &HostExecutionDurations{
		SampleCount: len(ordered),
		Sampled:     o.observedDurations > len(ordered),
		MinMs:       ordered[0],
		P50Ms:       percentile(ordered, 0.5),
		P95Ms:       percentile(ordered, 0.95),
		P99Ms:       percentile(ordered, 0.99),
		MaxMs:       ordered[len(ordered)-1],
	}
	return snapshot
}

// NewHostExecutionObservationReport builds the operator export document.
//
// The document is aggregate-only and is meant to be written to disk or handed
// to an operator; FlexDoc never transmits it. Browser-direct executions never
// reach an API host, so the transport mix cannot be derived here, and that gap
// is declared so a review cannot mistake this document for complete evidence.
func NewHostExecutionObservationReport(observation *HostExecutionObservation) HostExecutionObservationReport {
	gaps := make([]string, len(observationGaps))
	copy(gaps, observationGaps)
	return HostExecutionObservationReport{
		Schema:      ObservationSchema,
		GeneratedAt: time.Now().UTC().Format(time.RFC3339Nano),
		Runtime:     "go",
		Observation: observation.Snapshot(),
		Gaps:        gaps,
	}
}

func (o *HostExecutionObservation) tally(counts map[string]int, reason string) {
	if IsHostExecutionReason(reason) {
		counts[reason]++
	}
}

func (o *HostExecutionObservation) recordDuration(seconds float64) {
	milliseconds := math.Max(0, seconds*1000)
	o.observedDurations++
	if len(o.durations) < o.capacity {
		o.durations = append(o.durations, milliseconds)
		return
	}
	candidate := int(o.random() * float64(o.observedDurations))
	if candidate < o.capacity {
		o.durations[candidate] = milliseconds
	}
}

func copyCounts(counts map[string]int) map[string]int {
	out := make(map[string]int, len(counts))
	for key, value := range counts {
		out[key] = value
	}
	return out
}

func formatInstant(instant *time.Time) *string {
	if instant == nil {
		return nil
	}
	formatted := instant.UTC().Format(time.RFC3339Nano)
	return &formatted
}

func percentile(sorted []float64, fraction float64) float64 {
	if len(sorted) == 1 {
		return sorted[0]
	}
	rank := int(math.Ceil(fraction * float64(len(sorted))))
	if rank < 1 {
		rank = 1
	}
	if rank > len(sorted) {
		rank = len(sorted)
	}
	return sorted[rank-1]
}
