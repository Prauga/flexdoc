namespace Prauga.FlexDoc.AspNetCore;

/// <summary>Configuration for the self-hosted FlexDoc ASP.NET Core endpoint.</summary>
public sealed class FlexDocOptions
{
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
}
