namespace Prauga.FlexDoc.AspNetCore;

/// <summary>Configuration for the self-hosted FlexDoc ASP.NET Core endpoint.</summary>
public sealed class FlexDocOptions
{
    /// <summary>Creates options initialized with FlexDoc's ASP.NET Core defaults.</summary>
    public FlexDocOptions() { }

    /// <summary>Route where FlexDoc is mounted.</summary>
    public string Path { get; set; } = "/docs";

    /// <summary>OpenAPI JSON URL loaded by the canonical renderer.</summary>
    public string SpecUrl { get; set; } = "/openapi.json";

    /// <summary>Browser title and renderer title.</summary>
    public string Title { get; set; } = "API Reference";

    /// <summary>Initial theme: system, light, or dark.</summary>
    public string Theme { get; set; } = "system";

    /// <summary>Whether Try It and the API Client handoff are enabled.</summary>
    public bool TryItEnabled { get; set; } = true;

    /// <summary>Renderer expansion preset or explicit section list. Omit for compact defaults.</summary>
    public object? Expand { get; set; }

    /// <summary>Default Try It server URL.</summary>
    public string? TryItDefaultServer { get; set; }

    /// <summary>Fetch credentials mode: omit, same-origin, or include.</summary>
    public string? TryItCredentials { get; set; }

    /// <summary>API Client persistence key, or false to disable IndexedDB workspace persistence.</summary>
    public object? TryItApiClientPersistenceKey { get; set; }

    /// <summary>Advertise host-execution protocol metadata and register the route when a real executor is configured.</summary>
    public bool TryItHostExecution { get; set; }

    /// <summary>Native ASP.NET Core executor. A null executor keeps host execution unavailable and the execute route unregistered.</summary>
    public FlexDocHostExecution? HostExecution { get; set; }

    /// <summary>Explicit opt-in for live ASP.NET Core route discovery and OpenAPI presence drift.</summary>
    public bool RuntimeIntelligence { get; set; }

    /// <summary>
    /// Server-only OpenAPI document used for Runtime Intelligence comparison. Required when RuntimeIntelligence is enabled.
    /// Accepts a serializable OpenAPI object, JsonElement/JsonDocument, or JSON string and is never sent to the renderer.
    /// </summary>
    public object? RuntimeOpenApiDocument { get; set; }
}
