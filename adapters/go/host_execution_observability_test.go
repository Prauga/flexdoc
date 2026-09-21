package flexdoc

import (
	"encoding/json"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

// The reason vocabulary is a cross-runtime contract, not a Go detail: a collector
// written against the Node or Python host must read these labels unchanged.
func TestHostExecutionReasonsMatchTheSharedVocabulary(t *testing.T) {
	expected := []string{
		"marker-missing", "execution-disabled", "admission-saturated",
		"destination-forbidden", "redirect-forbidden", "body-malformed",
		"body-too-large", "unsupported-media-type", "request-invalid",
		"auth-unsupported", "upstream-timeout", "upstream-unreachable",
		"upstream-error",
	}
	reasons := HostExecutionReasons()
	if len(reasons) != len(expected) {
		t.Fatalf("expected %d reasons, got %d", len(expected), len(reasons))
	}
	for i, reason := range reasons {
		if string(reason) != expected[i] {
			t.Fatalf("reason %d: expected %q, got %q", i, expected[i], reason)
		}
	}
	if !IsHostExecutionReason("upstream-timeout") {
		t.Fatal("expected upstream-timeout to be a known reason")
	}
	if IsHostExecutionReason("slow") {
		t.Fatal("expected an unknown reason to be rejected")
	}
}

func collectMetrics(t *testing.T) (*HostExecution, *[]HostExecutionMetric) {
	t.Helper()
	collected := []HostExecutionMetric{}
	executor, err := NewHostExecution(
		[]string{"https://api.example.test"},
		WithMetricSink(func(metric HostExecutionMetric) {
			collected = append(collected, metric)
		}),
	)
	if err != nil {
		t.Fatalf("executor: %v", err)
	}
	return executor, &collected
}

func names(metrics []HostExecutionMetric) []string {
	out := make([]string, 0, len(metrics))
	for _, metric := range metrics {
		out = append(out, metric.Name)
	}
	return out
}

func findMetric(metrics []HostExecutionMetric, name string) (HostExecutionMetric, bool) {
	for _, metric := range metrics {
		if metric.Name == name {
			return metric, true
		}
	}
	return HostExecutionMetric{}, false
}

func TestUnmarkedRequestIsCountedOutsideTheLifecycle(t *testing.T) {
	executor, collected := collectMetrics(t)
	executor.Handle("", map[string]any{}, nil)

	if len(*collected) != 1 {
		t.Fatalf("expected exactly one metric, got %v", names(*collected))
	}
	metric := (*collected)[0]
	if metric.Name != "flexdoc_execute_unmarked_total" {
		t.Fatalf("expected the unmarked counter, got %q", metric.Name)
	}
	if metric.Labels["reason"] != "marker-missing" {
		t.Fatalf("expected marker-missing, got %q", metric.Labels["reason"])
	}
}

func TestPolicyRejectionCarriesItsReason(t *testing.T) {
	executor, collected := collectMetrics(t)
	result := executor.Handle("1", map[string]any{
		"request": map[string]any{"url": "https://blocked.example.test/pets", "method": "GET"},
	}, nil)

	if result.Status != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", result.Status)
	}
	rejection, ok := findMetric(*collected, "flexdoc_execute_rejections_total")
	if !ok {
		t.Fatalf("expected a rejection counter, got %v", names(*collected))
	}
	if rejection.Labels["reason"] != "destination-forbidden" {
		t.Fatalf("expected destination-forbidden, got %q", rejection.Labels["reason"])
	}
	if rejection.Labels["statusCode"] != "403" || rejection.Labels["source"] != "route" {
		t.Fatalf("unexpected rejection labels: %v", rejection.Labels)
	}
	if _, errored := findMetric(*collected, "flexdoc_execute_errors_total"); errored {
		t.Fatal("a policy rejection must not also count as an upstream error")
	}
}

func TestMalformedEnvelopeIsSeparableFromAPolicyRejection(t *testing.T) {
	executor, collected := collectMetrics(t)
	executor.Handle("1", nil, nil)

	rejection, ok := findMetric(*collected, "flexdoc_execute_rejections_total")
	if !ok {
		t.Fatalf("expected a rejection counter, got %v", names(*collected))
	}
	if rejection.Labels["reason"] != "body-malformed" {
		t.Fatalf("expected body-malformed, got %q", rejection.Labels["reason"])
	}
}

func TestUnreachableTargetIsAnUpstreamFailureNotARejection(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listener: %v", err)
	}
	address := listener.Addr().String()
	// Close immediately so the port is almost certainly refused rather than open.
	_ = listener.Close()

	collected := []HostExecutionMetric{}
	executor, err := NewHostExecution(
		[]string{"http://" + address},
		WithMetricSink(func(metric HostExecutionMetric) { collected = append(collected, metric) }),
	)
	if err != nil {
		t.Fatalf("executor: %v", err)
	}
	result := executor.Handle("1", map[string]any{
		"request": map[string]any{"url": "http://" + address + "/pets", "method": "GET"},
	}, nil)

	if result.Status != http.StatusBadGateway {
		t.Fatalf("expected 502, got %d", result.Status)
	}
	failure, ok := findMetric(collected, "flexdoc_execute_errors_total")
	if !ok {
		t.Fatalf("expected an error counter, got %v", names(collected))
	}
	if failure.Labels["reason"] != "upstream-unreachable" {
		t.Fatalf("expected upstream-unreachable, got %q", failure.Labels["reason"])
	}
	if _, rejected := findMetric(collected, "flexdoc_execute_rejections_total"); rejected {
		t.Fatal("an upstream failure must not be counted as a policy rejection")
	}
}

func TestSuccessfulExecutionEmitsTheLifecyclePair(t *testing.T) {
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"ok":true}`))
	}))
	defer target.Close()

	collected := []HostExecutionMetric{}
	executor, err := NewHostExecution(
		[]string{target.URL},
		WithMetricSink(func(metric HostExecutionMetric) { collected = append(collected, metric) }),
	)
	if err != nil {
		t.Fatalf("executor: %v", err)
	}
	result := executor.Handle("1", map[string]any{
		"request": map[string]any{"url": target.URL + "/pets", "method": "GET"},
	}, nil)
	if result.Status != http.StatusOK {
		t.Fatalf("expected 200, got %d: %v", result.Status, result.Body)
	}

	if _, ok := findMetric(collected, "flexdoc_execute_requests_total"); !ok {
		t.Fatalf("expected a requests counter, got %v", names(collected))
	}
	completion, ok := findMetric(collected, "flexdoc_execute_completions_total")
	if !ok || completion.Labels["outcome"] != "success" {
		t.Fatalf("expected a successful completion, got %v", names(collected))
	}
	if _, ok := findMetric(collected, "flexdoc_execute_duration_seconds"); !ok {
		t.Fatal("expected a duration observation")
	}

	// The gauge must return to zero, or in-flight drifts upward forever.
	var gauge float64
	for _, metric := range collected {
		if metric.Name == "flexdoc_execute_in_flight" {
			gauge += metric.Value
		}
	}
	if gauge != 0 {
		t.Fatalf("expected the in-flight gauge to balance, got %v", gauge)
	}
}

func TestAFailingSinkCannotFailAnExecution(t *testing.T) {
	executor, err := NewHostExecution(
		[]string{"https://api.example.test"},
		WithMetricSink(func(HostExecutionMetric) { panic("collector down") }),
	)
	if err != nil {
		t.Fatalf("executor: %v", err)
	}
	result := executor.Handle("1", map[string]any{
		"request": map[string]any{"url": "https://blocked.example.test/pets", "method": "GET"},
	}, nil)
	if result.Status != http.StatusForbidden {
		t.Fatalf("expected the execution outcome to survive a panicking sink, got %d", result.Status)
	}
}

func TestNoMetricsWithoutASink(t *testing.T) {
	executor, err := NewHostExecution([]string{"https://api.example.test"})
	if err != nil {
		t.Fatalf("executor: %v", err)
	}
	// Nothing to assert beyond not panicking: an executor without a sink must
	// behave exactly as it did before evidence existed.
	if result := executor.Handle("", map[string]any{}, nil); result.Status != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", result.Status)
	}
}

func recorderWithClock() (*HostExecutionObservation, *time.Time) {
	instant := time.Date(2026, 9, 21, 8, 0, 0, 0, time.UTC)
	observation := NewHostExecutionObservation()
	observation.now = func() time.Time { return instant }
	return observation, &instant
}

func TestObservationAggregatesByOutcomeAndReason(t *testing.T) {
	observation, _ := recorderWithClock()
	observation.Record(HostExecutionMetric{Name: "flexdoc_execute_requests_total", Kind: "counter", Value: 1})
	observation.Record(HostExecutionMetric{Name: "flexdoc_execute_in_flight", Kind: "gauge", Value: 1})
	observation.Record(HostExecutionMetric{Name: "flexdoc_execute_in_flight", Kind: "gauge", Value: 1})
	observation.Record(HostExecutionMetric{Name: "flexdoc_execute_in_flight", Kind: "gauge", Value: -1})
	observation.Record(HostExecutionMetric{Name: "flexdoc_execute_completions_total", Kind: "counter", Value: 1, Labels: map[string]string{"outcome": "rejected"}})
	observation.Record(HostExecutionMetric{Name: "flexdoc_execute_rejections_total", Kind: "counter", Value: 1, Labels: map[string]string{"reason": "destination-forbidden"}})
	observation.Record(HostExecutionMetric{Name: "flexdoc_execute_errors_total", Kind: "counter", Value: 1, Labels: map[string]string{"reason": "upstream-timeout"}})
	observation.Record(HostExecutionMetric{Name: "flexdoc_execute_unmarked_total", Kind: "counter", Value: 1, Labels: map[string]string{"reason": "marker-missing"}})
	observation.Record(HostExecutionMetric{Name: "flexdoc_execute_errors_total", Kind: "counter", Value: 1, Labels: map[string]string{"reason": "not-a-reason"}})

	snapshot := observation.Snapshot()
	if snapshot.StartedExecutions != 1 || snapshot.CompletedExecutions != 1 {
		t.Fatalf("unexpected counts: %+v", snapshot)
	}
	if snapshot.Outcomes["rejected"] != 1 || snapshot.Outcomes["success"] != 0 {
		t.Fatalf("unexpected outcomes: %v", snapshot.Outcomes)
	}
	if snapshot.InFlight != 1 || snapshot.PeakInFlight != 2 {
		t.Fatalf("expected peak concurrency 2 with 1 still running, got %d/%d", snapshot.InFlight, snapshot.PeakInFlight)
	}
	if snapshot.RejectionsByReason["destination-forbidden"] != 1 {
		t.Fatalf("unexpected rejections: %v", snapshot.RejectionsByReason)
	}
	if snapshot.ErrorsByReason["upstream-timeout"] != 1 || len(snapshot.ErrorsByReason) != 1 {
		t.Fatalf("an unknown reason must not be tallied: %v", snapshot.ErrorsByReason)
	}
	if snapshot.UnmarkedRequests != 1 {
		t.Fatalf("expected the unmarked count to stay separate, got %d", snapshot.UnmarkedRequests)
	}
	if snapshot.Durations != nil {
		t.Fatal("expected no duration summary before the first completion duration")
	}
}

func TestObservationReportsExactPercentiles(t *testing.T) {
	observation, _ := recorderWithClock()
	for i := 1; i <= 100; i++ {
		observation.Record(HostExecutionMetric{
			Name:   "flexdoc_execute_duration_seconds",
			Kind:   "histogram",
			Value:  float64(i) / 1000,
			Labels: map[string]string{"outcome": "success"},
		})
	}
	durations := observation.Snapshot().Durations
	if durations == nil {
		t.Fatal("expected a duration summary")
	}
	if durations.Sampled {
		t.Fatal("100 observations fit under the capacity and must not be reported as sampled")
	}
	if durations.MinMs != 1 || durations.MaxMs != 100 || durations.P50Ms != 50 || durations.P95Ms != 95 || durations.P99Ms != 99 {
		t.Fatalf("unexpected percentiles: %+v", durations)
	}
}

func TestObservationBoundsMemoryBySampling(t *testing.T) {
	observation := NewHostExecutionObservationWithCapacity(16)
	observation.now = func() time.Time { return time.Unix(0, 0).UTC() }
	for i := 0; i < 500; i++ {
		observation.Record(HostExecutionMetric{Name: "flexdoc_execute_duration_seconds", Kind: "histogram", Value: 0.05})
	}
	durations := observation.Snapshot().Durations
	if durations.SampleCount != 16 {
		t.Fatalf("expected the capacity to bound retention, got %d", durations.SampleCount)
	}
	if !durations.Sampled {
		t.Fatal("expected sampling to be declared once observations exceed capacity")
	}
}

func TestObservationResetStartsANewWindow(t *testing.T) {
	observation, _ := recorderWithClock()
	observation.Record(HostExecutionMetric{Name: "flexdoc_execute_requests_total", Kind: "counter", Value: 1})
	observation.Reset()

	snapshot := observation.Snapshot()
	if snapshot.StartedExecutions != 0 || snapshot.WindowStart != nil {
		t.Fatalf("expected a cleared window, got %+v", snapshot)
	}
}

// The export is handed to operators and may be written to disk, so it must carry
// no request content: only counts, timestamps and known category names.
func TestReportCarriesNoRequestContent(t *testing.T) {
	observation, _ := recorderWithClock()
	observation.Record(HostExecutionMetric{Name: "flexdoc_execute_requests_total", Kind: "counter", Value: 1})
	observation.Record(HostExecutionMetric{
		Name:   "flexdoc_execute_rejections_total",
		Kind:   "counter",
		Value:  1,
		Labels: map[string]string{"reason": "destination-forbidden", "target": "https://secret.internal/pets?token=abc"},
	})
	observation.Record(HostExecutionMetric{Name: "flexdoc_execute_duration_seconds", Kind: "histogram", Value: 0.25})

	report := NewHostExecutionObservationReport(observation)
	if report.Schema != "flexdoc.host-execution.observation/1" {
		t.Fatalf("unexpected schema: %q", report.Schema)
	}
	if report.Runtime != "go" {
		t.Fatalf("expected the runtime to identify itself, got %q", report.Runtime)
	}
	if len(report.Gaps) != 1 || report.Gaps[0] != "browser-direct-transport-mix" {
		t.Fatalf("expected the declared transport-mix gap, got %v", report.Gaps)
	}

	encoded, err := json.Marshal(report)
	if err != nil {
		t.Fatalf("report must be serializable: %v", err)
	}
	for _, leaked := range []string{"secret.internal", "token=abc", "/pets"} {
		if strings.Contains(string(encoded), leaked) {
			t.Fatalf("report leaked request content %q: %s", leaked, encoded)
		}
	}
}
