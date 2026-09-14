using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Prauga.FlexDoc.AspNetCore;

internal static class HostExecutionSecurityConformance
{
    public static async Task RunAsync()
    {
        var builder = WebApplication.CreateBuilder();
        builder.WebHost.UseUrls("http://127.0.0.1:0");
        await using var app = builder.Build();

        app.MapFlexDoc(options =>
        {
            options.Path = "/security";
            options.SpecUrl = "/openapi.json";
            options.TryItHostExecution = true;
            options.HostExecution = new FlexDocHostExecution(new[] { "https://api.example.test" });
        });
        app.MapFlexDoc(options =>
        {
            options.Path = "/mapped-metadata";
            options.SpecUrl = "/openapi.json";
            options.TryItHostExecution = true;
            options.HostExecution = new FlexDocHostExecution(new[] { "http://[::ffff:169.254.169.254]" });
        });

        await app.StartAsync();
        var origin = app.Urls.Single(static url => url.StartsWith("http://127.0.0.1:", StringComparison.Ordinal));
        using var client = new HttpClient { BaseAddress = new Uri(origin) };

        var unsafeHeader = await SendJsonAsync(client, "/security/__flexdoc/execute", new
        {
            request = new
            {
                method = "GET",
                url = "https://api.example.test/resource",
                auth = new { type = "apiKey", @in = "header", key = "Host", value = "evil.example" },
            },
        });
        Check(unsafeHeader.Status == HttpStatusCode.BadRequest, "unsafe auth-injected header names must fail before transport");

        var crlfHeader = await SendJsonAsync(client, "/security/__flexdoc/execute", new
        {
            request = new
            {
                method = "GET",
                url = "https://api.example.test/resource",
                auth = new { type = "apiKey", @in = "header", key = "X-Api-Key", value = "secret\r\nX-Evil: yes" },
            },
        });
        Check(crlfHeader.Status == HttpStatusCode.BadRequest, "CRLF auth-injected header values must fail before transport");

        var mappedMetadata = await SendJsonAsync(client, "/mapped-metadata/__flexdoc/execute", new
        {
            request = new { method = "GET", url = "http://[::ffff:169.254.169.254]/latest/meta-data" },
        });
        Check(mappedMetadata.Status == HttpStatusCode.Forbidden, "IPv4-mapped IPv6 metadata destinations must be blocked");

        using var multipart = new MultipartFormDataContent();
        multipart.Add(new StringContent(JsonSerializer.Serialize(new
        {
            request = new
            {
                method = "POST",
                url = "https://api.example.test/upload",
                bodyMode = "formdata",
                formData = new[]
                {
                    new
                    {
                        key = "upload",
                        type = "file",
                        enabled = true,
                        fileName = "payload.txt",
                        contentType = "text/plain\r\nX-Evil: yes",
                    },
                },
            },
        }), Encoding.UTF8, "application/json"), "descriptor");
        var file = new ByteArrayContent(Encoding.UTF8.GetBytes("payload"));
        multipart.Add(file, "formData[0]", "payload.txt");
        using var multipartRequest = new HttpRequestMessage(HttpMethod.Post, "/security/__flexdoc/execute") { Content = multipart };
        multipartRequest.Headers.TryAddWithoutValidation("X-FlexDoc-Execute", "1");
        using var multipartResponse = await client.SendAsync(multipartRequest);
        Check(multipartResponse.StatusCode == HttpStatusCode.BadRequest, "derived multipart file content types containing CRLF must be rejected");
    }

    private static async Task<(HttpStatusCode Status, JsonElement Json)> SendJsonAsync(HttpClient client, string path, object envelope)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, path)
        {
            Content = JsonContent.Create(envelope),
        };
        request.Headers.TryAddWithoutValidation("X-FlexDoc-Execute", "1");
        using var response = await client.SendAsync(request);
        var bytes = await response.Content.ReadAsByteArrayAsync();
        using var document = JsonDocument.Parse(bytes);
        return (response.StatusCode, document.RootElement.Clone());
    }

    private static void Check(bool condition, string message)
    {
        if (!condition) throw new InvalidOperationException(message);
    }
}
