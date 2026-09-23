using System.Text.RegularExpressions;

namespace Prauga.FlexDoc.AspNetCore;

/// <summary>
/// Ports the Node runtime-contract validator. Path-parameter names are ignored for route identity.
/// Acknowledged undocumented routes stay registered and are reported as informational findings.
/// </summary>
internal static class AspNetContractValidation
{
    internal static Dictionary<string, object?> Validate(
        IReadOnlyList<AspNetRuntimeIntelligence.RuntimeRoute> documentedRoutes,
        IReadOnlyList<AspNetRuntimeIntelligence.RuntimeRoute> runtimeRoutes,
        bool discoveryComplete,
        IReadOnlyList<AspNetRuntimeIntelligence.RuntimeRoute> acknowledgedUndocumented)
    {
        var documentedKeys = documentedRoutes.Select(ExactShapeKey).ToHashSet(StringComparer.Ordinal);
        var runtimeKeys = runtimeRoutes.Select(ExactShapeKey).ToHashSet(StringComparer.Ordinal);
        var acknowledgedKeys = acknowledgedUndocumented.Select(ExactShapeKey).ToHashSet(StringComparer.Ordinal);
        var findings = new List<Dictionary<string, object?>>();
        var documentedMethods = GroupedMethods(documentedRoutes);
        var runtimeMethods = GroupedMethods(runtimeRoutes);
        var methodMismatchShapes = new HashSet<string>(StringComparer.Ordinal);

        foreach (var (shape, expectedMethods) in documentedMethods)
        {
            if (!runtimeMethods.TryGetValue(shape, out var observedMethods)) continue;
            if (expectedMethods.Any(observedMethods.Contains)) continue;
            methodMismatchShapes.Add(shape);
            var path = RepresentativePath(documentedRoutes, shape);
            findings.Add(Finding(
                "runtime.method-mismatch",
                null,
                path,
                discoveryComplete ? "error" : "warning",
                expectedMethods[0],
                $"Runtime route {path} is registered for different HTTP methods than OpenAPI documents.",
                expectedMethods,
                observedMethods,
                null));
        }

        foreach (var route in runtimeRoutes)
        {
            var shape = RouteShape(route.Path);
            if (methodMismatchShapes.Contains(shape) || documentedKeys.Contains(ExactShapeKey(route))) continue;
            var acknowledged = acknowledgedKeys.Contains(ExactShapeKey(route));
            findings.Add(Finding(
                "runtime.operation-undocumented",
                route.Method,
                route.Path,
                acknowledged ? "info" : discoveryComplete ? "error" : "warning",
                route.Method,
                $"Runtime implements {route.Method} {route.Path}, but OpenAPI does not document that operation.",
                "Operation is represented in OpenAPI",
                acknowledged
                    ? "Operation exists only in the running backend and is acknowledged"
                    : "Operation exists only in the running backend",
                acknowledged ? "acknowledged" : null));
        }

        foreach (var route in documentedRoutes)
        {
            var shape = RouteShape(route.Path);
            if (methodMismatchShapes.Contains(shape) || runtimeKeys.Contains(ExactShapeKey(route))) continue;
            findings.Add(Finding(
                "runtime.operation-unobserved",
                route.Method,
                route.Path,
                discoveryComplete ? "error" : "info",
                route.Method,
                discoveryComplete
                    ? $"OpenAPI documents {route.Method} {route.Path}, but the running backend does not expose that operation."
                    : $"OpenAPI documents {route.Method} {route.Path}, but it was not observed during partial runtime discovery.",
                "Operation is exposed by the running backend",
                discoveryComplete ? "No matching runtime operation exists" : "No matching operation was observed during partial discovery",
                null));
        }

        findings.Sort(static (left, right) =>
        {
            var severity = SeverityRank(Text(left, "severity")).CompareTo(SeverityRank(Text(right, "severity")));
            if (severity != 0) return severity;
            var path = string.Compare(Location(left, "path"), Location(right, "path"), StringComparison.Ordinal);
            if (path != 0) return path;
            var method = string.Compare(Location(left, "method"), Location(right, "method"), StringComparison.Ordinal);
            if (method != 0) return method;
            return string.Compare(Text(left, "code"), Text(right, "code"), StringComparison.Ordinal);
        });

        var errors = findings.Count(finding => Text(finding, "severity") == "error");
        var warnings = findings.Count(finding => Text(finding, "severity") == "warning");
        var info = findings.Count - errors - warnings;
        var status = errors > 0 ? "fail" : warnings > 0 ? "warn" : !discoveryComplete ? "partial" : "pass";
        return new Dictionary<string, object?>
        {
            ["status"] = status,
            ["complete"] = discoveryComplete,
            ["findings"] = findings,
            ["summary"] = new Dictionary<string, object?>
            {
                ["total"] = findings.Count,
                ["errors"] = errors,
                ["warnings"] = warnings,
                ["info"] = info,
            },
        };
    }

    private static Dictionary<string, object?> Finding(
        string code,
        string? idMethod,
        string path,
        string severity,
        string? locationMethod,
        string message,
        object expected,
        object observed,
        string? disposition)
    {
        var location = new Dictionary<string, object?> { ["kind"] = "operation", ["path"] = path };
        if (locationMethod is not null) location["method"] = locationMethod;
        var finding = new Dictionary<string, object?>
        {
            ["id"] = $"{code}:{(idMethod is null ? "" : idMethod + ":")}{RouteShape(path)}",
            ["code"] = code,
            ["severity"] = severity,
            ["location"] = location,
            ["message"] = message,
            ["expected"] = expected,
            ["observed"] = observed,
        };
        if (disposition is not null) finding["disposition"] = disposition;
        return finding;
    }

    private static string Text(Dictionary<string, object?> finding, string key) => (string)finding[key]!;

    private static string Location(Dictionary<string, object?> finding, string key)
    {
        var location = (Dictionary<string, object?>)finding["location"]!;
        return location.TryGetValue(key, out var value) && value is string text ? text : "";
    }

    private static int SeverityRank(string severity) => severity switch
    {
        "error" => 0,
        "warning" => 1,
        _ => 2,
    };

    private static Dictionary<string, List<string>> GroupedMethods(IReadOnlyList<AspNetRuntimeIntelligence.RuntimeRoute> routes)
    {
        var grouped = new Dictionary<string, SortedSet<string>>(StringComparer.Ordinal);
        foreach (var route in routes)
        {
            if (!grouped.TryGetValue(RouteShape(route.Path), out var methods))
            {
                methods = new SortedSet<string>(StringComparer.Ordinal);
                grouped[RouteShape(route.Path)] = methods;
            }
            methods.Add(route.Method.ToUpperInvariant());
        }
        return grouped.ToDictionary(
            entry => entry.Key,
            entry => entry.Value.ToList(),
            StringComparer.Ordinal);
    }

    private static string RepresentativePath(IReadOnlyList<AspNetRuntimeIntelligence.RuntimeRoute> routes, string shape)
    {
        foreach (var route in routes)
        {
            if (RouteShape(route.Path) == shape) return route.Path;
        }
        return shape;
    }

    private static string ExactShapeKey(AspNetRuntimeIntelligence.RuntimeRoute route)
        => $"{route.Method.ToUpperInvariant()} {RouteShape(route.Path)}";

    private static string RouteShape(string path) => Regex.Replace(path, @"\{[^/{}]+\}", "{}");
}
