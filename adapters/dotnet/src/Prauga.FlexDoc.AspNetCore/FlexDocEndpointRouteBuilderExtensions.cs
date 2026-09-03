using System.Text.Encodings.Web;
using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace Prauga.FlexDoc.AspNetCore;

/// <summary>ASP.NET Core endpoint routing integration for FlexDoc.</summary>
public static class FlexDocEndpointRouteBuilderExtensions
{
    /// <summary>Mounts FlexDoc using default options.</summary>
    public static RouteGroupBuilder MapFlexDoc(this IEndpointRouteBuilder endpoints)
        => endpoints.MapFlexDoc(static _ => { });

    /// <summary>Mounts FlexDoc and configures its docs route and OpenAPI source.</summary>
    public static RouteGroupBuilder MapFlexDoc(
        this IEndpointRouteBuilder endpoints,
        Action<FlexDocOptions> configure)
    {
        ArgumentNullException.ThrowIfNull(endpoints);
        ArgumentNullException.ThrowIfNull(configure);

        var options = new FlexDocOptions();
        configure(options);
        Validate(options);

        var path = NormalizePath(options.Path);
        endpoints.MapGet(path, context => WriteHtml(context, options, path));

        var group = endpoints.MapGroup(path);
        group.MapGet("/__flexdoc/renderer.js", context => WriteAsset(
            context,
            static () => RendererAssets.JavaScript,
            "application/javascript; charset=utf-8"));
        group.MapGet("/__flexdoc/renderer.css", context => WriteAsset(
            context,
            static () => RendererAssets.CssText,
            "text/css; charset=utf-8"));
        return group;
    }

    private static async Task WriteHtml(HttpContext context, FlexDocOptions options, string path)
    {
        try
        {
            var html = CreateHtml(options, path);
            context.Response.StatusCode = StatusCodes.Status200OK;
            context.Response.ContentType = "text/html; charset=utf-8";
            context.Response.Headers.CacheControl = "no-cache";
            await context.Response.WriteAsync(html, context.RequestAborted);
        }
        catch (InvalidOperationException)
        {
            context.Response.StatusCode = StatusCodes.Status500InternalServerError;
            context.Response.ContentType = "text/plain; charset=utf-8";
            context.Response.Headers.CacheControl = "no-cache";
            await context.Response.WriteAsync("FlexDoc renderer asset unavailable", context.RequestAborted);
        }
    }

    private static async Task WriteAsset(
        HttpContext context,
        Func<ReadOnlyMemory<byte>> bodyFactory,
        string contentType)
    {
        try
        {
            var body = bodyFactory();
            context.Response.StatusCode = StatusCodes.Status200OK;
            context.Response.ContentType = contentType;
            context.Response.Headers.CacheControl = "public, max-age=31536000, immutable";
            context.Response.ContentLength = body.Length;
            await context.Response.Body.WriteAsync(body, context.RequestAborted);
        }
        catch (InvalidOperationException)
        {
            context.Response.StatusCode = StatusCodes.Status500InternalServerError;
            context.Response.ContentType = "text/plain; charset=utf-8";
            context.Response.Headers.CacheControl = "no-cache";
            await context.Response.WriteAsync("FlexDoc renderer asset unavailable", context.RequestAborted);
        }
    }

    private static string CreateHtml(FlexDocOptions options, string path)
    {
        var rendererOptions = new
        {
            contractVersion = "1",
            title = options.Title,
            theme = options.Theme,
            tryIt = new { enabled = options.TryItEnabled },
        };
        var specUrl = SafeJson(options.SpecUrl);
        var serializedOptions = SafeJson(rendererOptions);
        var title = HtmlEncoder.Default.Encode(options.Title);
        var assetPath = HtmlEncoder.Default.Encode(path);
        var version = RendererAssets.Fingerprint;

        const string template = """<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>@@TITLE@@</title><link rel="stylesheet" href="@@PATH@@/__flexdoc/renderer.css?v=@@VERSION@@"></head><body><div id="flexdoc-root"></div><script>window.__FLEXDOC_SPEC_URL__=@@SPEC_URL@@;window.__FLEXDOC_OPTIONS__=@@OPTIONS@@;</script><script src="@@PATH@@/__flexdoc/renderer.js?v=@@VERSION@@"></script><script>(async function(){const root=document.getElementById('flexdoc-root');try{const baseUri=new URL(window.__FLEXDOC_SPEC_URL__,window.location.href).toString();const response=await fetch(baseUri);if(!response.ok)throw new Error('Unable to load OpenAPI specification: HTTP '+response.status);const spec=await response.json();const config={spec:spec,options:window.__FLEXDOC_OPTIONS__||{},baseUri:baseUri};if(window.FlexDocStandalone.mountAsync)await window.FlexDocStandalone.mountAsync(root,config);else window.FlexDocStandalone.mount(root,config);}catch(error){root.textContent=error instanceof Error?error.message:String(error);}})();</script></body></html>""";

        return template
            .Replace("@@TITLE@@", title, StringComparison.Ordinal)
            .Replace("@@PATH@@", assetPath, StringComparison.Ordinal)
            .Replace("@@VERSION@@", version, StringComparison.Ordinal)
            .Replace("@@SPEC_URL@@", specUrl, StringComparison.Ordinal)
            .Replace("@@OPTIONS@@", serializedOptions, StringComparison.Ordinal);
    }

    private static string SafeJson<T>(T value)
    {
        return JsonSerializer.Serialize(value)
            .Replace("<", "\\u003c", StringComparison.Ordinal)
            .Replace(">", "\\u003e", StringComparison.Ordinal)
            .Replace("&", "\\u0026", StringComparison.Ordinal)
            .Replace("\u2028", "\\u2028", StringComparison.Ordinal)
            .Replace("\u2029", "\\u2029", StringComparison.Ordinal)
            .Replace("\\u003C", "\\u003c", StringComparison.Ordinal)
            .Replace("\\u003E", "\\u003e", StringComparison.Ordinal)
            .Replace("\\u0026", "\\u0026", StringComparison.Ordinal);
    }

    private static string NormalizePath(string path)
    {
        var value = path.Trim();
        if (value.Length == 0) return "/docs";
        value = "/" + value.Trim('/');
        return value == "/" ? "/docs" : value;
    }

    private static void Validate(FlexDocOptions options)
    {
        if (string.IsNullOrWhiteSpace(options.SpecUrl))
            throw new ArgumentException("FlexDoc SpecUrl cannot be empty.", nameof(options));
        if (string.IsNullOrWhiteSpace(options.Title))
            throw new ArgumentException("FlexDoc Title cannot be empty.", nameof(options));
        if (options.Theme is not ("system" or "light" or "dark"))
            throw new ArgumentException("FlexDoc Theme must be system, light, or dark.", nameof(options));
    }
}
