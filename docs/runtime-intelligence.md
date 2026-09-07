# Runtime Intelligence

FlexDoc 3.0 begins using information available because FlexDoc is installed inside the running backend rather than treating OpenAPI as the only source of truth.

## Framework coverage

Runtime Intelligence is **off by default** on every supported integration.

### Node

Enable it explicitly on the Node backend:

```ts
setupExpressFlexDoc(app, '/docs', {
  spec,
  options: {
    runtimeIntelligence: true,
  },
});
```

The same `runtimeIntelligence: true` option is supported by the Node Express, NestJS, Fastify, and Hono integrations. NestJS reports the underlying HTTP adapter discovered by the integration.

### Python / FastAPI

The Python adapter exposes native runtime integration through the FastAPI helper:

```python
from fastapi import FastAPI
from prauga_flexdoc import setup_fastapi_flexdoc

app = FastAPI(docs_url=None, redoc_url=None)
setup_fastapi_flexdoc(app, '/docs', runtime_intelligence=True)
```

This support is intentionally FastAPI-specific. Flask, Django, and generic ASGI/WSGI hosting do not advertise Runtime Intelligence yet because FlexDoc does not have a reliable framework-native route inventory for those integrations in this slice.

### ASP.NET Core

The .NET 8 adapter can inspect live endpoint routing without depending on a particular OpenAPI generator. Runtime Intelligence requires the exact server-side OpenAPI document object in addition to the browser-facing `SpecUrl`:

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

`RuntimeOpenApiDocument` is server-only. Requiring it lets FlexDoc compare live `EndpointDataSource` routes against the exact OpenAPI document without making an HTTP request back into the application or coupling the adapter to Swashbuckle, NSwag, or a version-specific OpenAPI provider.

When enabled, FlexDoc registers `GET <docsPath>/__flexdoc/runtime` under the documentation route. The renderer requests that endpoint and shows:

- the detected framework and framework version when available;
- runtime language version, platform, and architecture;
- the request-derived runtime server origin;
- routes observed in the running application;
- OpenAPI operations that have a matching runtime route;
- implemented routes missing from OpenAPI;
- documented routes not observed in the runtime router;
- whether discovery is complete or partial.

A snapshot has one framework-neutral shape. The runtime `name` identifies the host runtime, for example `node`, `python`, or `dotnet`:

```json
{
  "framework": "fastify",
  "frameworkVersion": "5.12.1",
  "runtime": {
    "name": "node",
    "version": "v22.22.3",
    "platform": "linux",
    "arch": "x64"
  },
  "serverOrigin": "https://api.example.com",
  "discoveryComplete": true,
  "routes": [],
  "runtimeOnly": [],
  "documentedOnly": [],
  "summary": {
    "documented": 0,
    "runtime": 0,
    "matched": 0,
    "runtimeOnly": 0,
    "documentedOnly": 0
  }
}
```

### Framework discovery semantics

**Express / NestJS on Express** — FlexDoc reads the live Express router. Express `:parameter` segments are normalized to OpenAPI `{parameter}` form. Middleware is not treated as an API route. If a mounted router prefix cannot be reconstructed safely, discovery is marked partial rather than inventing a path.

**Fastify / NestJS on Fastify** — FlexDoc waits for the Fastify application to be ready and reads Fastify's registered route tree through its public route-introspection surface. Implicit `HEAD` siblings of `GET` routes are collapsed so they do not appear as false drift. Unparseable or unsupported route entries make the snapshot partial instead of being guessed.

**Hono** — FlexDoc reads Hono's registered route inventory. Normal HTTP methods are compared directly. `ALL`/wildcard registrations cannot be represented as one OpenAPI operation and therefore make discovery partial rather than being expanded speculatively.

**FastAPI** — FlexDoc reads the live FastAPI/Starlette route tree and compares it with `app.openapi()` at request time. Starlette path converters such as `{file_path:path}` are normalized to OpenAPI `{file_path}` form, implicit `HEAD` siblings of `GET` routes are collapsed, and inspectable mounted route trees retain their mount prefixes. Opaque ASGI mounts mark discovery partial instead of being guessed. FastAPI's own OpenAPI/Swagger/ReDoc infrastructure and the FlexDoc docs subtree are excluded from drift.

**ASP.NET Core** — FlexDoc reads the live `EndpointDataSource` at request time. Structured route patterns normalize constraints, defaults, optional parameters, and catch-all parameters to OpenAPI `{parameter}` form. Endpoints with no concrete HTTP-method metadata or unsupported methods make discovery partial rather than being expanded speculatively. The FlexDoc docs subtree and configured OpenAPI route are excluded from drift.

FlexDoc's own documentation, renderer, runtime-intelligence, and host-execution routes under the docs prefix are excluded from the runtime inventory.

### Security

Runtime discovery can reveal endpoints that were intentionally omitted from the public OpenAPI document. Enabling it is therefore an operator security decision.

On Node integrations, the runtime endpoint is registered under the same FlexDoc documentation-auth boundary as the docs page. FastAPI and ASP.NET Core currently rely on application middleware or upstream access control rather than a FlexDoc-native documentation-auth option; protect the docs subtree at the application or proxy layer before enabling Runtime Intelligence on non-private documentation.

### Discovery completeness

`discoveryComplete: false` means the runtime inventory is known to be incomplete. In that state, **documented but not observed** entries are advisory because they may be false positives. Runtime-only routes that were positively discovered remain useful evidence.

3.0 discovery is intentionally observational. It reports live runtime knowledge and basic route-presence drift but does not reject requests or fail CI. Contract enforcement, schema mismatches, and breaking-drift policy belong to 3.1 Contract Validation.

Other native adapters continue to consume the same renderer contract without advertising Runtime Intelligence until their backend integration can supply a genuine runtime snapshot.
