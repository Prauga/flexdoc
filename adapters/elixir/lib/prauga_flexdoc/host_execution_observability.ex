defmodule PraugaFlexDoc.HostExecutionObservability do
  @moduledoc """
  Execution evidence for the Elixir host executor.

  This mirrors the Node, Python, Go, Rust, Ruby and PHP contract deliberately: the
  same reason vocabulary, the same metric names and labels, and the same export
  schema. An operator running a mixed fleet should read one document shape
  regardless of which runtime served the execute route, and a collector written
  for one runtime should not need a second parser for another.
  """

  @reasons ~w(
    marker-missing
    execution-disabled
    admission-saturated
    destination-forbidden
    redirect-forbidden
    body-malformed
    body-too-large
    unsupported-media-type
    request-invalid
    auth-unsupported
    upstream-timeout
    upstream-unreachable
    upstream-error
  )

  @schema "flexdoc.host-execution.observation/1"
  @gaps ~w(browser-direct-transport-mix)
  @outcomes ~w(success rejected error)

  @doc """
  Stable low-cardinality categories for a non-successful execution.

  Rejection messages interpolate request values such as origins, field names and
  methods, so they are unbounded and cannot be used as a metric label. These can.
  """
  @spec reasons() :: [String.t()]
  def reasons, do: @reasons

  @doc "Operator export document schema shared by every FlexDoc runtime."
  @spec schema() :: String.t()
  def schema, do: @schema

  @doc "Evidence an API host cannot observe by itself, declared rather than omitted."
  @spec gaps() :: [String.t()]
  def gaps, do: @gaps

  @doc "Outcome names used by the completion counter."
  @spec outcomes() :: [String.t()]
  def outcomes, do: @outcomes

  @doc "Whether a value is one of the stable reason categories."
  @spec reason?(term()) :: boolean()
  def reason?(value) when is_binary(value), do: value in @reasons
  def reason?(_value), do: false

  @doc """
  Default category for a status, so a throw site names a status rather than
  repeating a category it cannot know better than the status does.
  """
  @spec default_reason(pos_integer()) :: String.t()
  def default_reason(status) when status >= 500, do: "upstream-error"
  def default_reason(403), do: "destination-forbidden"
  def default_reason(_status), do: "request-invalid"
end

defmodule PraugaFlexDoc.HostExecutionMetric do
  @moduledoc """
  One dependency-free metric update that can be bridged to Prometheus,
  OpenTelemetry or `:telemetry` without FlexDoc owning a registry.
  """

  defstruct [:name, :kind, :value, labels: %{}]

  @type t :: %__MODULE__{
          name: String.t(),
          kind: :counter | :gauge | :histogram,
          value: number(),
          labels: %{optional(String.t()) => String.t()}
        }
end

defmodule PraugaFlexDoc.HostExecutionObservation do
  @moduledoc """
  Aggregates host-execution evidence for one window, free of request content.

  Only counters and durations are retained. No URL, header, body, credential or
  per-request timestamp reaches this recorder, so the aggregate cannot carry
  request content by construction.

  Durations are retained up to the sample capacity and then replaced by reservoir
  sampling, so memory stays bounded for a node that runs indefinitely while
  percentiles stay representative of the whole window rather than only its
  opening. Counts stay exact regardless.

  The recorder is a `GenServer` rather than a struct the caller threads through
  its own state: executions run in per-request processes, so an aggregate has to
  live somewhere they can all reach.
  """

  use GenServer

  alias PraugaFlexDoc.HostExecutionMetric
  alias PraugaFlexDoc.HostExecutionObservability

  @default_capacity 8192

  @doc """
  Starts a recorder.

  ## Options

    * `:duration_sample_capacity` - retained durations before uniform sampling begins
    * `:name` - optional process name, so a supervised recorder can be reached by name
  """
  @spec start_link(keyword()) :: GenServer.on_start()
  def start_link(options \\ []) do
    {name, options} = Keyword.pop(options, :name)
    GenServer.start_link(__MODULE__, options, if(name, do: [name: name], else: []))
  end

  @doc "Folds one metric update into the aggregate."
  @spec record(GenServer.server(), HostExecutionMetric.t()) :: :ok
  def record(recorder, %HostExecutionMetric{} = metric) do
    GenServer.cast(recorder, {:record, metric, System.system_time(:millisecond)})
  end

  @doc """
  A sink function usable directly as the executor's `:metric_sink`.

  The cast is asynchronous, so a slow collector cannot add latency to an
  execution and a dead recorder cannot fail one.
  """
  @spec sink(GenServer.server()) :: (HostExecutionMetric.t() -> :ok)
  def sink(recorder), do: fn metric -> record(recorder, metric) end

  @doc "Current aggregate; safe to call at any time."
  @spec snapshot(GenServer.server()) :: map()
  def snapshot(recorder), do: GenServer.call(recorder, :snapshot)

  @doc "Discards all counts and starts a new window."
  @spec reset(GenServer.server()) :: :ok
  def reset(recorder), do: GenServer.call(recorder, :reset)

  @doc """
  Builds the operator export document for a recorder.

  The document is aggregate-only and is meant to be written to disk or handed to
  an operator; FlexDoc never transmits it. Browser-direct executions never reach
  an API host, so the transport mix cannot be derived here, and that gap is
  declared so a review cannot mistake this document for complete evidence.
  """
  @spec report(GenServer.server(), keyword()) :: map()
  def report(recorder, options \\ []) do
    %{
      "schema" => HostExecutionObservability.schema(),
      "generatedAt" => Keyword.get(options, :generated_at) || iso8601(System.system_time(:millisecond)),
      "runtime" => "elixir",
      "observation" => snapshot(recorder),
      "gaps" => HostExecutionObservability.gaps()
    }
  end

  @impl GenServer
  def init(options) do
    capacity = options |> Keyword.get(:duration_sample_capacity, @default_capacity) |> max(1)
    {:ok, %{capacity: capacity} |> Map.merge(empty_window())}
  end

  @impl GenServer
  def handle_cast({:record, metric, timestamp}, state) do
    state = %{state | window_start: state.window_start || timestamp, window_end: timestamp}
    {:noreply, fold(metric, state)}
  end

  @impl GenServer
  def handle_call(:snapshot, _from, state), do: {:reply, build_snapshot(state), state}

  @impl GenServer
  def handle_call(:reset, _from, state) do
    {:reply, :ok, Map.merge(state, empty_window())}
  end

  defp fold(%HostExecutionMetric{name: "flexdoc_execute_requests_total"}, state) do
    %{state | started: state.started + 1}
  end

  defp fold(%HostExecutionMetric{name: "flexdoc_execute_in_flight", value: value}, state) do
    in_flight = max(state.in_flight + trunc(value), 0)
    %{state | in_flight: in_flight, peak_in_flight: max(state.peak_in_flight, in_flight)}
  end

  defp fold(%HostExecutionMetric{name: "flexdoc_execute_completions_total", labels: labels}, state) do
    outcome = Map.get(labels, "outcome")

    outcomes =
      if Map.has_key?(state.outcomes, outcome),
        do: Map.update!(state.outcomes, outcome, &(&1 + 1)),
        else: state.outcomes

    %{state | completed: state.completed + 1, outcomes: outcomes}
  end

  defp fold(%HostExecutionMetric{name: "flexdoc_execute_rejections_total", labels: labels}, state) do
    %{state | rejections: tally(state.rejections, Map.get(labels, "reason"))}
  end

  # Deliberately not folded into rejections: those describe validated envelopes,
  # and merging the two would double-count attempts.
  defp fold(%HostExecutionMetric{name: "flexdoc_execute_unmarked_total"}, state) do
    %{state | unmarked: state.unmarked + 1}
  end

  defp fold(%HostExecutionMetric{name: "flexdoc_execute_errors_total", labels: labels}, state) do
    %{state | errors: tally(state.errors, Map.get(labels, "reason"))}
  end

  defp fold(%HostExecutionMetric{name: "flexdoc_execute_duration_seconds", value: value}, state) do
    record_duration(state, max(value * 1000, 0))
  end

  defp fold(_metric, state), do: state

  defp tally(counts, reason) do
    if HostExecutionObservability.reason?(reason),
      do: Map.update(counts, reason, 1, &(&1 + 1)),
      else: counts
  end

  defp record_duration(state, milliseconds) do
    observed = state.observed_durations + 1

    durations =
      if length(state.durations) < state.capacity do
        [milliseconds | state.durations]
      else
        candidate = trunc(:rand.uniform() * observed)

        if candidate < state.capacity,
          do: List.replace_at(state.durations, candidate, milliseconds),
          else: state.durations
      end

    %{state | observed_durations: observed, durations: durations}
  end

  defp build_snapshot(state) do
    ordered = Enum.sort(state.durations)

    %{
      "windowStart" => state.window_start && iso8601(state.window_start),
      "windowEnd" => state.window_end && iso8601(state.window_end),
      "startedExecutions" => state.started,
      "unmarkedRequests" => state.unmarked,
      "completedExecutions" => state.completed,
      "outcomes" => state.outcomes,
      "inFlight" => state.in_flight,
      "peakInFlight" => state.peak_in_flight,
      "rejectionsByReason" => state.rejections,
      "errorsByReason" => state.errors,
      "durations" => duration_summary(ordered, state.observed_durations)
    }
  end

  defp duration_summary([], _observed), do: nil

  defp duration_summary(ordered, observed) do
    %{
      "sampleCount" => length(ordered),
      "sampled" => observed > length(ordered),
      "minMs" => List.first(ordered),
      "p50Ms" => percentile(ordered, 0.5),
      "p95Ms" => percentile(ordered, 0.95),
      "p99Ms" => percentile(ordered, 0.99),
      "maxMs" => List.last(ordered)
    }
  end

  defp percentile([single], _fraction), do: single

  defp percentile(ordered, fraction) do
    count = length(ordered)
    rank = fraction |> Kernel.*(count) |> Float.ceil() |> trunc() |> max(1) |> min(count)
    Enum.at(ordered, rank - 1)
  end

  defp empty_window do
    %{
      window_start: nil,
      window_end: nil,
      started: 0,
      unmarked: 0,
      completed: 0,
      in_flight: 0,
      peak_in_flight: 0,
      observed_durations: 0,
      outcomes: Map.new(HostExecutionObservability.outcomes(), &{&1, 0}),
      rejections: %{},
      errors: %{},
      durations: []
    }
  end

  defp iso8601(milliseconds) do
    milliseconds
    |> DateTime.from_unix!(:millisecond)
    |> DateTime.to_iso8601()
  end
end
