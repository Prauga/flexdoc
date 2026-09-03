# Prauga FlexDoc for ASP.NET Core

Self-contained ASP.NET Core integration for FlexDoc. The NuGet package embeds the canonical FlexDoc browser renderer; it does not reimplement OpenAPI rendering in C# and does not require a CDN at runtime.

## Package

```text
Prauga.FlexDoc.AspNetCore 0.1.0
```

The library targets `net8.0`, so it can be consumed by supported ASP.NET Core applications on .NET 8 and later runtimes.

## Usage

```csharp
using Prauga.FlexDoc.AspNetCore;

var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

// Your application or OpenAPI package exposes this document.
// For .NET 9+ this can be ASP.NET Core's built-in OpenAPI endpoint;
// Swashbuckle, NSwag, or any other OpenAPI producer works too.
app.MapFlexDoc(options =>
{
    options.Path = "/docs";
    options.SpecUrl = "/openapi/v1.json";
    options.Title = "My API";
    options.TryItEnabled = true;
});

app.Run();
```

FlexDoc serves the docs shell at `/docs` and version-fingerprinted renderer assets beneath `/docs/__flexdoc/`. ASP.NET Core endpoint routing also accepts the equivalent trailing-slash request `/docs/`; CI exercises both forms. The HTML shell is `no-cache`; renderer JS/CSS are immutable and self-hosted.

The integration only needs an OpenAPI JSON URL. It deliberately has no dependency on Swashbuckle, NSwag, or a particular OpenAPI generator.
