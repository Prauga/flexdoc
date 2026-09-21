//! Execution evidence for the Rust host executor.
//!
//! This mirrors the Node, Python and Go contract deliberately: the same reason
//! vocabulary, the same metric names and labels, and the same export schema. An
//! operator running a mixed fleet should read one document shape regardless of
//! which runtime served the execute route, and a collector written for one
//! runtime should not need a second parser for another.

use serde_json::{json, Map, Value};
use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
    time::{Duration, SystemTime, UNIX_EPOCH},
};

/// Operator export document schema shared by every FlexDoc runtime.
pub const OBSERVATION_SCHEMA: &str = "flexdoc.host-execution.observation/1";

/// Evidence an API host cannot observe by itself, declared rather than omitted.
pub const OBSERVATION_GAPS: &[&str] = &["browser-direct-transport-mix"];

/// Stable low-cardinality categories for a non-successful execution.
///
/// Rejection messages interpolate request values such as origins, field names
/// and methods, so they are unbounded and cannot be used as a metric label.
/// These can.
pub const HOST_EXECUTION_REASONS: &[&str] = &[
    "marker-missing",
    "execution-disabled",
    "admission-saturated",
    "destination-forbidden",
    "redirect-forbidden",
    "body-malformed",
    "body-too-large",
    "unsupported-media-type",
    "request-invalid",
    "auth-unsupported",
    "upstream-timeout",
    "upstream-unreachable",
    "upstream-error",
];

/// One stable reason category.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum HostExecutionReason {
    MarkerMissing,
    ExecutionDisabled,
    AdmissionSaturated,
    DestinationForbidden,
    RedirectForbidden,
    BodyMalformed,
    BodyTooLarge,
    UnsupportedMediaType,
    RequestInvalid,
    AuthUnsupported,
    UpstreamTimeout,
    UpstreamUnreachable,
    UpstreamError,
}

impl HostExecutionReason {
    /// Label value used in metrics and exports.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::MarkerMissing => "marker-missing",
            Self::ExecutionDisabled => "execution-disabled",
            Self::AdmissionSaturated => "admission-saturated",
            Self::DestinationForbidden => "destination-forbidden",
            Self::RedirectForbidden => "redirect-forbidden",
            Self::BodyMalformed => "body-malformed",
            Self::BodyTooLarge => "body-too-large",
            Self::UnsupportedMediaType => "unsupported-media-type",
            Self::RequestInvalid => "request-invalid",
            Self::AuthUnsupported => "auth-unsupported",
            Self::UpstreamTimeout => "upstream-timeout",
            Self::UpstreamUnreachable => "upstream-unreachable",
            Self::UpstreamError => "upstream-error",
        }
    }
}

/// Whether a value is one of the stable reason categories.
pub fn is_host_execution_reason(value: &str) -> bool {
    HOST_EXECUTION_REASONS.contains(&value)
}

/// Metric kind, kept as a closed set so a bridge can map it without guessing.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum MetricKind {
    Counter,
    Gauge,
    Histogram,
}

impl MetricKind {
    /// Kind name matching the other runtimes.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Counter => "counter",
            Self::Gauge => "gauge",
            Self::Histogram => "histogram",
        }
    }
}

/// One dependency-free metric update that can be bridged to Prometheus or
/// OpenTelemetry without FlexDoc owning a registry.
#[derive(Clone, Debug)]
pub struct HostExecutionMetric {
    pub name: &'static str,
    pub kind: MetricKind,
    pub value: f64,
    pub labels: HashMap<&'static str, String>,
}

/// Sink receiving metric updates. Delivery is best effort: a sink that panics
/// cannot fail an execution.
pub type MetricSink = Arc<dyn Fn(HostExecutionMetric) + Send + Sync>;

/// Duration distribution for one observation window, in milliseconds.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct DurationSummary {
    pub sample_count: usize,
    pub sampled: bool,
    pub min_ms: f64,
    pub p50_ms: f64,
    pub p95_ms: f64,
    pub p99_ms: f64,
    pub max_ms: f64,
}

/// Aggregate for one observation window.
#[derive(Clone, Debug, Default)]
pub struct ObservationSnapshot {
    pub window_start: Option<String>,
    pub window_end: Option<String>,
    pub started_executions: u64,
    pub unmarked_requests: u64,
    pub completed_executions: u64,
    pub successes: u64,
    pub rejections: u64,
    pub errors: u64,
    pub in_flight: u64,
    pub peak_in_flight: u64,
    pub rejections_by_reason: HashMap<&'static str, u64>,
    pub errors_by_reason: HashMap<&'static str, u64>,
    pub durations: Option<DurationSummary>,
}

impl ObservationSnapshot {
    /// Serialize the aggregate using the shared field names.
    pub fn to_json(&self) -> Value {
        json!({
            "windowStart": self.window_start,
            "windowEnd": self.window_end,
            "startedExecutions": self.started_executions,
            "unmarkedRequests": self.unmarked_requests,
            "completedExecutions": self.completed_executions,
            "outcomes": {
                "success": self.successes,
                "rejected": self.rejections,
                "error": self.errors,
            },
            "inFlight": self.in_flight,
            "peakInFlight": self.peak_in_flight,
            "rejectionsByReason": counts_to_json(&self.rejections_by_reason),
            "errorsByReason": counts_to_json(&self.errors_by_reason),
            "durations": self.durations.map(|durations| json!({
                "sampleCount": durations.sample_count,
                "sampled": durations.sampled,
                "minMs": durations.min_ms,
                "p50Ms": durations.p50_ms,
                "p95Ms": durations.p95_ms,
                "p99Ms": durations.p99_ms,
                "maxMs": durations.max_ms,
            })),
        })
    }
}

#[derive(Default)]
struct ObservationState {
    window_start: Option<Duration>,
    window_end: Option<Duration>,
    started: u64,
    unmarked: u64,
    completed: u64,
    successes: u64,
    rejections: u64,
    errors: u64,
    in_flight: i64,
    peak_in_flight: i64,
    observed_durations: u64,
    rejections_by_reason: HashMap<&'static str, u64>,
    errors_by_reason: HashMap<&'static str, u64>,
    durations: Vec<f64>,
}

/// Aggregates host-execution evidence for one window, free of request content.
///
/// Only counters and durations are retained. No URL, header, body, credential or
/// per-request timestamp reaches this recorder, so the aggregate cannot carry
/// request content by construction.
///
/// Durations are retained up to the sample capacity and then replaced by
/// reservoir sampling, so memory stays bounded for a host that runs indefinitely
/// while percentiles stay representative of the whole window rather than only
/// its opening. Counts stay exact regardless.
#[derive(Clone)]
pub struct HostExecutionObservation {
    capacity: usize,
    state: Arc<Mutex<ObservationState>>,
}

impl Default for HostExecutionObservation {
    fn default() -> Self {
        Self::new()
    }
}

impl HostExecutionObservation {
    /// Create a recorder with the default 8192-sample capacity.
    pub fn new() -> Self {
        Self::with_capacity(8192)
    }

    /// Create a recorder retaining at most `capacity` durations before uniform
    /// sampling begins.
    pub fn with_capacity(capacity: usize) -> Self {
        Self {
            capacity: capacity.max(1),
            state: Arc::new(Mutex::new(ObservationState::default())),
        }
    }

    /// Fold one metric update into the aggregate. Cloning the recorder shares
    /// the same window, so it can be the sink for concurrent handlers.
    pub fn record(&self, metric: HostExecutionMetric) {
        let Ok(mut state) = self.state.lock() else {
            // A poisoned lock means another thread panicked mid-update. Evidence
            // is not worth propagating that panic into an execution.
            return;
        };
        let timestamp = unix_now();
        if state.window_start.is_none() {
            state.window_start = Some(timestamp);
        }
        state.window_end = Some(timestamp);

        match metric.name {
            "flexdoc_execute_requests_total" => state.started += 1,
            "flexdoc_execute_in_flight" => {
                state.in_flight = (state.in_flight + metric.value as i64).max(0);
                state.peak_in_flight = state.peak_in_flight.max(state.in_flight);
            }
            "flexdoc_execute_completions_total" => {
                state.completed += 1;
                match metric.labels.get("outcome").map(String::as_str) {
                    Some("success") => state.successes += 1,
                    Some("rejected") => state.rejections += 1,
                    Some("error") => state.errors += 1,
                    _ => {}
                }
            }
            "flexdoc_execute_rejections_total" => {
                tally(&mut state.rejections_by_reason, metric.labels.get("reason"));
            }
            // Deliberately not folded into rejections: those describe validated
            // envelopes, and merging the two would double-count attempts.
            "flexdoc_execute_unmarked_total" => state.unmarked += 1,
            "flexdoc_execute_errors_total" => {
                tally(&mut state.errors_by_reason, metric.labels.get("reason"));
            }
            "flexdoc_execute_duration_seconds" => {
                let milliseconds = (metric.value * 1000.0).max(0.0);
                state.observed_durations += 1;
                if state.durations.len() < self.capacity {
                    state.durations.push(milliseconds);
                } else {
                    let candidate = (pseudo_random() * state.observed_durations as f64) as usize;
                    if candidate < self.capacity {
                        state.durations[candidate] = milliseconds;
                    }
                }
            }
            _ => {}
        }
    }

    /// Return the current aggregate; safe to call at any time.
    pub fn snapshot(&self) -> ObservationSnapshot {
        let Ok(state) = self.state.lock() else {
            return ObservationSnapshot::default();
        };
        let mut ordered = state.durations.clone();
        ordered.sort_by(|left, right| left.total_cmp(right));

        ObservationSnapshot {
            window_start: state.window_start.map(format_instant),
            window_end: state.window_end.map(format_instant),
            started_executions: state.started,
            unmarked_requests: state.unmarked,
            completed_executions: state.completed,
            successes: state.successes,
            rejections: state.rejections,
            errors: state.errors,
            in_flight: state.in_flight.max(0) as u64,
            peak_in_flight: state.peak_in_flight.max(0) as u64,
            rejections_by_reason: state.rejections_by_reason.clone(),
            errors_by_reason: state.errors_by_reason.clone(),
            durations: if ordered.is_empty() {
                None
            } else {
                Some(DurationSummary {
                    sample_count: ordered.len(),
                    sampled: state.observed_durations > ordered.len() as u64,
                    min_ms: ordered[0],
                    p50_ms: percentile(&ordered, 0.5),
                    p95_ms: percentile(&ordered, 0.95),
                    p99_ms: percentile(&ordered, 0.99),
                    max_ms: ordered[ordered.len() - 1],
                })
            },
        }
    }

    /// Discard all counts and start a new window.
    pub fn reset(&self) {
        if let Ok(mut state) = self.state.lock() {
            *state = ObservationState::default();
        }
    }

    /// Use this recorder as an executor metric sink.
    pub fn sink(&self) -> MetricSink {
        let recorder = self.clone();
        Arc::new(move |metric| recorder.record(metric))
    }
}

/// Build the operator export document for a host-execution observation.
///
/// The document is aggregate-only and is meant to be written to disk or handed
/// to an operator; FlexDoc never transmits it. Browser-direct executions never
/// reach an API host, so the transport mix cannot be derived here, and that gap
/// is declared so a review cannot mistake this document for complete evidence.
pub fn observation_report(observation: &HostExecutionObservation) -> Value {
    json!({
        "schema": OBSERVATION_SCHEMA,
        "generatedAt": format_instant(unix_now()),
        "runtime": "rust",
        "observation": observation.snapshot().to_json(),
        "gaps": OBSERVATION_GAPS,
    })
}

fn tally(counts: &mut HashMap<&'static str, u64>, reason: Option<&String>) {
    let Some(reason) = reason else { return };
    if let Some(known) = HOST_EXECUTION_REASONS
        .iter()
        .find(|candidate| *candidate == reason)
    {
        *counts.entry(known).or_insert(0) += 1;
    }
}

fn counts_to_json(counts: &HashMap<&'static str, u64>) -> Value {
    let mut map = Map::new();
    for (reason, count) in counts {
        map.insert((*reason).to_string(), json!(count));
    }
    Value::Object(map)
}

fn percentile(sorted: &[f64], fraction: f64) -> f64 {
    if sorted.len() == 1 {
        return sorted[0];
    }
    let rank = (fraction * sorted.len() as f64).ceil() as usize;
    sorted[rank.clamp(1, sorted.len()) - 1]
}

fn unix_now() -> Duration {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
}

fn format_instant(since_epoch: Duration) -> String {
    // A dependency-free RFC 3339 rendering: adding chrono to a published crate
    // for one timestamp would be a poor trade.
    let total_seconds = since_epoch.as_secs();
    let milliseconds = since_epoch.subsec_millis();
    let (year, month, day) = civil_from_days((total_seconds / 86_400) as i64);
    let seconds_of_day = total_seconds % 86_400;
    format!(
        "{year:04}-{month:02}-{day:02}T{:02}:{:02}:{:02}.{milliseconds:03}Z",
        seconds_of_day / 3600,
        (seconds_of_day % 3600) / 60,
        seconds_of_day % 60,
    )
}

/// Howard Hinnant's civil-from-days algorithm, for days since 1970-01-01.
fn civil_from_days(days: i64) -> (i64, u32, u32) {
    let z = days + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let day_of_era = z - era * 146_097;
    let year_of_era =
        (day_of_era - day_of_era / 1460 + day_of_era / 36_524 - day_of_era / 146_096) / 365;
    let year = year_of_era + era * 400;
    let day_of_year = day_of_era - (365 * year_of_era + year_of_era / 4 - year_of_era / 100);
    let shifted_month = (5 * day_of_year + 2) / 153;
    let day = (day_of_year - (153 * shifted_month + 2) / 5 + 1) as u32;
    let month = if shifted_month < 10 {
        shifted_month + 3
    } else {
        shifted_month - 9
    } as u32;
    (if month <= 2 { year + 1 } else { year }, month, day)
}

/// Reservoir replacement needs a uniform draw, not unpredictability, so the
/// address of a stack local seeds a cheap xorshift rather than pulling in `rand`.
fn pseudo_random() -> f64 {
    use std::cell::Cell;
    thread_local! {
        static STATE: Cell<u64> = const { Cell::new(0) };
    }
    STATE.with(|state| {
        let mut seed = state.get();
        if seed == 0 {
            seed = unix_now().as_nanos() as u64 | 1;
        }
        seed ^= seed << 13;
        seed ^= seed >> 7;
        seed ^= seed << 17;
        state.set(seed);
        (seed >> 11) as f64 / (1u64 << 53) as f64
    })
}
