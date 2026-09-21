defmodule PraugaFlexDoc.HostExecutionObservabilityTest do
  use ExUnit.Case, async: false

  alias PraugaFlexDoc.HostExecution
  alias PraugaFlexDoc.HostExecutionMetric
  alias PraugaFlexDoc.HostExecutionObservability
  alias PraugaFlexDoc.HostExecutionObservation

  defp collecting_executor(origins \\ ["https://api.example.test"]) do
    test = self()
    HostExecution.new!(origins, metric_sink: fn metric -> send(test, {:metric, metric}) end)
  end

  defp collected_metrics(acc \\ []) do
    receive do
      {:metric, metric} -> collected_metrics([metric | acc])
    after
      0 -> Enum.reverse(acc)
    end
  end

  defp find(metrics, name), do: Enum.find(metrics, &(&1.name == name))

  defp metric(name, kind, value, labels \\ %{}) do
    %HostExecutionMetric{name: name, kind: kind, value: value, labels: labels}
  end

  defp start_recorder(options \\ []) do
    {:ok, recorder} = HostExecutionObservation.start_link(options)
    recorder
  end

  # Casts are asynchronous, so read through a call to be sure every fold landed.
  defp settled_snapshot(recorder), do: HostExecutionObservation.snapshot(recorder)

  # The reason vocabulary is a cross-runtime contract, not an Elixir detail: a
  # collector written against any other FlexDoc host must read these labels
  # unchanged.
  test "reasons match the shared vocabulary" do
    assert HostExecutionObservability.reasons() == [
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
             "upstream-error"
           ]

    assert HostExecutionObservability.reason?("upstream-timeout")
    refute HostExecutionObservability.reason?("slow")
  end

  test "an unmarked request is counted outside the lifecycle" do
    executor = collecting_executor()
    HostExecution.handle(executor, nil, %{})

    assert [metric] = collected_metrics()
    assert metric.name == "flexdoc_execute_unmarked_total"
    assert metric.labels["reason"] == "marker-missing"
  end

  test "a policy rejection carries its reason and is not an upstream error" do
    executor = collecting_executor()

    result =
      HostExecution.handle(executor, "1", %{
        "request" => %{"url" => "https://blocked.example.test/pets", "method" => "GET"}
      })

    assert result.status == 403

    metrics = collected_metrics()
    rejection = find(metrics, "flexdoc_execute_rejections_total")
    assert rejection.labels["reason"] == "destination-forbidden"
    assert rejection.labels["statusCode"] == "403"
    assert rejection.labels["source"] == "route"
    refute find(metrics, "flexdoc_execute_errors_total")
  end

  test "a malformed envelope is separable from a policy rejection" do
    executor = collecting_executor()
    HostExecution.handle(executor, "1", "not a map")

    rejection = find(collected_metrics(), "flexdoc_execute_rejections_total")
    assert rejection.labels["reason"] == "body-malformed"
  end

  test "an unreachable target is an upstream failure and the gauge still balances" do
    # Listen then close so the port is almost certainly refused rather than open.
    {:ok, listener} = :gen_tcp.listen(0, [:binary, active: false])
    {:ok, port} = :inet.port(listener)
    :ok = :gen_tcp.close(listener)
    origin = "http://127.0.0.1:#{port}"

    executor = collecting_executor([origin])
    result = HostExecution.handle(executor, "1", %{"request" => %{"url" => "#{origin}/pets", "method" => "GET"}})
    assert result.status == 502

    metrics = collected_metrics()
    failure = find(metrics, "flexdoc_execute_errors_total")
    assert failure.labels["reason"] == "upstream-unreachable"
    refute find(metrics, "flexdoc_execute_rejections_total")

    gauge =
      metrics
      |> Enum.filter(&(&1.name == "flexdoc_execute_in_flight"))
      |> Enum.map(& &1.value)
      |> Enum.sum()

    assert gauge == 0
  end

  test "a raising sink cannot fail an execution" do
    executor =
      HostExecution.new!(["https://api.example.test"],
        metric_sink: fn _metric -> raise "collector down" end
      )

    result =
      HostExecution.handle(executor, "1", %{
        "request" => %{"url" => "https://blocked.example.test/pets", "method" => "GET"}
      })

    assert result.status == 403
  end

  test "an executor without a sink behaves exactly as before" do
    executor = HostExecution.new!(["https://api.example.test"])
    assert HostExecution.handle(executor, nil, %{}).status == 403
  end

  test "the recorder aggregates by outcome and reason" do
    recorder = start_recorder()

    HostExecutionObservation.record(recorder, metric("flexdoc_execute_requests_total", :counter, 1))
    HostExecutionObservation.record(recorder, metric("flexdoc_execute_in_flight", :gauge, 1))
    HostExecutionObservation.record(recorder, metric("flexdoc_execute_in_flight", :gauge, 1))
    HostExecutionObservation.record(recorder, metric("flexdoc_execute_in_flight", :gauge, -1))

    HostExecutionObservation.record(
      recorder,
      metric("flexdoc_execute_completions_total", :counter, 1, %{"outcome" => "rejected"})
    )

    HostExecutionObservation.record(
      recorder,
      metric("flexdoc_execute_rejections_total", :counter, 1, %{"reason" => "destination-forbidden"})
    )

    HostExecutionObservation.record(
      recorder,
      metric("flexdoc_execute_errors_total", :counter, 1, %{"reason" => "upstream-timeout"})
    )

    HostExecutionObservation.record(
      recorder,
      metric("flexdoc_execute_unmarked_total", :counter, 1, %{"reason" => "marker-missing"})
    )

    HostExecutionObservation.record(
      recorder,
      metric("flexdoc_execute_errors_total", :counter, 1, %{"reason" => "not-a-reason"})
    )

    snapshot = settled_snapshot(recorder)
    assert snapshot["startedExecutions"] == 1
    assert snapshot["completedExecutions"] == 1
    assert snapshot["outcomes"]["rejected"] == 1
    assert snapshot["outcomes"]["success"] == 0
    assert snapshot["inFlight"] == 1
    assert snapshot["peakInFlight"] == 2
    assert snapshot["rejectionsByReason"]["destination-forbidden"] == 1
    assert map_size(snapshot["errorsByReason"]) == 1, "an unknown reason must not be tallied"
    assert snapshot["unmarkedRequests"] == 1
    refute snapshot["durations"], "no duration summary before the first completion duration"
  end

  test "the recorder reports exact percentiles" do
    recorder = start_recorder()

    Enum.each(1..100, fn index ->
      HostExecutionObservation.record(
        recorder,
        metric("flexdoc_execute_duration_seconds", :histogram, index / 1000, %{"outcome" => "success"})
      )
    end)

    durations = settled_snapshot(recorder)["durations"]
    refute durations["sampled"], "100 observations fit under the capacity"
    assert durations["sampleCount"] == 100
    assert_in_delta durations["minMs"], 1.0, 0.001
    assert_in_delta durations["p50Ms"], 50.0, 0.001
    assert_in_delta durations["p95Ms"], 95.0, 0.001
    assert_in_delta durations["p99Ms"], 99.0, 0.001
    assert_in_delta durations["maxMs"], 100.0, 0.001
  end

  test "the recorder bounds memory by sampling" do
    recorder = start_recorder(duration_sample_capacity: 16)

    Enum.each(1..500, fn _index ->
      HostExecutionObservation.record(recorder, metric("flexdoc_execute_duration_seconds", :histogram, 0.05))
    end)

    durations = settled_snapshot(recorder)["durations"]
    assert durations["sampleCount"] == 16, "capacity must bound retention"
    assert durations["sampled"], "sampling must be declared past capacity"
  end

  test "reset starts a new window" do
    recorder = start_recorder()
    HostExecutionObservation.record(recorder, metric("flexdoc_execute_requests_total", :counter, 1))
    :ok = HostExecutionObservation.reset(recorder)

    snapshot = settled_snapshot(recorder)
    assert snapshot["startedExecutions"] == 0
    refute snapshot["windowStart"]
  end

  test "the recorder sink is usable directly as an executor metric sink" do
    recorder = start_recorder()
    executor = HostExecution.new!(["https://api.example.test"], metric_sink: HostExecutionObservation.sink(recorder))
    HostExecution.handle(executor, nil, %{})

    assert settled_snapshot(recorder)["unmarkedRequests"] == 1
  end

  # The export is handed to operators and may be written to disk, so it must carry
  # no request content: only counts, timestamps and known category names.
  test "the report carries no request content" do
    recorder = start_recorder()
    HostExecutionObservation.record(recorder, metric("flexdoc_execute_requests_total", :counter, 1))

    HostExecutionObservation.record(
      recorder,
      metric("flexdoc_execute_rejections_total", :counter, 1, %{
        "reason" => "destination-forbidden",
        "target" => "https://secret.internal/pets?token=abc"
      })
    )

    HostExecutionObservation.record(recorder, metric("flexdoc_execute_duration_seconds", :histogram, 0.25))

    report = HostExecutionObservation.report(recorder)
    assert report["schema"] == "flexdoc.host-execution.observation/1"
    assert report["runtime"] == "elixir"
    assert report["gaps"] == ["browser-direct-transport-mix"]

    rendered = inspect(report, limit: :infinity)

    for leaked <- ["secret.internal", "token=abc", "/pets"] do
      refute String.contains?(rendered, leaked), "report leaked request content #{leaked}"
    end
  end
end
