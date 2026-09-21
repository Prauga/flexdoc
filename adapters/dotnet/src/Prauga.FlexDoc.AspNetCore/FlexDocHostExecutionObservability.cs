using System.Globalization;
using System.Text.Json.Serialization;

namespace Prauga.FlexDoc.AspNetCore;

// This mirrors the Node, Python, Go, Rust, Ruby, PHP and Elixir contract
// deliberately: the same reason vocabulary, the same metric names and labels,
// and the same export schema. An operator running a mixed fleet should read one
// document shape regardless of which runtime served the execute route, and a
// collector written for one runtime should not need a second parser for another.

/// <summary>
/// Stable low-cardinality categories for a non-successful host execution.
/// </summary>
/// <remarks>
/// Rejection messages interpolate request values such as origins, field names and
/// methods, so they are unbounded and cannot be used as a metric label. These can.
/// </remarks>
public static class FlexDocHostExecutionReasons
{
    /// <summary>A request arrived without the <c>X-FlexDoc-Execute</c> marker.</summary>
    public const string MarkerMissing = "marker-missing";

    /// <summary>Host execution is not enabled on this deployment.</summary>
    public const string ExecutionDisabled = "execution-disabled";

    /// <summary>An admission limit rejected the request before execution.</summary>
    public const string AdmissionSaturated = "admission-saturated";

    /// <summary>The destination is outside the configured origin allowlist or is blocked.</summary>
    public const string DestinationForbidden = "destination-forbidden";

    /// <summary>A redirect was refused by the redirect policy.</summary>
    public const string RedirectForbidden = "redirect-forbidden";

    /// <summary>The envelope or a body could not be parsed.</summary>
    public const string BodyMalformed = "body-malformed";

    /// <summary>A request or response body exceeded its safety limit.</summary>
    public const string BodyTooLarge = "body-too-large";

    /// <summary>A declared media type was invalid or unsupported.</summary>
    public const string UnsupportedMediaType = "unsupported-media-type";

    /// <summary>The canonical request draft was structurally valid but unusable.</summary>
    public const string RequestInvalid = "request-invalid";

    /// <summary>A requested authentication scheme is not implemented natively.</summary>
    public const string AuthUnsupported = "auth-unsupported";

    /// <summary>The upstream did not answer within the request deadline.</summary>
    public const string UpstreamTimeout = "upstream-timeout";

    /// <summary>The upstream could not be resolved or connected to.</summary>
    public const string UpstreamUnreachable = "upstream-unreachable";

    /// <summary>The upstream exchange failed for another reason.</summary>
    public const string UpstreamError = "upstream-error";

    /// <summary>Identifies the operator export document shared across runtimes.</summary>
    public const string ObservationSchema = "flexdoc.host-execution.observation/1";

    private static readonly string[] Ordered =
    {
        MarkerMissing, ExecutionDisabled, AdmissionSaturated, DestinationForbidden,
        RedirectForbidden, BodyMalformed, BodyTooLarge, UnsupportedMediaType,
        RequestInvalid, AuthUnsupported, UpstreamTimeout, UpstreamUnreachable, UpstreamError,
    };

    private static readonly HashSet<string> Known = new(Ordered, StringComparer.Ordinal);

    /// <summary>Names evidence an API host cannot observe by itself.</summary>
    public static IReadOnlyList<string> ObservationGaps { get; } = new[] { "browser-direct-transport-mix" };

    /// <summary>The stable reason categories, in contract order.</summary>
    public static IReadOnlyList<string> All => Ordered;

    /// <summary>Reports whether a value is one of the stable categories.</summary>
    public static bool IsKnown(string? value) => value is not null && Known.Contains(value);

    /// <summary>
    /// The category a status code implies when a throw site has nothing more specific
    /// to say, so that adding a rejection path can never silently lose its reason.
    /// </summary>
    public static string DefaultForStatus(int statusCode) => statusCode switch
    {
        403 => DestinationForbidden,
        >= 500 => UpstreamError,
        _ => RequestInvalid,
    };
}

/// <summary>
/// One dependency-free metric update that can be bridged to Prometheus or
/// OpenTelemetry without FlexDoc owning a registry.
/// </summary>
public sealed record FlexDocHostExecutionMetric(
    string Name,
    string Kind,
    double Value,
    IReadOnlyDictionary<string, string> Labels);

/// <summary>The duration distribution for one observation window.</summary>
public sealed record FlexDocHostExecutionDurations
{
    /// <summary>How many durations the window retained.</summary>
    [JsonPropertyName("sampleCount")] public int SampleCount { get; init; }

    /// <summary>Whether retention was bounded by sampling rather than complete.</summary>
    [JsonPropertyName("sampled")] public bool Sampled { get; init; }

    /// <summary>Fastest retained execution, in milliseconds.</summary>
    [JsonPropertyName("minMs")] public double MinMs { get; init; }

    /// <summary>Median retained execution, in milliseconds.</summary>
    [JsonPropertyName("p50Ms")] public double P50Ms { get; init; }

    /// <summary>95th percentile of retained executions, in milliseconds.</summary>
    [JsonPropertyName("p95Ms")] public double P95Ms { get; init; }

    /// <summary>99th percentile of retained executions, in milliseconds.</summary>
    [JsonPropertyName("p99Ms")] public double P99Ms { get; init; }

    /// <summary>Slowest retained execution, in milliseconds.</summary>
    [JsonPropertyName("maxMs")] public double MaxMs { get; init; }
}

/// <summary>The aggregate for one observation window.</summary>
public sealed record FlexDocHostExecutionSnapshot
{
    /// <summary>When the window first observed anything, or null if it observed nothing.</summary>
    [JsonPropertyName("windowStart")] public string? WindowStart { get; init; }

    /// <summary>When the window last observed anything, or null if it observed nothing.</summary>
    [JsonPropertyName("windowEnd")] public string? WindowEnd { get; init; }

    /// <summary>Validated envelopes that began executing.</summary>
    [JsonPropertyName("startedExecutions")] public int StartedExecutions { get; init; }

    /// <summary>Requests that never carried the execute marker.</summary>
    [JsonPropertyName("unmarkedRequests")] public int UnmarkedRequests { get; init; }

    /// <summary>Executions that reached a terminal outcome.</summary>
    [JsonPropertyName("completedExecutions")] public int CompletedExecutions { get; init; }

    /// <summary>Completion counts by outcome.</summary>
    [JsonPropertyName("outcomes")] public IReadOnlyDictionary<string, int> Outcomes { get; init; } =
        new Dictionary<string, int>();

    /// <summary>Executions currently in flight.</summary>
    [JsonPropertyName("inFlight")] public int InFlight { get; init; }

    /// <summary>Highest concurrent in-flight count seen in the window.</summary>
    [JsonPropertyName("peakInFlight")] public int PeakInFlight { get; init; }

    /// <summary>Policy rejections by stable reason.</summary>
    [JsonPropertyName("rejectionsByReason")] public IReadOnlyDictionary<string, int> RejectionsByReason { get; init; } =
        new Dictionary<string, int>();

    /// <summary>Upstream and internal failures by stable reason.</summary>
    [JsonPropertyName("errorsByReason")] public IReadOnlyDictionary<string, int> ErrorsByReason { get; init; } =
        new Dictionary<string, int>();

    /// <summary>Duration distribution, or null before the first completion duration.</summary>
    [JsonPropertyName("durations")] public FlexDocHostExecutionDurations? Durations { get; init; }
}

/// <summary>The operator export document.</summary>
public sealed record FlexDocHostExecutionObservationReport
{
    /// <summary>The shared export schema identifier.</summary>
    [JsonPropertyName("schema")] public string Schema { get; init; } =
        FlexDocHostExecutionReasons.ObservationSchema;

    /// <summary>When the document was produced.</summary>
    [JsonPropertyName("generatedAt")] public string GeneratedAt { get; init; } = string.Empty;

    /// <summary>Which FlexDoc runtime produced it.</summary>
    [JsonPropertyName("runtime")] public string Runtime { get; init; } = "dotnet";

    /// <summary>The aggregate for the window.</summary>
    [JsonPropertyName("observation")] public FlexDocHostExecutionSnapshot Observation { get; init; } = new();

    /// <summary>Evidence this document cannot contain, declared rather than implied.</summary>
    [JsonPropertyName("gaps")] public IReadOnlyList<string> Gaps { get; init; } = Array.Empty<string>();
}

/// <summary>
/// Aggregates host-execution evidence for one window.
/// </summary>
/// <remarks>
/// <para>
/// Only counters and durations are retained. No URL, header, body, credential or
/// per-request timestamp reaches this recorder, so the aggregate cannot carry
/// request content by construction.
/// </para>
/// <para>
/// Durations are retained up to the sample capacity and then replaced by reservoir
/// sampling, so memory stays bounded for a host that runs indefinitely while
/// percentiles stay representative of the whole window rather than only its
/// opening. Counts stay exact regardless.
/// </para>
/// </remarks>
public sealed class FlexDocHostExecutionObservation
{
    private readonly object _gate = new();
    private readonly int _capacity;
    private readonly Func<DateTimeOffset> _clock;
    private readonly Func<double> _random;
    private readonly List<double> _durations;
    private Dictionary<string, int> _outcomes = NewOutcomes();
    private Dictionary<string, int> _rejections = new(StringComparer.Ordinal);
    private Dictionary<string, int> _errors = new(StringComparer.Ordinal);
    private DateTimeOffset? _windowStart;
    private DateTimeOffset? _windowEnd;
    private int _started;
    private int _unmarked;
    private int _completed;
    private int _inFlight;
    private int _peakInFlight;
    private long _observedDurations;

    /// <summary>
    /// Creates a recorder retaining at most <paramref name="durationSampleCapacity"/>
    /// durations before uniform sampling begins.
    /// </summary>
    public FlexDocHostExecutionObservation(int durationSampleCapacity = 8192)
        : this(durationSampleCapacity, null, null)
    {
    }

    internal FlexDocHostExecutionObservation(
        int durationSampleCapacity,
        Func<DateTimeOffset>? clock,
        Func<double>? random)
    {
        _capacity = Math.Max(1, durationSampleCapacity);
        _clock = clock ?? (() => DateTimeOffset.UtcNow);
        _random = random ?? Random.Shared.NextDouble;
        _durations = new List<double>(Math.Min(_capacity, 1024));
    }

    /// <summary>
    /// A sink that folds updates into this recorder, usable directly as the
    /// executor's metric sink from concurrent request handlers.
    /// </summary>
    public Action<FlexDocHostExecutionMetric> Sink => Record;

    /// <summary>Discards all counts and starts a new window.</summary>
    public void Reset()
    {
        lock (_gate)
        {
            _windowStart = null;
            _windowEnd = null;
            _started = 0;
            _unmarked = 0;
            _completed = 0;
            _inFlight = 0;
            _peakInFlight = 0;
            _observedDurations = 0;
            _outcomes = NewOutcomes();
            _rejections = new Dictionary<string, int>(StringComparer.Ordinal);
            _errors = new Dictionary<string, int>(StringComparer.Ordinal);
            _durations.Clear();
        }
    }

    /// <summary>Folds one metric update into the aggregate.</summary>
    public void Record(FlexDocHostExecutionMetric metric)
    {
        ArgumentNullException.ThrowIfNull(metric);

        lock (_gate)
        {
            var timestamp = _clock();
            _windowStart ??= timestamp;
            _windowEnd = timestamp;

            switch (metric.Name)
            {
                case "flexdoc_execute_requests_total":
                    _started++;
                    break;
                case "flexdoc_execute_in_flight":
                    _inFlight = Math.Max(0, _inFlight + (int)metric.Value);
                    _peakInFlight = Math.Max(_peakInFlight, _inFlight);
                    break;
                case "flexdoc_execute_completions_total":
                    _completed++;
                    if (Label(metric, "outcome") is { } outcome && _outcomes.ContainsKey(outcome))
                        _outcomes[outcome]++;
                    break;
                case "flexdoc_execute_rejections_total":
                    Tally(_rejections, Label(metric, "reason"));
                    break;
                case "flexdoc_execute_unmarked_total":
                    // Deliberately not folded into rejections: those describe validated
                    // envelopes, and merging the two would double-count attempts.
                    _unmarked++;
                    break;
                case "flexdoc_execute_errors_total":
                    Tally(_errors, Label(metric, "reason"));
                    break;
                case "flexdoc_execute_duration_seconds":
                    RecordDuration(metric.Value);
                    break;
            }
        }
    }

    /// <summary>Returns the current aggregate; safe to call at any time.</summary>
    public FlexDocHostExecutionSnapshot Snapshot()
    {
        lock (_gate)
        {
            var snapshot = new FlexDocHostExecutionSnapshot
            {
                WindowStart = Format(_windowStart),
                WindowEnd = Format(_windowEnd),
                StartedExecutions = _started,
                UnmarkedRequests = _unmarked,
                CompletedExecutions = _completed,
                Outcomes = new Dictionary<string, int>(_outcomes, StringComparer.Ordinal),
                InFlight = _inFlight,
                PeakInFlight = _peakInFlight,
                RejectionsByReason = new Dictionary<string, int>(_rejections, StringComparer.Ordinal),
                ErrorsByReason = new Dictionary<string, int>(_errors, StringComparer.Ordinal),
            };

            if (_durations.Count == 0) return snapshot;

            var ordered = _durations.ToArray();
            Array.Sort(ordered);
            return snapshot with
            {
                Durations = new FlexDocHostExecutionDurations
                {
                    SampleCount = ordered.Length,
                    Sampled = _observedDurations > ordered.Length,
                    MinMs = ordered[0],
                    P50Ms = Percentile(ordered, 0.5),
                    P95Ms = Percentile(ordered, 0.95),
                    P99Ms = Percentile(ordered, 0.99),
                    MaxMs = ordered[^1],
                },
            };
        }
    }

    /// <summary>
    /// Builds the operator export document.
    /// </summary>
    /// <remarks>
    /// The document is aggregate-only and is meant to be written to disk or handed to
    /// an operator; FlexDoc never transmits it. Browser-direct executions never reach
    /// an API host, so the transport mix cannot be derived here, and that gap is
    /// declared so a review cannot mistake this document for complete evidence.
    /// </remarks>
    public FlexDocHostExecutionObservationReport Report() => new()
    {
        Schema = FlexDocHostExecutionReasons.ObservationSchema,
        GeneratedAt = _clock().ToUniversalTime().ToString("o", CultureInfo.InvariantCulture),
        Runtime = "dotnet",
        Observation = Snapshot(),
        Gaps = FlexDocHostExecutionReasons.ObservationGaps,
    };

    private void RecordDuration(double seconds)
    {
        var milliseconds = Math.Max(0, seconds * 1000);
        _observedDurations++;
        if (_durations.Count < _capacity)
        {
            _durations.Add(milliseconds);
            return;
        }

        var candidate = (int)(_random() * _observedDurations);
        if (candidate < _capacity) _durations[candidate] = milliseconds;
    }

    private static void Tally(Dictionary<string, int> counts, string? reason)
    {
        // An unknown reason is dropped rather than tallied: the whole point of the
        // vocabulary is that these keys stay low-cardinality and comparable.
        if (!FlexDocHostExecutionReasons.IsKnown(reason)) return;
        counts[reason!] = counts.TryGetValue(reason!, out var current) ? current + 1 : 1;
    }

    private static string? Label(FlexDocHostExecutionMetric metric, string name)
        => metric.Labels.TryGetValue(name, out var value) ? value : null;

    private static Dictionary<string, int> NewOutcomes() => new(StringComparer.Ordinal)
    {
        ["success"] = 0,
        ["rejected"] = 0,
        ["error"] = 0,
    };

    private static string? Format(DateTimeOffset? instant)
        => instant?.ToUniversalTime().ToString("o", CultureInfo.InvariantCulture);

    private static double Percentile(double[] sorted, double fraction)
    {
        if (sorted.Length == 1) return sorted[0];
        var rank = (int)Math.Ceiling(fraction * sorted.Length);
        return sorted[Math.Clamp(rank, 1, sorted.Length) - 1];
    }
}
