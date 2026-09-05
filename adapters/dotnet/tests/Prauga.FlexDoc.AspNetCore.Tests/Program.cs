using System.Text.Json;
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
Check(defaults.GetProperty("tryIt").GetProperty("enabled").GetBoolean(), "tryIt.enabled must be present");

var configured = new FlexDocOptions
{
    Title = "API </script><script>alert(1)</script>",
    SpecUrl = "/openapi.json?x=</script>",
    Expand = new[] { "parameters", "tryIt" },
    TryItDefaultServer = "https://gateway.example.test",
    TryItCredentials = "include",
    TryItApiClientPersistenceKey = false,
};
var configuredHtml = FlexDocEndpointRouteBuilderExtensions.CreateHtml(configured, "/docs");
var options = RendererOptions(configured);
Check(options.GetProperty("expand").GetArrayLength() == 2, "expand list must serialize as JSON array");
var tryIt = options.GetProperty("tryIt");
Check(tryIt.GetProperty("defaultServer").GetString() == "https://gateway.example.test", "defaultServer must be nested under tryIt");
Check(tryIt.GetProperty("credentials").GetString() == "include", "credentials must be nested under tryIt");
Check(tryIt.GetProperty("apiClientPersistenceKey").ValueKind == JsonValueKind.False, "persistence false must be JSON false");
Check(!configuredHtml.Contains("</script><script>alert(1)</script>", StringComparison.Ordinal), "title must remain script-safe");
Check(!configuredHtml.Contains("\"/openapi.json?x=</script>\"", StringComparison.Ordinal), "spec URL must remain script-safe");

Console.WriteLine(".NET FlexDoc renderer options contract passed.");
