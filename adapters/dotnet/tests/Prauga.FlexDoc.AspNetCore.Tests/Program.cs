using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Prauga.FlexDoc.AspNetCore;

static JsonElement RendererOptions(FlexDocOptions options)
{
    var html = FlexDocEndpointRouteBuilderExtensions.CreateHtml(options, "/docs");
    const string prefix = "window.__FLEXDOC_OPTIONS__=";
    var start = html.IndexOf(prefix, StringComparison.Ordinal) + prefix.Length;
    var end = html.IndexOf(";</script>", start, StringComparison.Ordinal);
    return JsonDocument.Parse(html[start..end]).RootElement.Clone();
}

static void Check(bool condition, string message)
{
    if (!condition) throw new InvalidOperationException(message);
}

var defaults = RendererOptions(new FlexDocOptions());
Check(!defaults.TryGetProperty("expand", out _), "expand must be omitted by default");
Check(!defaults.TryGetProperty("runtimeIntelligence", out _), "runtime intelligence must be omitted by default");
Check(defaults.GetProperty("tryIt").GetProperty("enabled").GetBoolean(), "tryIt.enabled must be present");

var configured = new FlexDocOptions
{
    Title = "API </script><script>alert(1)</script>",
    SpecUrl = "/openapi.json?x=</script>",
    Expand = new[] { "parameters", "tryIt" },
    TryItDefaultServer = "https://gateway.example.test",
    TryItCredentials = "include",
    TryItApiClientPersistenceKey = false,
    TryItHostExecution = true,
};
var configuredHtml = FlexDocEndpointRouteBuilderExtensions.CreateHtml(configured, "/docs");
var options = RendererOptions(configured);
Check(options.GetProperty("expand").GetArrayLength() == 2, "expand list must serialize as JSON array");
var tryIt = options.GetProperty("tryIt");
Check(tryIt.GetProperty("defaultServer").GetString() == "https://gateway.example.test", "defaultServer must be nested under tryIt");
Check(tryIt.GetProperty("credentials").GetString() == "include", "credentials must be nested under tryIt");
Check(tryIt.GetProperty("apiClientPersistenceKey").ValueKind == JsonValueKind.False, "persistence false must be JSON false");
var hostExecution = tryIt.GetProperty("hostExecution");
Check(!hostExecution.GetProperty("available").GetBoolean(), "native host execution must advertise unavailable");
Check(hostExecution.GetProperty("endpoint").GetString() == "/docs/__flexdoc/execute", "native host execution endpoint shape");
Check(hostExecution.GetProperty("capabilities").GetArrayLength() == 0, "native host execution capabilities must be empty");
Check(!configuredHtml.Contains("</script><script>alert(1)</script>", StringComparison.Ordinal), "title must remain script-safe");
Check(!configuredHtml.Contains("\"/openapi.json?x=</script>\"", StringComparison.Ordinal), "spec URL must remain script-safe");

var runtimeSpec = new
{
    openapi = "3.0.3",
    paths = new Dictionary<string, object>
    {
        ["/orders/{orderId}"] = new { get = new { } },
        ["/missing"] = new { post = new { } },
    },
};
var runtimeConfig = new FlexDocOptions
{
    RuntimeIntelligence = true,
    RuntimeOpenApiDocument = runtimeSpec,
};
var runtimeHtml = FlexDocEndpointRouteBuilderExtensions.CreateHtml(runtimeConfig, "/docs");
var runtimeRendererOptions = RendererOptions(runtimeConfig);
var runtimePublic = runtimeRendererOptions.GetProperty("runtimeIntelligence");
Check(runtimePublic.GetProperty("available").GetBoolean(), "runtime intelligence must advertise available");
Check(runtimePublic.GetProperty("endpoint").GetString() == "/docs/__flexdoc/runtime", "runtime endpoint must be public");
Check(runtimePublic.GetProperty("framework").GetString() == "aspnetcore", "runtime framework must be ASP.NET Core");
Check(!runtimeHtml.Contains("/missing", StringComparison.Ordinal), "server-only runtime OpenAPI document must not be serialized into renderer options");

var builder = WebApplication.CreateBuilder();
var app = builder.Build();
app.MapGet("/orders/{orderId:int}", () => Results.Ok());
app.MapPost("/internal", () => Results.Ok());
app.MapGet("/openapi.json", () => Results.Ok());
app.MapGet("/docs", () => Results.Ok());
var context = new DefaultHttpContext();
context.Request.Scheme = "https";
context.Request.Host = new HostString("api.example.test");
context.Connection.LocalPort = 8443;
var originalEnvironment = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT");
Environment.SetEnvironmentVariable("ASPNETCORE_ENVIRONMENT", "Staging");
try
{
    var openApiElement = AspNetRuntimeIntelligence.OpenApiDocumentElement(runtimeSpec);
    var snapshot = AspNetRuntimeIntelligence.BuildSnapshot(
        ((IEndpointRouteBuilder)app).DataSources.SelectMany(static source => source.Endpoints),
        openApiElement,
        context,
        "/docs",
        "/openapi.json");
    var snapshotJson = JsonSerializer.SerializeToElement(snapshot);
    Check(snapshotJson.GetProperty("framework").GetString() == "aspnetcore", "snapshot framework must be ASP.NET Core");
    Check(snapshotJson.GetProperty("runtime").GetProperty("name").GetString() == "dotnet", "snapshot runtime must be dotnet");
    Check(snapshotJson.GetProperty("serverOrigin").GetString() == "https://api.example.test", "snapshot origin must come from the request");
    Check(snapshotJson.GetProperty("server").GetProperty("localPort").GetInt32() == 8443, "snapshot must expose only the backend listener port");
    Check(snapshotJson.GetProperty("environment").GetProperty("name").GetString() == "Staging", "snapshot must expose the standard ASP.NET environment name");
    Check(snapshotJson.GetProperty("discoveryComplete").GetBoolean(), "known HTTP endpoint discovery should be complete");
    var runtimeOnly = snapshotJson.GetProperty("runtimeOnly");
    Check(runtimeOnly.GetArrayLength() == 1, "one runtime-only endpoint expected");
    Check(runtimeOnly[0].GetProperty("method").GetString() == "POST" && runtimeOnly[0].GetProperty("path").GetString() == "/internal", "runtime-only endpoint must be /internal");
    var documentedOnly = snapshotJson.GetProperty("documentedOnly");
    Check(documentedOnly.GetArrayLength() == 1, "one documented-only endpoint expected");
    Check(documentedOnly[0].GetProperty("path").GetString() == "/missing", "documented-only endpoint must be /missing");
    var discoveredRoutes = snapshotJson.GetProperty("routes");
    Check(discoveredRoutes.EnumerateArray().Any(route => route.GetProperty("path").GetString() == "/orders/{orderId}"), "ASP.NET route constraints must normalize to OpenAPI parameter syntax");
    Check(!discoveredRoutes.EnumerateArray().Any(route => route.GetProperty("path").GetString() == "/openapi.json"), "OpenAPI infrastructure must be excluded");
    Check(!discoveredRoutes.EnumerateArray().Any(route => route.GetProperty("path").GetString() == "/docs"), "FlexDoc infrastructure must be excluded");
}
finally
{
    Environment.SetEnvironmentVariable("ASPNETCORE_ENVIRONMENT", originalEnvironment);
}

await HostExecutionConformance.RunAsync();
await HostExecutionSecurityConformance.RunAsync();

Console.WriteLine(".NET FlexDoc renderer, Runtime Intelligence, and host-execution contracts passed.");
