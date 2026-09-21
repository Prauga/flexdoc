# frozen_string_literal: true

require "json"
require "minitest/autorun"
require "socket"
require_relative "../lib/prauga/flexdoc"

class FlexDocHostExecutionObservabilityTest < Minitest::Test
  Reasons = Prauga::FlexDoc::HostExecutionObservability

  def collecting_executor(origins = ["https://api.example.test"])
    collected = []
    executor = Prauga::FlexDoc::HostExecution.new(
      allowed_origins: origins,
      metric_sink: ->(metric) { collected << metric }
    )
    [executor, collected]
  end

  def find(collected, name)
    collected.find { |metric| metric.name == name }
  end

  # The reason vocabulary is a cross-runtime contract, not a Ruby detail: a
  # collector written against the Node, Python, Go or Rust host must read these
  # labels unchanged.
  def test_reasons_match_the_shared_vocabulary
    assert_equal %w[
      marker-missing execution-disabled admission-saturated destination-forbidden
      redirect-forbidden body-malformed body-too-large unsupported-media-type
      request-invalid auth-unsupported upstream-timeout upstream-unreachable
      upstream-error
    ], Reasons::HOST_EXECUTION_REASONS
    assert Reasons.host_execution_reason?("upstream-timeout")
    refute Reasons.host_execution_reason?("slow")
  end

  def test_unmarked_request_is_counted_outside_the_lifecycle
    executor, collected = collecting_executor
    executor.handle(marker: nil, envelope: {})

    assert_equal 1, collected.length, "expected exactly one metric"
    assert_equal "flexdoc_execute_unmarked_total", collected.first.name
    assert_equal "marker-missing", collected.first.labels["reason"]
  end

  def test_policy_rejection_carries_its_reason
    executor, collected = collecting_executor
    result = executor.handle(
      marker: "1",
      envelope: { "request" => { "url" => "https://blocked.example.test/pets", "method" => "GET" } }
    )
    assert_equal 403, result.status

    rejection = find(collected, "flexdoc_execute_rejections_total")
    refute_nil rejection, "expected a rejection counter, got #{collected.map(&:name)}"
    assert_equal "destination-forbidden", rejection.labels["reason"]
    assert_equal "403", rejection.labels["statusCode"]
    assert_equal "route", rejection.labels["source"]
    assert_nil find(collected, "flexdoc_execute_errors_total"),
               "a policy rejection must not also count as an upstream error"
  end

  def test_malformed_envelope_is_separable_from_a_policy_rejection
    executor, collected = collecting_executor
    executor.handle(marker: "1", envelope: "not an object")

    rejection = find(collected, "flexdoc_execute_rejections_total")
    assert_equal "body-malformed", rejection.labels["reason"]
  end

  def test_unreachable_target_is_an_upstream_failure_not_a_rejection
    # Bind and close so the port is almost certainly refused rather than open.
    server = TCPServer.new("127.0.0.1", 0)
    origin = "http://127.0.0.1:#{server.addr[1]}"
    server.close

    executor, collected = collecting_executor([origin])
    result = executor.handle(
      marker: "1",
      envelope: { "request" => { "url" => "#{origin}/pets", "method" => "GET" } }
    )
    assert_equal 502, result.status

    failure = find(collected, "flexdoc_execute_errors_total")
    refute_nil failure, "expected an error counter, got #{collected.map(&:name)}"
    assert_equal "upstream-unreachable", failure.labels["reason"]
    assert_nil find(collected, "flexdoc_execute_rejections_total"),
               "an upstream failure must not be counted as a policy rejection"

    # The gauge must return to zero, or in-flight drifts upward forever.
    gauge = collected.select { |metric| metric.name == "flexdoc_execute_in_flight" }.sum(&:value)
    assert_equal 0, gauge
  end

  def test_a_failing_sink_cannot_fail_an_execution
    executor = Prauga::FlexDoc::HostExecution.new(
      allowed_origins: ["https://api.example.test"],
      metric_sink: ->(_metric) { raise "collector down" }
    )
    result = executor.handle(
      marker: "1",
      envelope: { "request" => { "url" => "https://blocked.example.test/pets", "method" => "GET" } }
    )
    assert_equal 403, result.status, "the execution outcome must survive a raising sink"
  end

  def test_no_metrics_without_a_sink
    executor = Prauga::FlexDoc::HostExecution.new(allowed_origins: ["https://api.example.test"])
    # An executor without a sink must behave exactly as it did before evidence
    # existed; nothing to assert beyond not raising.
    assert_equal 403, executor.handle(marker: nil, envelope: {}).status
  end

  def metric(name, kind, value, labels = {})
    Prauga::FlexDoc::HostExecutionMetric.new(name:, kind:, value:, labels:)
  end

  def test_observation_aggregates_by_outcome_and_reason
    observation = Prauga::FlexDoc::HostExecutionObservation.new
    observation.record(metric("flexdoc_execute_requests_total", "counter", 1))
    observation.record(metric("flexdoc_execute_in_flight", "gauge", 1))
    observation.record(metric("flexdoc_execute_in_flight", "gauge", 1))
    observation.record(metric("flexdoc_execute_in_flight", "gauge", -1))
    observation.record(metric("flexdoc_execute_completions_total", "counter", 1, { "outcome" => "rejected" }))
    observation.record(metric("flexdoc_execute_rejections_total", "counter", 1, { "reason" => "destination-forbidden" }))
    observation.record(metric("flexdoc_execute_errors_total", "counter", 1, { "reason" => "upstream-timeout" }))
    observation.record(metric("flexdoc_execute_unmarked_total", "counter", 1, { "reason" => "marker-missing" }))
    observation.record(metric("flexdoc_execute_errors_total", "counter", 1, { "reason" => "not-a-reason" }))

    snapshot = observation.snapshot
    assert_equal 1, snapshot["startedExecutions"]
    assert_equal 1, snapshot["completedExecutions"]
    assert_equal 1, snapshot["outcomes"]["rejected"]
    assert_equal 0, snapshot["outcomes"]["success"]
    assert_equal 1, snapshot["inFlight"]
    assert_equal 2, snapshot["peakInFlight"]
    assert_equal 1, snapshot["rejectionsByReason"]["destination-forbidden"]
    assert_equal 1, snapshot["errorsByReason"].length, "an unknown reason must not be tallied"
    assert_equal 1, snapshot["unmarkedRequests"]
    assert_nil snapshot["durations"], "no duration summary before the first completion duration"
  end

  def test_observation_reports_exact_percentiles
    observation = Prauga::FlexDoc::HostExecutionObservation.new
    (1..100).each do |index|
      observation.record(metric("flexdoc_execute_duration_seconds", "histogram", index / 1000.0, { "outcome" => "success" }))
    end

    durations = observation.snapshot["durations"]
    refute durations["sampled"], "100 observations fit under the capacity"
    assert_equal 100, durations["sampleCount"]
    assert_in_delta 1.0, durations["minMs"], 0.001
    assert_in_delta 50.0, durations["p50Ms"], 0.001
    assert_in_delta 95.0, durations["p95Ms"], 0.001
    assert_in_delta 99.0, durations["p99Ms"], 0.001
    assert_in_delta 100.0, durations["maxMs"], 0.001
  end

  def test_observation_bounds_memory_by_sampling
    observation = Prauga::FlexDoc::HostExecutionObservation.new(duration_sample_capacity: 16)
    500.times { observation.record(metric("flexdoc_execute_duration_seconds", "histogram", 0.05)) }

    durations = observation.snapshot["durations"]
    assert_equal 16, durations["sampleCount"], "capacity must bound retention"
    assert durations["sampled"], "sampling must be declared past capacity"
  end

  def test_observation_reset_starts_a_new_window
    observation = Prauga::FlexDoc::HostExecutionObservation.new
    observation.record(metric("flexdoc_execute_requests_total", "counter", 1))
    observation.reset

    snapshot = observation.snapshot
    assert_equal 0, snapshot["startedExecutions"]
    assert_nil snapshot["windowStart"]
  end

  def test_observation_sink_is_usable_as_an_executor_metric_sink
    observation = Prauga::FlexDoc::HostExecutionObservation.new
    executor = Prauga::FlexDoc::HostExecution.new(
      allowed_origins: ["https://api.example.test"],
      metric_sink: observation.sink
    )
    executor.handle(marker: nil, envelope: {})

    assert_equal 1, observation.snapshot["unmarkedRequests"]
  end

  # The export is handed to operators and may be written to disk, so it must carry
  # no request content: only counts, timestamps and known category names.
  def test_report_carries_no_request_content
    observation = Prauga::FlexDoc::HostExecutionObservation.new
    observation.record(metric("flexdoc_execute_requests_total", "counter", 1))
    observation.record(metric("flexdoc_execute_rejections_total", "counter", 1, {
                                "reason" => "destination-forbidden",
                                "target" => "https://secret.internal/pets?token=abc"
                              }))
    observation.record(metric("flexdoc_execute_duration_seconds", "histogram", 0.25))

    report = Prauga::FlexDoc.host_execution_observation_report(observation)
    assert_equal "flexdoc.host-execution.observation/1", report["schema"]
    assert_equal "ruby", report["runtime"]
    assert_equal ["browser-direct-transport-mix"], report["gaps"]

    encoded = JSON.generate(report)
    ["secret.internal", "token=abc", "/pets"].each do |leaked|
      refute_includes encoded, leaked, "report leaked request content"
    end
  end
end
