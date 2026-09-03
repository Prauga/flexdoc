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
}
