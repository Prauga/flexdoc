# Prauga FlexDoc for ASP.NET Core

Self-contained ASP.NET Core integration for FlexDoc. The NuGet package embeds the canonical FlexDoc browser renderer; it does not reimplement OpenAPI rendering in C# and does not require a CDN at runtime.

## Package

```text
Prauga.FlexDoc.AspNetCore 0.6.0
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

`FlexDocOptions` also exposes `Expand`, `TryItDefaultServer`, `TryItCredentials`, and `TryItApiClientPersistenceKey`. `Expand` accepts a preset string or string list, while the persistence key accepts a string or `false`; unset values are omitted from renderer options.

FlexDoc serves the docs shell at `/docs` and version-fingerprinted renderer assets beneath `/docs/__flexdoc/`. ASP.NET Core endpoint routing also accepts the equivalent trailing-slash request `/docs/`; CI exercises both forms. The HTML shell is `no-cache`; renderer JS/CSS are immutable and self-hosted.

The basic docs integration only needs an OpenAPI JSON URL and deliberately has no dependency on Swashbuckle, NSwag, or a particular OpenAPI generator.

## Native API-host execution (3.3)

ASP.NET Core can execute the existing FlexDoc request envelope natively instead of falling back to browser transport. First configure application authentication/authorization middleware or an upstream policy so both the docs shell and docs subtree are protected. Then configure an explicit exact-origin allowlist, acknowledge that protection boundary, and attach the executor to the existing docs mapping:

```csharp
var hostExecution = new FlexDocHostExecution(new[]
{
    "https://api.example.internal",
});

app.MapFlexDoc(options =>
{
    options.Path = "/docs";
    options.SpecUrl = "/openapi/v1.json";
    options.TryItEnabled = true;
    options.TryItHostExecution = true;
    options.HostExecutionProtected = true;
    options.HostExecution = hostExecution;
});
```

`HostExecutionProtected = true` is only an assertion that the application-owned authentication/authorization boundary exists; it does not install one. `MapFlexDoc` fails closed with `ArgumentException` when `TryItHostExecution` and a real `HostExecution` are configured without the acknowledgement. Setting `TryItHostExecution = true` without an executor remains valid, preserves `hostExecution.available: false`, and leaves the execute route unregistered (`404`).

When `TryItHostExecution`, `HostExecutionProtected`, and a real `HostExecution` are configured, FlexDoc registers `POST /docs/__flexdoc/execute` and truthfully advertises `hostExecution.available: true`. Protect both `/docs` and `/docs/**` with the application's normal authorization policy before setting the acknowledgement. The exact-origin allowlist and `X-FlexDoc-Execute: 1` are execution controls, not user authentication.

The ASP.NET Core host consumes the same canonical JSON or multipart envelope used by the Node/JVM/Python/Go hosts and FlexDoc Runner. It requires `X-FlexDoc-Execute: 1`, accepts only explicitly allowlisted HTTP(S) origins, strips unsafe transport headers, revalidates same-origin redirects, bounds incoming envelopes to 32 MiB and responses to 10 MiB, and enforces a full-response deadline. Basic, Bearer, OAuth2 bearer-token, and header/query API-key request auth are supported as request-draft features.

The execute endpoint disables Kestrel's lower default request-body ceiling **for that route only** so FlexDoc's own 32 MiB bounded reader remains the deterministic application limit. Reverse proxies, gateways, or application middleware may intentionally enforce a smaller limit; those remain deployment-owned boundaries.

This first .NET slice intentionally advertises an empty host-only capability list. Session cookie jars, client certificates, Digest, Hawk, NTLM/Negotiate, OAuth 1.0, and AWS Signature V4 remain unavailable until implemented natively.

The executor validates DNS inside `SocketsHttpHandler.ConnectCallback` and connects directly to a validated IP address while preserving the original hostname for HTTP/TLS semantics. Link-local/cloud-metadata hostnames and DNS answers are rejected before connection, avoiding a DNS-preflight/connection-time resolution gap.

### Execution evidence

An executor that reports nothing leaves an operator guessing whether a failing Try It is a policy rejection, a slow upstream, or traffic that never carried an execute marker. Pass a metric sink to the executor to emit the same metric names, labels, and reason vocabulary as every other FlexDoc host, so one collector reads a mixed fleet:

```csharp
var evidence = new FlexDocHostExecutionObservation();
var hostExecution = new FlexDocHostExecution(
    new[] { "https://api.example.internal" },
    evidence.Sink);

// Whenever an operator asks for evidence:
var report = evidence.Report();
```

The sink receives `FlexDocHostExecutionMetric` values carrying a name, kind, value, and labels, and nothing else: no URL, header, body, or credential reaches it. Bridge it to `System.Diagnostics.Metrics`, `prometheus-net`, or OpenTelemetry if the deployment has one; where it does not, `FlexDocHostExecutionObservation` folds the same updates into an aggregate and `Report()` produces the shared `flexdoc.host-execution.observation/1` document every other runtime also emits. The recorder is safe to share across concurrent requests, bounds memory with reservoir-sampled durations, and keeps counts exact regardless.

Every non-successful execution carries one of the stable categories in `FlexDocHostExecutionReasons`, which is why rejections and upstream failures are separable at all: the human-readable messages interpolate origins and field names, so they are unbounded and unusable as a metric label. Because each reason defaults from its status code, a rejection path added later cannot silently lose its category. Requests arriving without `X-FlexDoc-Execute` are counted by `flexdoc_execute_unmarked_total` and deliberately move no lifecycle metric, since they produced no validated envelope.

A sink that throws is caught: observability never decides whether an execution succeeds. The report declares `browser-direct-transport-mix` in its gaps, because a browser-direct execution never reaches this host and its transport mix cannot be derived here. See [host-execution observability](../../docs/host-execution-observability.md) for the full metric contract and the browser half of a review.

## Runtime Intelligence

ASP.NET Core can opt into FlexDoc 3.0 Runtime Intelligence using the live endpoint-routing data source:

```csharp
var openApiDocument = BuildMyOpenApiDocument();

app.MapFlexDoc(options =>
{
    options.Path = "/docs";
    options.SpecUrl = "/openapi/v1.json";
    options.RuntimeIntelligence = true;
    options.RuntimeOpenApiDocument = openApiDocument;
});
```

`RuntimeOpenApiDocument` is server-only and is never serialized into the browser bootstrap. It can be a serializable OpenAPI object, `JsonElement`/`JsonDocument`, or a JSON string. FlexDoc requires it when Runtime Intelligence is enabled so the adapter can compare the live `EndpointDataSource` with the exact document without making a server-side HTTP request or depending on one OpenAPI generator. Route constraints such as `{id:int}` are normalized to `{id}` before comparison; FlexDoc's own docs subtree and the configured OpenAPI route are excluded.

The runtime endpoint is `GET /docs/__flexdoc/runtime`, returns `Cache-Control: no-store`, and reports ASP.NET Core/.NET metadata, request-derived server origin, implemented-but-undocumented routes, documented-but-not-observed routes, and discovery completeness.

Runtime discovery can expose intentionally undocumented endpoints. The ASP.NET Core adapter relies on application authorization middleware or upstream access control rather than a FlexDoc-native docs-auth option, so protect the docs subtree before enabling Runtime Intelligence on non-private documentation.