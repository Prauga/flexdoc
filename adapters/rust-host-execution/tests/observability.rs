#![cfg(feature = "host-execution")]

use prauga_flexdoc_host_execution::{
    is_host_execution_reason, observation_report, HostExecution, HostExecutionMetric,
    HostExecutionObservation, MetricKind, HOST_EXECUTION_REASONS,
};
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
};

fn metric(name: &'static str, kind: MetricKind, value: f64, labels: &[(&'static str, &str)]) -> HostExecutionMetric {
    HostExecutionMetric {
        name,
        kind,
        value,
        labels: labels
            .iter()
            .map(|(key, value)| (*key, (*value).to_string()))
            .collect(),
    }
}

fn collecting_executor(
    origins: &[&str],
) -> (HostExecution, Arc<Mutex<Vec<HostExecutionMetric>>>) {
    let collected = Arc::new(Mutex::new(Vec::new()));
    let sink_target = Arc::clone(&collected);
    let executor = HostExecution::new(origins.iter().copied())
        .expect("executor")
        .with_metric_sink(Arc::new(move |metric| {
            sink_target.lock().expect("sink lock").push(metric);
        }));
    (executor, collected)
}

fn find(metrics: &[HostExecutionMetric], name: &str) -> Option<HostExecutionMetric> {
    metrics.iter().find(|metric| metric.name == name).cloned()
}

// The reason vocabulary is a cross-runtime contract, not a Rust detail: a
// collector written against the Node, Python or Go host must read these labels
// unchanged.
#[test]
fn reasons_match_the_shared_vocabulary() {
    assert_eq!(
        HOST_EXECUTION_REASONS,
        &[
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
        ]
    );
    assert!(is_host_execution_reason("upstream-timeout"));
    assert!(!is_host_execution_reason("slow"));
}

#[tokio::test]
async fn unmarked_request_is_counted_outside_the_lifecycle() {
    let (executor, collected) = collecting_executor(&["https://api.example.test"]);
    executor.handle(None, json!({}), HashMap::new()).await;

    let metrics = collected.lock().expect("lock").clone();
    assert_eq!(metrics.len(), 1, "expected exactly one metric");
    assert_eq!(metrics[0].name, "flexdoc_execute_unmarked_total");
    assert_eq!(metrics[0].labels.get("reason").map(String::as_str), Some("marker-missing"));
}

#[tokio::test]
async fn policy_rejection_carries_its_reason() {
    let (executor, collected) = collecting_executor(&["https://api.example.test"]);
    let result = executor
        .handle(
            Some("1"),
            json!({"request": {"url": "https://blocked.example.test/pets", "method": "GET"}}),
            HashMap::new(),
        )
        .await;
    assert_eq!(result.status, 403);

    let metrics = collected.lock().expect("lock").clone();
    let rejection = find(&metrics, "flexdoc_execute_rejections_total").expect("rejection counter");
    assert_eq!(rejection.labels.get("reason").map(String::as_str), Some("destination-forbidden"));
    assert_eq!(rejection.labels.get("statusCode").map(String::as_str), Some("403"));
    assert_eq!(rejection.labels.get("source").map(String::as_str), Some("route"));
    assert!(
        find(&metrics, "flexdoc_execute_errors_total").is_none(),
        "a policy rejection must not also count as an upstream error"
    );
}

#[tokio::test]
async fn malformed_envelope_is_separable_from_a_policy_rejection() {
    let (executor, collected) = collecting_executor(&["https://api.example.test"]);
    executor.handle(Some("1"), json!("not an object"), HashMap::new()).await;

    let metrics = collected.lock().expect("lock").clone();
    let rejection = find(&metrics, "flexdoc_execute_rejections_total").expect("rejection counter");
    assert_eq!(rejection.labels.get("reason").map(String::as_str), Some("body-malformed"));
}

#[tokio::test]
async fn unreachable_target_is_an_upstream_failure_not_a_rejection() {
    // Bind and drop so the port is almost certainly refused rather than open.
    let listener = std::net::TcpListener::bind("127.0.0.1:0").expect("listener");
    let address = listener.local_addr().expect("address");
    drop(listener);
    let origin = format!("http://{address}");

    let (executor, collected) = collecting_executor(&[origin.as_str()]);
    let result = executor
        .handle(
            Some("1"),
            json!({"request": {"url": format!("{origin}/pets"), "method": "GET"}}),
            HashMap::new(),
        )
        .await;
    assert_eq!(result.status, 502);

    let metrics = collected.lock().expect("lock").clone();
    let failure = find(&metrics, "flexdoc_execute_errors_total").expect("error counter");
    assert_eq!(failure.labels.get("reason").map(String::as_str), Some("upstream-unreachable"));
    assert!(
        find(&metrics, "flexdoc_execute_rejections_total").is_none(),
        "an upstream failure must not be counted as a policy rejection"
    );

    // The gauge must return to zero, or in-flight drifts upward forever.
    let gauge: f64 = metrics
        .iter()
        .filter(|metric| metric.name == "flexdoc_execute_in_flight")
        .map(|metric| metric.value)
        .sum();
    assert_eq!(gauge, 0.0);
}

#[tokio::test]
async fn a_failing_sink_cannot_fail_an_execution() {
    let executor = HostExecution::new(["https://api.example.test"])
        .expect("executor")
        .with_metric_sink(Arc::new(|_| panic!("collector down")));
    let result = executor
        .handle(
            Some("1"),
            json!({"request": {"url": "https://blocked.example.test/pets", "method": "GET"}}),
            HashMap::new(),
        )
        .await;
    assert_eq!(
        result.status, 403,
        "the execution outcome must survive a panicking sink"
    );
}

#[tokio::test]
async fn no_metrics_without_a_sink() {
    let executor = HostExecution::new(["https://api.example.test"]).expect("executor");
    // An executor without a sink must behave exactly as it did before evidence
    // existed; nothing to assert beyond not panicking.
    let result = executor.handle(None, json!({}), HashMap::new()).await;
    assert_eq!(result.status, 403);
}

#[test]
fn observation_aggregates_by_outcome_and_reason() {
    let observation = HostExecutionObservation::new();
    observation.record(metric("flexdoc_execute_requests_total", MetricKind::Counter, 1.0, &[]));
    observation.record(metric("flexdoc_execute_in_flight", MetricKind::Gauge, 1.0, &[]));
    observation.record(metric("flexdoc_execute_in_flight", MetricKind::Gauge, 1.0, &[]));
    observation.record(metric("flexdoc_execute_in_flight", MetricKind::Gauge, -1.0, &[]));
    observation.record(metric(
        "flexdoc_execute_completions_total",
        MetricKind::Counter,
        1.0,
        &[("outcome", "rejected")],
    ));
    observation.record(metric(
        "flexdoc_execute_rejections_total",
        MetricKind::Counter,
        1.0,
        &[("reason", "destination-forbidden")],
    ));
    observation.record(metric(
        "flexdoc_execute_errors_total",
        MetricKind::Counter,
        1.0,
        &[("reason", "upstream-timeout")],
    ));
    observation.record(metric(
        "flexdoc_execute_unmarked_total",
        MetricKind::Counter,
        1.0,
        &[("reason", "marker-missing")],
    ));
    observation.record(metric(
        "flexdoc_execute_errors_total",
        MetricKind::Counter,
        1.0,
        &[("reason", "not-a-reason")],
    ));

    let snapshot = observation.snapshot();
    assert_eq!(snapshot.started_executions, 1);
    assert_eq!(snapshot.completed_executions, 1);
    assert_eq!(snapshot.rejections, 1);
    assert_eq!(snapshot.successes, 0);
    assert_eq!(snapshot.in_flight, 1);
    assert_eq!(snapshot.peak_in_flight, 2);
    assert_eq!(snapshot.rejections_by_reason.get("destination-forbidden"), Some(&1));
    assert_eq!(snapshot.errors_by_reason.len(), 1, "an unknown reason must not be tallied");
    assert_eq!(snapshot.unmarked_requests, 1);
    assert!(
        snapshot.durations.is_none(),
        "no duration summary before the first completion duration"
    );
}

#[test]
fn observation_reports_exact_percentiles() {
    let observation = HostExecutionObservation::new();
    for index in 1..=100 {
        observation.record(metric(
            "flexdoc_execute_duration_seconds",
            MetricKind::Histogram,
            f64::from(index) / 1000.0,
            &[("outcome", "success")],
        ));
    }
    let durations = observation.snapshot().durations.expect("duration summary");
    assert!(!durations.sampled, "100 observations fit under the capacity");
    assert_eq!(durations.sample_count, 100);
    assert_eq!(durations.min_ms.round(), 1.0);
    assert_eq!(durations.p50_ms.round(), 50.0);
    assert_eq!(durations.p95_ms.round(), 95.0);
    assert_eq!(durations.p99_ms.round(), 99.0);
    assert_eq!(durations.max_ms.round(), 100.0);
}

#[test]
fn observation_bounds_memory_by_sampling() {
    let observation = HostExecutionObservation::with_capacity(16);
    for _ in 0..500 {
        observation.record(metric("flexdoc_execute_duration_seconds", MetricKind::Histogram, 0.05, &[]));
    }
    let durations = observation.snapshot().durations.expect("duration summary");
    assert_eq!(durations.sample_count, 16, "capacity must bound retention");
    assert!(durations.sampled, "sampling must be declared past capacity");
}

#[test]
fn observation_reset_starts_a_new_window() {
    let observation = HostExecutionObservation::new();
    observation.record(metric("flexdoc_execute_requests_total", MetricKind::Counter, 1.0, &[]));
    observation.reset();

    let snapshot = observation.snapshot();
    assert_eq!(snapshot.started_executions, 0);
    assert!(snapshot.window_start.is_none());
}

// The export is handed to operators and may be written to disk, so it must carry
// no request content: only counts, timestamps and known category names.
#[test]
fn report_carries_no_request_content() {
    let observation = HostExecutionObservation::new();
    observation.record(metric("flexdoc_execute_requests_total", MetricKind::Counter, 1.0, &[]));
    observation.record(metric(
        "flexdoc_execute_rejections_total",
        MetricKind::Counter,
        1.0,
        &[
            ("reason", "destination-forbidden"),
            ("target", "https://secret.internal/pets?token=abc"),
        ],
    ));
    observation.record(metric("flexdoc_execute_duration_seconds", MetricKind::Histogram, 0.25, &[]));

    let report = observation_report(&observation);
    assert_eq!(report["schema"], Value::from("flexdoc.host-execution.observation/1"));
    assert_eq!(report["runtime"], Value::from("rust"));
    assert_eq!(report["gaps"], json!(["browser-direct-transport-mix"]));

    let encoded = serde_json::to_string(&report).expect("serializable");
    for leaked in ["secret.internal", "token=abc", "/pets"] {
        assert!(!encoded.contains(leaked), "report leaked {leaked}: {encoded}");
    }
}

#[test]
fn a_cloned_recorder_shares_one_window() {
    let observation = HostExecutionObservation::new();
    let sink = observation.sink();
    sink(metric("flexdoc_execute_requests_total", MetricKind::Counter, 1.0, &[]));
    sink(metric("flexdoc_execute_requests_total", MetricKind::Counter, 1.0, &[]));

    assert_eq!(
        observation.snapshot().started_executions,
        2,
        "a sink taken from the recorder must fold into the same window"
    );
}
