using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.AspNetCore.Routing.Patterns;

namespace Prauga.FlexDoc.AspNetCore;

internal static class AspNetRuntimeIntelligence
{
    private static readonly HashSet<string> HttpMethods = new(StringComparer.OrdinalIgnoreCase)
    {
        "GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD", "TRACE",
    };

    internal readonly record struct RuntimeRoute(string Method, string Path);

    internal static JsonElement OpenApiDocumentElement(object value)
    {
        ArgumentNullException.ThrowIfNull(value);
        if (value is JsonElement element) return element.Clone();
        if (value is JsonDocument document) return document.RootElement.Clone();
        if (value is string json)
        {
            using var parsed = JsonDocument.Parse(json);
            return parsed.RootElement.Clone();
        }
        return JsonSerializer.SerializeToElement(value);
    }

    internal static Dictionary<string, object?> BuildSnapshot(
        IEnumerable<Endpoint> endpoints,
        JsonElement openApiDocument,
        HttpContext context,
        string docsPath,
        string specUrl)
    {
        var discovery = DiscoverRoutes(endpoints, docsPath, specUrl);
        var documented = DocumentedRoutes(openApiDocument);
        var documentedKeys = documented.Select(RouteKey).ToHashSet(StringComparer.Ordinal);
        var runtimeKeys = discovery.Routes.Select(RouteKey).ToHashSet(StringComparer.Ordinal);
        var runtimeOnly = discovery.Routes.Where(route => !documentedKeys.Contains(RouteKey(route))).ToArray();
        var documentedOnly = documented.Where(route => !runtimeKeys.Contains(RouteKey(route))).ToArray();
        var matched = discovery.Routes.Count(route => documentedKeys.Contains(RouteKey(route)));
        var frameworkVersion = typeof(RouteEndpoint).Assembly.GetName().Version?.ToString();

        var snapshot = new Dictionary<string, object?>
        {
            ["framework"] = "aspnetcore",
            ["runtime"] = new Dictionary<string, object?>
            {
                ["name"] = "dotnet",
                ["version"] = Environment.Version.ToString(),
                ["platform"] = PlatformName(),
                ["arch"] = RuntimeInformation.ProcessArchitecture.ToString().ToLowerInvariant(),
            },
            ["discoveryComplete"] = discovery.Complete,
            ["routes"] = discovery.Routes.Select(RouteObject).ToArray(),
            ["runtimeOnly"] = runtimeOnly.Select(RouteObject).ToArray(),
            ["documentedOnly"] = documentedOnly.Select(RouteObject).ToArray(),
            ["summary"] = new Dictionary<string, object?>
            {
                ["documented"] = documented.Count,
                ["runtime"] = discovery.Routes.Count,
                ["matched"] = matched,
                ["runtimeOnly"] = runtimeOnly.Length,
                ["documentedOnly"] = documentedOnly.Length,
            },
        };
        if (!string.IsNullOrWhiteSpace(frameworkVersion)) snapshot["frameworkVersion"] = frameworkVersion;
        if (context.Request.Host.HasValue)
            snapshot["serverOrigin"] = $"{context.Request.Scheme}://{context.Request.Host.Value}";
        return snapshot;
    }

    internal static (IReadOnlyList<RuntimeRoute> Routes, bool Complete) DiscoverRoutes(
        IEnumerable<Endpoint> endpoints,
        string docsPath,
        string specUrl)
    {
        var routes = new List<RuntimeRoute>();
        var complete = true;
        var normalizedDocs = NormalizePath(docsPath);
        var normalizedSpec = SpecPath(specUrl);

        foreach (var endpoint in endpoints)
        {
            if (endpoint is not RouteEndpoint routeEndpoint)
            {
                complete = false;
                continue;
            }

            var routePath = NormalizeRoutePattern(routeEndpoint.RoutePattern);
            if (routePath is null)
            {
                complete = false;
                continue;
            }
            if (IsExcluded(routePath, normalizedDocs, normalizedSpec)) continue;

            var methodMetadata = endpoint.Metadata.GetMetadata<IHttpMethodMetadata>();
            if (methodMetadata is null || methodMetadata.HttpMethods.Count == 0)
            {
                complete = false;
                continue;
            }

            foreach (var rawMethod in methodMetadata.HttpMethods)
            {
                var method = rawMethod.ToUpperInvariant();
                if (!HttpMethods.Contains(method))
                {
                    complete = false;
                    continue;
                }
                routes.Add(new RuntimeRoute(method, routePath));
            }
        }

        return (WithoutImplicitHead(UniqueSorted(routes)), complete);
    }

    internal static IReadOnlyList<RuntimeRoute> DocumentedRoutes(JsonElement openApiDocument)
    {
        var routes = new List<RuntimeRoute>();
        if (openApiDocument.ValueKind != JsonValueKind.Object
            || !openApiDocument.TryGetProperty("paths", out var paths)
            || paths.ValueKind != JsonValueKind.Object)
            return routes;

        foreach (var path in paths.EnumerateObject())
        {
            if (path.Value.ValueKind != JsonValueKind.Object) continue;
            foreach (var operation in path.Value.EnumerateObject())
            {
                var method = operation.Name.ToUpperInvariant();
                if (!HttpMethods.Contains(method)) continue;
                routes.Add(new RuntimeRoute(method, NormalizePath(path.Name)));
            }
        }
        return UniqueSorted(routes);
    }

    internal static string? NormalizeRoutePattern(RoutePattern pattern)
    {
        if (pattern.PathSegments.Count == 0) return "/";
        var segments = new List<string>(pattern.PathSegments.Count);
        foreach (var segment in pattern.PathSegments)
        {
            var builder = new StringBuilder();
            foreach (var part in segment.Parts)
            {
                switch (part)
                {
                    case RoutePatternLiteralPart literal:
                        builder.Append(literal.Content);
                        break;
                    case RoutePatternSeparatorPart separator:
                        builder.Append(separator.Content);
                        break;
                    case RoutePatternParameterPart parameter:
                        builder.Append('{').Append(parameter.Name).Append('}');
                        break;
                    default:
                        return null;
                }
            }
            segments.Add(builder.ToString());
        }
        return NormalizePath('/' + string.Join('/', segments));
    }

    private static IReadOnlyList<RuntimeRoute> UniqueSorted(IEnumerable<RuntimeRoute> routes)
        => routes
            .Distinct()
            .OrderBy(route => route.Path, StringComparer.Ordinal)
            .ThenBy(route => route.Method, StringComparer.Ordinal)
            .ToArray();

    private static IReadOnlyList<RuntimeRoute> WithoutImplicitHead(IReadOnlyList<RuntimeRoute> routes)
    {
        var keys = routes.Select(RouteKey).ToHashSet(StringComparer.Ordinal);
        return routes.Where(route => route.Method != "HEAD" || !keys.Contains($"GET {route.Path}")).ToArray();
    }

    private static string RouteKey(RuntimeRoute route) => $"{route.Method} {route.Path}";

    private static Dictionary<string, string> RouteObject(RuntimeRoute route) => new()
    {
        ["method"] = route.Method,
        ["path"] = route.Path,
    };

    private static bool IsExcluded(string path, string docsPath, string? specPath)
        => path == docsPath || path.StartsWith(docsPath + '/', StringComparison.Ordinal)
            || (specPath is not null && path == specPath);

    private static string? SpecPath(string specUrl)
    {
        if (Uri.TryCreate(specUrl, UriKind.Absolute, out var absolute)) return NormalizePath(absolute.AbsolutePath);
        var value = specUrl.Split('?', '#')[0].Trim();
        if (value.Length == 0) return null;
        return NormalizePath(value);
    }

    private static string NormalizePath(string value)
    {
        var path = value.Trim();
        if (!path.StartsWith('/')) path = '/' + path;
        while (path.Contains("//", StringComparison.Ordinal)) path = path.Replace("//", "/", StringComparison.Ordinal);
        if (path.Length > 1 && path.EndsWith('/')) path = path[..^1];
        return path.Length == 0 ? "/" : path;
    }

    private static string PlatformName()
    {
        if (OperatingSystem.IsWindows()) return "windows";
        if (OperatingSystem.IsLinux()) return "linux";
        if (OperatingSystem.IsMacOS()) return "macos";
        if (OperatingSystem.IsFreeBSD()) return "freebsd";
        return RuntimeInformation.OSDescription;
    }
}
