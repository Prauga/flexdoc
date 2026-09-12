using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.Extensions.DependencyInjection;
using Prauga.FlexDoc.AspNetCore;

internal static class HostExecutionConformance
{
    public static async Task RunAsync()
    {
        var upstreamBuilder = WebApplication.CreateBuilder();
        upstreamBuilder.WebHost.UseUrls("http://127.0.0.1:0");
        await using var upstream = upstreamBuilder.Build();

        upstream.MapMethods("/echo/{**rest}", new[] { "GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS" }, async context =>
        {
            using var reader = new StreamReader(context.Request.Body, Encoding.UTF8, leaveOpen: true);
            var body = await reader.ReadToEndAsync(context.RequestAborted);
            var rawTarget = context.Features.Get<IHttpRequestFeature>()?.RawTarget ?? string.Empty;
            await context.Response.WriteAsJsonAsync(new
            {
                rawTarget,
                query = context.Request.Query.ToDictionary(static pair => pair.Key, static pair => pair.Value.ToString()),
                authorization = context.Request.Headers["Authorization"].ToString(),
                origin = context.Request.Headers["Origin"].ToString(),
                custom = context.Request.Headers["X-FlexDoc-Test"].ToString(),
                contentType = context.Request.ContentType ?? string.Empty,
                body,
            }, context.RequestAborted);
        });
        upstream.MapMethods("/redirect", new[] { "GET", "POST" }, context =>
        {
            context.Response.StatusCode = StatusCodes.Status302Found;
            context.Response.Headers.Location = "/echo/redirected?from=redirect";
            return Task.CompletedTask;
        });
        upstream.MapGet("/cross-origin", context =>
        {
            context.Response.StatusCode = StatusCodes.Status302Found;
            context.Response.Headers.Location = "http://example.com/";
            return Task.CompletedTask;
        });
        upstream.MapGet("/large", async context =>
        {
            var data = new byte[(10 * 1024 * 1024) + 1];
            context.Response.ContentLength = data.Length;
            await context.Response.Body.WriteAsync(data, context.RequestAborted);
        });
        upstream.MapGet("/slow", async context =>
        {
            try
            {
                await context.Response.Body.WriteAsync(Encoding.UTF8.GetBytes("partial"), context.RequestAborted);
                await context.Response.Body.FlushAsync(context.RequestAborted);
                await Task.Delay(500, context.RequestAborted);
                await context.Response.WriteAsync("done", context.RequestAborted);
            }
            catch (OperationCanceledException)
            {
                // Expected when the host executor enforces its full-response deadline.
            }
        });

        await upstream.StartAsync();
        var upstreamOrigin = ServerOrigin(upstream);

        var hostExecution = new FlexDocHostExecution(new[] { upstreamOrigin });
        var metadataExecution = new FlexDocHostExecution(new[] { "http://169.254.169.254" });

        var docsBuilder = WebApplication.CreateBuilder();
        docsBuilder.WebHost.UseUrls("http://127.0.0.1:0");
        await using var docs = docsBuilder.Build();
        docs.MapFlexDoc(options =>
        {
            options.Path = "/docs";
            options.SpecUrl = "/openapi.json";
            options.TryItHostExecution = true;
            options.HostExecution = hostExecution;
        });
        docs.MapFlexDoc(options =>
        {
            options.Path = "/unavailable";
            options.SpecUrl = "/openapi.json";
            options.TryItHostExecution = true;
        });
        docs.MapFlexDoc(options =>
        {
            options.Path = "/metadata";
            options.SpecUrl = "/openapi.json";
            options.TryItHostExecution = true;
            options.HostExecution = metadataExecution;
        });

        await docs.StartAsync();
        var docsOrigin = ServerOrigin(docs);
        using var client = new HttpClient { BaseAddress = new Uri(docsOrigin) };

        var docsHtml = await client.GetStringAsync("/docs");
        Check(docsHtml.Contains("\"hostExecution\":{\"available\":true", StringComparison.Ordinal), "configured native executor must advertise available:true");
        Check(docsHtml.Contains("\"endpoint\":\"/docs/__flexdoc/execute\"", StringComparison.Ordinal), "configured native executor must advertise canonical execute endpoint");

        using (var noMarkerContent = new StringContent("{}", Encoding.UTF8, "application/json"))
        using (var noMarker = await client.PostAsync("/docs/__flexdoc/execute", noMarkerContent))
        {
            Check(noMarker.StatusCode == HttpStatusCode.Forbidden, "execute route must require X-FlexDoc-Execute: 1");
        }

        using (var unavailableContent = new StringContent("{}", Encoding.UTF8, "application/json"))
        using (var unavailable = await client.PostAsync("/unavailable/__flexdoc/execute", unavailableContent))
        {
            Check(unavailable.StatusCode == HttpStatusCode.NotFound, "host execution route must remain unregistered without a real executor");
        }

        var executeEnvelope = new
        {
            request = new
            {
                method = "POST",
                url = upstreamOrigin + "/echo/a%2Fb?existing=1",
                query = new[] { new { key = "q", value = "hello world", enabled = true } },
                headers = new[]
                {
                    new { key = "Origin", value = "https://browser.example", enabled = true },
                    new { key = "X-FlexDoc-Test", value = "preserved", enabled = true },
                },
                bodyMode = "json",
                body = "{\"ok\":true}",
                contentType = "application/json",
                auth = new { type = "apiKey", @in = "query", key = "api_key", value = "secret" },
            },
            timeoutMs = 5000,
        };
        var execute = await SendJsonExecuteAsync(client, "/docs/__flexdoc/execute", executeEnvelope);
        Check(execute.Status == HttpStatusCode.OK, "canonical JSON execute request must succeed");
        var executeBody = execute.Json.GetProperty("body").GetString() ?? string.Empty;
        using (var echoedDocument = JsonDocument.Parse(executeBody))
        {
            var echoed = echoedDocument.RootElement;
            Check(echoed.GetProperty("rawTarget").GetString()?.Contains("%2Fb", StringComparison.OrdinalIgnoreCase) == true, "encoded request path must remain encoded");
            Check(echoed.GetProperty("query").GetProperty("q").GetString() == "hello world", "draft query parameters must be preserved");
            Check(echoed.GetProperty("query").GetProperty("api_key").GetString() == "secret", "query API key must be applied");
            Check(echoed.GetProperty("origin").GetString() == string.Empty, "unsafe Origin header must be stripped");
            Check(echoed.GetProperty("custom").GetString() == "preserved", "safe custom header must be preserved");
            Check(echoed.GetProperty("body").GetString() == "{\"ok\":true}", "JSON request body must be forwarded");
        }

        var redirectEnvelope = new
        {
            request = new
            {
                method = "GET",
                url = upstreamOrigin + "/redirect",
                auth = new { type = "apiKey", @in = "query", key = "api_key", value = "redirect-secret" },
            },
            timeoutMs = 5000,
        };
        var redirect = await SendJsonExecuteAsync(client, "/docs/__flexdoc/execute", redirectEnvelope);
        Check(redirect.Status == HttpStatusCode.OK, "same-origin redirect must succeed");
        using (var redirectedDocument = JsonDocument.Parse(redirect.Json.GetProperty("body").GetString() ?? "{}"))
        {
            var redirected = redirectedDocument.RootElement;
            Check(redirected.GetProperty("query").GetProperty("api_key").GetString() == "redirect-secret", "query auth must be reapplied across redirects");
            Check(redirected.GetProperty("query").GetProperty("from").GetString() == "redirect", "redirect query must be preserved");
        }

        var multipartDescriptor = new
        {
            request = new
            {
                method = "POST",
                url = upstreamOrigin + "/echo/upload",
                bodyMode = "formdata",
                formData = new object[]
                {
                    new { key = "upload", type = "file", enabled = true, fileName = "fallback.bin", contentType = "application/octet-stream" },
                    new { key = "note", type = "text", enabled = true, value = "hello" },
                },
            },
            timeoutMs = 5000,
        };
        using (var multipart = new MultipartFormDataContent())
        {
            multipart.Add(new StringContent(JsonSerializer.Serialize(multipartDescriptor), Encoding.UTF8, "application/json"), "descriptor");
            var file = new ByteArrayContent(new byte[] { 0, 1, 2, 3 });
            file.Headers.TryAddWithoutValidation("Content-Type", "application/octet-stream");
            multipart.Add(file, "formData[0]", "actual.bin");
            var multipartResult = await SendExecuteAsync(client, "/docs/__flexdoc/execute", multipart);
            Check(multipartResult.Status == HttpStatusCode.OK, "canonical multipart execute request must succeed");
            using var multipartEchoDocument = JsonDocument.Parse(multipartResult.Json.GetProperty("body").GetString() ?? "{}");
            var multipartEcho = multipartEchoDocument.RootElement;
            Check(multipartEcho.GetProperty("contentType").GetString()?.StartsWith("multipart/form-data", StringComparison.OrdinalIgnoreCase) == true, "outgoing form-data must use multipart content type");
            var multipartBody = multipartEcho.GetProperty("body").GetString() ?? string.Empty;
            Check(multipartBody.Contains("actual.bin", StringComparison.Ordinal), "uploaded file metadata must be forwarded");
            Check(multipartBody.Contains("hello", StringComparison.Ordinal), "text form field must be forwarded");
        }

        using (var malformed = new ByteArrayContent(new byte[] { (byte)'{', (byte)'\"', (byte)'x', (byte)'\"', (byte)':', (byte)'\"', 0xff, (byte)'\"', (byte)'}' }))
        {
            malformed.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("application/json");
            var malformedResult = await SendExecuteAsync(client, "/docs/__flexdoc/execute", malformed);
            Check(malformedResult.Status == HttpStatusCode.BadRequest, "malformed UTF-8 JSON must be rejected");
            Check(malformedResult.Json.GetProperty("error").GetString()?.Contains("valid UTF-8 JSON object", StringComparison.Ordinal) == true, "malformed UTF-8 error must be canonical");
        }

        var unsupportedAuth = await SendJsonExecuteAsync(client, "/docs/__flexdoc/execute", new
        {
            request = new
            {
                method = "GET",
                url = upstreamOrigin + "/echo/auth",
                auth = new { type = "digest" },
            },
        });
        Check(unsupportedAuth.Status == HttpStatusCode.BadRequest, "unsupported advanced auth must fail closed");

        var crossOrigin = await SendJsonExecuteAsync(client, "/docs/__flexdoc/execute", new
        {
            request = new { method = "GET", url = upstreamOrigin + "/cross-origin" },
            timeoutMs = 5000,
        });
        Check(crossOrigin.Status == HttpStatusCode.Forbidden, "cross-origin redirects must be rejected");

        var metadata = await SendJsonExecuteAsync(client, "/metadata/__flexdoc/execute", new
        {
            request = new { method = "GET", url = "http://169.254.169.254/latest/meta-data" },
            timeoutMs = 5000,
        });
        Check(metadata.Status == HttpStatusCode.Forbidden, "link-local metadata targets must be rejected before connection");

        var large = await SendJsonExecuteAsync(client, "/docs/__flexdoc/execute", new
        {
            request = new { method = "GET", url = upstreamOrigin + "/large" },
            timeoutMs = 5000,
        });
        Check(large.Status == HttpStatusCode.BadGateway, "responses larger than 10 MiB must be bounded");
        Check(large.Json.GetProperty("error").GetString()?.Contains("10 MiB safety limit", StringComparison.Ordinal) == true, "response-size error must be canonical");

        var slow = await SendJsonExecuteAsync(client, "/docs/__flexdoc/execute", new
        {
            request = new { method = "GET", url = upstreamOrigin + "/slow" },
            timeoutMs = 100,
        });
        Check(slow.Status == HttpStatusCode.BadGateway, "full-response timeout must return 502");
        Check(slow.Json.GetProperty("error").GetString()?.Contains("timed out after 100 ms", StringComparison.Ordinal) == true, "timeout error must include the enforced deadline");

        Console.WriteLine(".NET native host-execution conformance contracts passed.");
    }

    private static async Task<(HttpStatusCode Status, JsonElement Json)> SendJsonExecuteAsync(
        HttpClient client,
        string path,
        object envelope)
    {
        using var content = JsonContent.Create(envelope);
        return await SendExecuteAsync(client, path, content);
    }

    private static async Task<(HttpStatusCode Status, JsonElement Json)> SendExecuteAsync(
        HttpClient client,
        string path,
        HttpContent content)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, path) { Content = content };
        request.Headers.TryAddWithoutValidation("X-FlexDoc-Execute", "1");
        using var response = await client.SendAsync(request);
        var payload = await response.Content.ReadAsByteArrayAsync();
        using var document = JsonDocument.Parse(payload);
        return (response.StatusCode, document.RootElement.Clone());
    }

    private static string ServerOrigin(WebApplication app)
    {
        var server = app.Services.GetRequiredService<IServer>();
        var addresses = server.Features.Get<IServerAddressesFeature>()?.Addresses
            ?? throw new InvalidOperationException("Kestrel server addresses unavailable.");
        return addresses.Single();
    }

    private static void Check(bool condition, string message)
    {
        if (!condition) throw new InvalidOperationException(message);
    }
}
