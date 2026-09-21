using System.Collections.Concurrent;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.Extensions.DependencyInjection;
using Prauga.FlexDoc.AspNetCore;

internal static class HostExecutionObservabilityConformance
{
    public static async Task RunAsync()
    {
        CheckReasonVocabulary();
        CheckStatusDefaults();
        await CheckExecutorEmissionAsync();
        CheckRecorderAggregation();
        CheckPercentiles();
        CheckSamplingBound();
        CheckReset();
        CheckReportShape();
        CheckConcurrentRecording();
    }

    // The reason vocabulary is a cross-runtime contract, not a .NET detail: a
    // collector written against any other FlexDoc host must read these labels
    // unchanged.
    private static void CheckReasonVocabulary()
    {
        var expected = new[]
        {
            "marker-missing", "execution-disabled", "admission-saturated", "destination-forbidden",
            "redirect-forbidden", "body-malformed", "body-too-large", "unsupported-media-type",
            "request-invalid", "auth-unsupported", "upstream-timeout", "upstream-unreachable",
            "upstream-error",
        };
        Check(FlexDocHostExecutionReasons.All.SequenceEqual(expected), "reason vocabulary and order must match every other runtime");
        Check(FlexDocHostExecutionReasons.IsKnown("upstream-timeout"), "known reason must be recognized");
        Check(!FlexDocHostExecutionReasons.IsKnown("slow"), "unknown reason must be rejected");
        Check(!FlexDocHostExecutionReasons.IsKnown(null), "null reason must be rejected");
        Check(
            FlexDocHostExecutionReasons.ObservationSchema == "flexdoc.host-execution.observation/1",
            "export schema identifier must match every other runtime");
    }

    // A throw site that forgets its reason must still produce a usable category
    // rather than silently degrading the export.
    private static void CheckStatusDefaults()
    {
        Check(FlexDocHostExecutionReasons.DefaultForStatus(403) == "destination-forbidden", "403 must default to destination-forbidden");
        Check(FlexDocHostExecutionReasons.DefaultForStatus(502) == "upstream-error", "5xx must default to upstream-error");
        Check(FlexDocHostExecutionReasons.DefaultForStatus(400) == "request-invalid", "4xx must default to request-invalid");
    }

    private static async Task CheckExecutorEmissionAsync()
    {
        var metrics = new ConcurrentQueue<FlexDocHostExecutionMetric>();
        var blockedOrigin = "http://127.0.0.1:" + ClosedPort().ToString();

        var builder = WebApplication.CreateBuilder();
        builder.WebHost.UseUrls("http://127.0.0.1:0");
        await using var app = builder.Build();
        app.MapFlexDoc(options =>
        {
            options.Path = "/docs";
            options.SpecUrl = "/openapi.json";
            options.TryItHostExecution = true;
            options.HostExecutionProtected = true;
            options.HostExecution = new FlexDocHostExecution(new[] { blockedOrigin }, metrics.Enqueue);
        });

        // A sink that throws must not change any response the executor produces.
        app.MapFlexDoc(options =>
        {
            options.Path = "/hostile";
            options.SpecUrl = "/openapi.json";
            options.TryItHostExecution = true;
            options.HostExecutionProtected = true;
            options.HostExecution = new FlexDocHostExecution(
                new[] { blockedOrigin },
                _ => throw new InvalidOperationException("collector down"));
        });

        await app.StartAsync();
        using var client = new HttpClient { BaseAddress = new Uri(ServerOrigin(app)) };

        using (var unmarkedContent = new StringContent("{}", Encoding.UTF8, "application/json"))
        using (var unmarked = await client.PostAsync("/docs/__flexdoc/execute", unmarkedContent))
        {
            Check(unmarked.StatusCode == HttpStatusCode.Forbidden, "unmarked request must still be forbidden");
        }

        var unmarkedMetrics = Drain(metrics);
        Check(unmarkedMetrics.Count == 1, "an unmarked request must emit exactly one metric");
        Check(unmarkedMetrics[0].Name == "flexdoc_execute_unmarked_total", "unmarked requests must use their own counter");
        Check(unmarkedMetrics[0].Labels["reason"] == "marker-missing", "unmarked requests must carry marker-missing");

        var rejected = await ExecuteAsync(client, "/docs/__flexdoc/execute", new
        {
            request = new { method = "GET", url = "http://blocked.example.test/pets" },
        });
        Check(rejected == HttpStatusCode.Forbidden, "a disallowed origin must be rejected");

        var rejectionMetrics = Drain(metrics);
        var rejection = Single(rejectionMetrics, "flexdoc_execute_rejections_total");
        Check(rejection.Labels["reason"] == "destination-forbidden", "a disallowed origin must be destination-forbidden");
        Check(rejection.Labels["statusCode"] == "403", "rejections must carry their status code");
        Check(rejection.Labels["source"] == "route", "rejections must declare their source");
        Check(!rejectionMetrics.Any(metric => metric.Name == "flexdoc_execute_errors_total"), "a policy rejection is not an upstream error");
        Check(Single(rejectionMetrics, "flexdoc_execute_completions_total").Labels["outcome"] == "rejected", "rejection must complete as rejected");
        Check(rejectionMetrics.Any(metric => metric.Name == "flexdoc_execute_duration_seconds"), "every completion must record a duration");
        Check(GaugeSum(rejectionMetrics) == 0, "the in-flight gauge must return to zero");

        var malformed = await ExecuteAsync(client, "/docs/__flexdoc/execute", "not an object");
        Check(malformed == HttpStatusCode.BadRequest, "a non-object envelope must be rejected");
        Check(
            Single(Drain(metrics), "flexdoc_execute_rejections_total").Labels["reason"] == "body-malformed",
            "a malformed envelope must be separable from a policy rejection");

        var unreachable = await ExecuteAsync(client, "/docs/__flexdoc/execute", new
        {
            request = new { method = "GET", url = blockedOrigin + "/pets" },
        });
        Check(unreachable == HttpStatusCode.BadGateway, "an unreachable upstream must be a gateway failure");

        var failureMetrics = Drain(metrics);
        Check(
            Single(failureMetrics, "flexdoc_execute_errors_total").Labels["reason"] == "upstream-unreachable",
            "a refused connection must be upstream-unreachable");
        Check(!failureMetrics.Any(metric => metric.Name == "flexdoc_execute_rejections_total"), "an upstream failure is not a policy rejection");
        Check(Single(failureMetrics, "flexdoc_execute_completions_total").Labels["outcome"] == "error", "upstream failure must complete as error");
        Check(GaugeSum(failureMetrics) == 0, "the in-flight gauge must return to zero after a failure");

        var hostile = await ExecuteAsync(client, "/hostile/__flexdoc/execute", new
        {
            request = new { method = "GET", url = "http://blocked.example.test/pets" },
        });
        Check(hostile == HttpStatusCode.Forbidden, "a throwing sink must not change the response");
    }

    private static void CheckRecorderAggregation()
    {
        var recorder = new FlexDocHostExecutionObservation();
        recorder.Record(Metric("flexdoc_execute_requests_total", "counter", 1));
        recorder.Record(Metric("flexdoc_execute_in_flight", "gauge", 1));
        recorder.Record(Metric("flexdoc_execute_in_flight", "gauge", 1));
        recorder.Record(Metric("flexdoc_execute_in_flight", "gauge", -1));
        recorder.Record(Metric("flexdoc_execute_completions_total", "counter", 1, ("outcome", "rejected")));
        recorder.Record(Metric("flexdoc_execute_rejections_total", "counter", 1, ("reason", "destination-forbidden")));
        recorder.Record(Metric("flexdoc_execute_errors_total", "counter", 1, ("reason", "upstream-timeout")));
        recorder.Record(Metric("flexdoc_execute_unmarked_total", "counter", 1, ("reason", "marker-missing")));
        recorder.Record(Metric("flexdoc_execute_errors_total", "counter", 1, ("reason", "not-a-reason")));

        var snapshot = recorder.Snapshot();
        Check(snapshot.StartedExecutions == 1, "started executions must be counted");
        Check(snapshot.CompletedExecutions == 1, "completions must be counted");
        Check(snapshot.Outcomes["rejected"] == 1 && snapshot.Outcomes["success"] == 0, "outcomes must be tallied by label");
        Check(snapshot.InFlight == 1, "the gauge must track net in-flight work");
        Check(snapshot.PeakInFlight == 2, "the peak must survive a decrement");
        Check(snapshot.RejectionsByReason["destination-forbidden"] == 1, "rejections must be tallied by reason");
        Check(snapshot.ErrorsByReason.Count == 1, "an unknown reason must not be tallied");
        Check(snapshot.UnmarkedRequests == 1, "unmarked requests must stay outside the lifecycle counts");
        Check(snapshot.Durations is null, "no duration summary before the first completion duration");
        Check(snapshot.WindowStart is not null && snapshot.WindowEnd is not null, "an active window must be bounded");
    }

    private static void CheckPercentiles()
    {
        var recorder = new FlexDocHostExecutionObservation();
        for (var index = 1; index <= 100; index++)
            recorder.Record(Metric("flexdoc_execute_duration_seconds", "histogram", index / 1000.0, ("outcome", "success")));

        var durations = recorder.Snapshot().Durations;
        Check(durations is not null, "durations must be summarized once observed");
        Check(durations!.SampleCount == 100, "100 observations fit under the default capacity");
        Check(!durations.Sampled, "complete retention must not be declared as sampled");
        Check(Near(durations.MinMs, 1), "minimum must be exact");
        Check(Near(durations.P50Ms, 50), "p50 must be exact");
        Check(Near(durations.P95Ms, 95), "p95 must be exact");
        Check(Near(durations.P99Ms, 99), "p99 must be exact");
        Check(Near(durations.MaxMs, 100), "maximum must be exact");
    }

    private static void CheckSamplingBound()
    {
        var recorder = new FlexDocHostExecutionObservation(durationSampleCapacity: 16);
        for (var index = 0; index < 500; index++)
            recorder.Record(Metric("flexdoc_execute_duration_seconds", "histogram", 0.05));

        var durations = recorder.Snapshot().Durations;
        Check(durations!.SampleCount == 16, "capacity must bound retention");
        Check(durations.Sampled, "sampling must be declared past capacity");
    }

    private static void CheckReset()
    {
        var recorder = new FlexDocHostExecutionObservation();
        recorder.Record(Metric("flexdoc_execute_requests_total", "counter", 1));
        recorder.Reset();

        var snapshot = recorder.Snapshot();
        Check(snapshot.StartedExecutions == 0, "reset must discard counts");
        Check(snapshot.WindowStart is null, "reset must start a new window");
    }

    // The export is handed to operators and may be written to disk, so it must
    // carry no request content: only counts, timestamps and known category names.
    private static void CheckReportShape()
    {
        var recorder = new FlexDocHostExecutionObservation();
        recorder.Record(Metric("flexdoc_execute_requests_total", "counter", 1));
        recorder.Record(Metric(
            "flexdoc_execute_rejections_total",
            "counter",
            1,
            ("reason", "destination-forbidden"),
            ("target", "https://secret.internal/pets?token=abc")));
        recorder.Record(Metric("flexdoc_execute_duration_seconds", "histogram", 0.25));

        var report = recorder.Report();
        Check(report.Schema == "flexdoc.host-execution.observation/1", "report must declare the shared schema");
        Check(report.Runtime == "dotnet", "report must declare its runtime");
        Check(report.Gaps.SequenceEqual(new[] { "browser-direct-transport-mix" }), "report must declare the browser-direct gap");

        var rendered = JsonSerializer.Serialize(report);
        foreach (var leaked in new[] { "secret.internal", "token=abc", "/pets" })
            Check(!rendered.Contains(leaked, StringComparison.Ordinal), $"report leaked request content: {leaked}");

        using var document = JsonDocument.Parse(rendered);
        var observation = document.RootElement.GetProperty("observation");
        Check(observation.GetProperty("rejectionsByReason").GetProperty("destination-forbidden").GetInt32() == 1, "report must carry reason tallies");
        Check(observation.GetProperty("durations").GetProperty("sampleCount").GetInt32() == 1, "report must carry the duration summary");
    }

    // ASP.NET Core serves concurrently, so the aggregate is reachable from many
    // request threads at once and every update has to survive that.
    private static void CheckConcurrentRecording()
    {
        var recorder = new FlexDocHostExecutionObservation();
        Parallel.For(0, 2000, index =>
        {
            recorder.Record(Metric("flexdoc_execute_requests_total", "counter", 1));
            recorder.Record(Metric("flexdoc_execute_duration_seconds", "histogram", index / 100000.0));
        });

        var snapshot = recorder.Snapshot();
        Check(snapshot.StartedExecutions == 2000, "no concurrent update may be lost");
        Check(snapshot.Durations!.SampleCount == 2000, "all durations must be retained under the default capacity");
    }

    private static async Task<HttpStatusCode> ExecuteAsync(HttpClient client, string path, object envelope)
    {
        using var content = new StringContent(JsonSerializer.Serialize(envelope), Encoding.UTF8, "application/json");
        using var request = new HttpRequestMessage(HttpMethod.Post, path) { Content = content };
        request.Headers.Add("X-FlexDoc-Execute", "1");
        using var response = await client.SendAsync(request);
        return response.StatusCode;
    }

    // Bind then release so the port is almost certainly refused rather than open.
    private static int ClosedPort()
    {
        using var listener = new Socket(AddressFamily.InterNetwork, SocketType.Stream, ProtocolType.Tcp);
        listener.Bind(new IPEndPoint(IPAddress.Loopback, 0));
        return ((IPEndPoint)listener.LocalEndPoint!).Port;
    }

    private static FlexDocHostExecutionMetric Metric(
        string name,
        string kind,
        double value,
        params (string Key, string Value)[] labels)
        => new(name, kind, value, labels.ToDictionary(static pair => pair.Key, static pair => pair.Value, StringComparer.Ordinal));

    private static List<FlexDocHostExecutionMetric> Drain(ConcurrentQueue<FlexDocHostExecutionMetric> metrics)
    {
        var drained = new List<FlexDocHostExecutionMetric>();
        while (metrics.TryDequeue(out var metric)) drained.Add(metric);
        return drained;
    }

    private static FlexDocHostExecutionMetric Single(List<FlexDocHostExecutionMetric> metrics, string name)
    {
        var matches = metrics.Where(metric => metric.Name == name).ToList();
        Check(matches.Count == 1, $"expected exactly one {name}, saw {matches.Count}");
        return matches[0];
    }

    private static double GaugeSum(List<FlexDocHostExecutionMetric> metrics)
        => metrics.Where(metric => metric.Name == "flexdoc_execute_in_flight").Sum(metric => metric.Value);

    private static bool Near(double actual, double expected) => Math.Abs(actual - expected) < 0.001;

    private static string ServerOrigin(WebApplication app)
        => app.Services.GetRequiredService<IServer>()
            .Features.Get<IServerAddressesFeature>()!
            .Addresses.First();

    private static void Check(bool condition, string message)
    {
        if (!condition) throw new InvalidOperationException(message);
    }
}
