# Runtime Intelligence

FlexDoc 3.0 introduced information available because FlexDoc is installed inside the running backend rather than treating OpenAPI as the only source of truth. FlexDoc 3.1 adds a deliberately narrow Contract Validation layer on top of that runtime evidence.

This 3.1 cut validates operation-level runtime drift. It does not expand into generic OpenAPI linting, schema/response validation, live-traffic breaking-drift policy, request rejection, the headless Runner, or native host execution.

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

The same `runtimeIntelligence: true` option is supported by the Node Express, NestJS, Fastify, and Hono integrations. NestJS reports the underlying HTTP adapter discovered by the integration. These Node integrations also produce the 3.1 `validation` object consumed by the renderer and `flexdoc validate`.

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

### Spring MVC

The Spring Boot starter can inspect Spring MVC's live request-mapping registry:

```yaml
flexdoc:
  path: /docs
  spec-url: /v3/api-docs
  runtime-intelligence: true
```

Spring Runtime Intelligence requires a `FlexDocSpecProvider`. Existing `spec-location` configuration creates one automatically; code-first applications can provide the exact generated OpenAPI model as a bean. FlexDoc deliberately does not fetch `spec-url` server-side and does not couple this feature to springdoc internals.

FastAPI, ASP.NET Core, and Spring MVC continue to emit the compatible route-level Runtime Intelligence snapshot in this 3.1 cut, but they do **not** yet emit the structured `validation` object. The renderer keeps showing route presence/drift for those snapshots; the CLI intentionally refuses to invent a second validator when `validation` is absent.

When enabled, FlexDoc registers `GET <docsPath>/__flexdoc/runtime` under the documentation route. The renderer requests that endpoint and shows:

- the detected framework and framework version when available;
- runtime language version, platform, and architecture;
- the request-derived runtime server origin when available;
- the actual local backend listener port when the framework exposes it safely;
- the standard framework/runtime environment identity when one exists;
- routes observed in the running application;
- OpenAPI operations that have a matching runtime route;
- implemented routes missing from OpenAPI;
- documented routes not observed in the runtime router;
- whether discovery is complete or partial.

A snapshot has one framework-neutral shape. The runtime `name` identifies the host runtime, for example `node`, `python`, `dotnet`, or `java`:

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
  "server": {
    "localPort": 3000
  },
  "environment": {
    "name": "production"
  },
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
  },
  "validation": {
    "status": "pass",
    "complete": true,
    "findings": [],
    "summary": {
      "total": 0,
      "errors": 0,
      "warnings": 0,
      "info": 0
    }
  }
}
```

`serverOrigin`, `server`, and `environment` are optional. Missing values are omitted rather than guessed. `validation` is also optional at the renderer-contract level so 3.0/native route snapshots remain compatible; in this cut it is produced by the Node Express/Fastify/Hono/Nest integrations.

## 3.1 Contract Validation

The Node Runtime Intelligence snapshot can include one backend-produced `validation` object. The backend is authoritative: the renderer and CLI parse and integrity-check the same result rather than running separate comparison engines.

The four finding codes in this cut are:

- `runtime.operation-undocumented` — the running backend positively exposes an operation that OpenAPI does not document. Severity: `warning`. This is runtime evidence only and is not clickable as a spec operation.
- `runtime.operation-unobserved` — OpenAPI documents an operation that runtime discovery did not observe. Severity: `error` when discovery is complete, `info` when discovery is partial.
- `runtime.method-mismatch` — the same wire-equivalent path exists in both sources but under different HTTP methods. Severity: `error` when discovery is complete, `warning` when partial. The finding carries an expected documented method so the renderer can navigate to the spec operation.
- `runtime.duplicate-operation` — the host exposes multiple registrations for one wire-equivalent method/path. Severity: `warning`. In 3.1 this is an explicitly supported/verified claim for Express (including Nest-on-Express) and Hono. Fastify participates in the other validation checks, but exact duplicate-registration reporting is not claimed for Fastify in this cut.

Validation statuses are derived, not free-form:

- `fail` — at least one `error`;
- `warn` — no errors and at least one `warning`;
- `partial` — no errors/warnings and route discovery is incomplete;
- `pass` — no findings and complete discovery.

Both the client and CLI reject internally inconsistent `status`, finding severities, or summary counts.

Route identity remains wire-oriented. Framework/OpenAPI parameter names are normalized for comparison, so `/pets/:id` and `/pets/{petId}` compare as the same `/pets/{}` shape. Parameter-name differences alone are not contract drift.

Incomplete discovery remains a first-class part of the contract. FlexDoc downgrades absence claims rather than presenting an incomplete router inventory as authoritative; positively observed runtime-only evidence remains useful.

### CI consumer

`@prauga/flexdoc-cli` consumes the Node backend result directly:

```bash
flexdoc validate http://127.0.0.1:3000/docs/__flexdoc/runtime
flexdoc validate "$FLEXDOC_RUNTIME_URL" --json
```

Protected endpoints can use repeatable `--header <name:value>`, `--bearer <token>`, or `--basic <user:password>`. By default the command exits `1` only for backend status `fail` (or an unreadable/invalid payload). `--fail-on warning` makes warnings fail CI; `--fail-on info` fails on any finding.

This command is a consumer of Runtime Intelligence, **not** the 3.2 headless Runner. It does not execute collections or API requests.

### Explicitly outside this 3.1 cut

The following remain outside this milestone slice: schema/request/response validation, live-traffic breaking-drift policy, request rejection/enforcement in the application path, generic OpenAPI linting, the headless FlexDoc Runner, and native-adapter API-host execution.

### Safe server and environment context

Runtime Intelligence intentionally exposes a narrow environment surface instead of serializing arbitrary process or framework state.

- `serverOrigin` remains request-derived and describes the origin through which the Runtime Intelligence request reached the application.
- `server.localPort` is the actual backend listener port exposed by the framework/request context. FlexDoc does **not** expose the local IP address or hostname alongside it.
- Node exposes `environment.name` only from `NODE_ENV`.
- ASP.NET Core uses `ASPNETCORE_ENVIRONMENT`, then `DOTNET_ENVIRONMENT` when the first is absent.
- Spring MVC uses the framework's active profile list.
- FastAPI intentionally omits `environment.name`: Python/ASGI does not define a trustworthy standard environment identity equivalent to the conventions above.

FlexDoc does not copy arbitrary environment variables, request headers, filesystem paths, container metadata, cloud metadata, or secret-bearing process state into the snapshot.

### Framework discovery semantics

**Express / NestJS on Express** — FlexDoc reads the live Express router. Express `:parameter` segments are normalized to OpenAPI `{parameter}` form. Middleware is not treated as an API route. Repeated wire-equivalent method/path registrations are retained as duplicate-registration evidence for 3.1 validation. If a mounted router prefix cannot be reconstructed safely, discovery is marked partial rather than inventing a path.

**Fastify / NestJS on Fastify** — FlexDoc waits for the Fastify application to be ready and reads Fastify's registered route tree through its public route-introspection surface. Implicit `HEAD` siblings of `GET` routes are collapsed so they do not appear as false drift. Unparseable or unsupported route entries make the snapshot partial instead of being guessed. Fastify participates in operation-undocumented, operation-unobserved, and method-mismatch validation; this cut does not claim verified exact duplicate-registration detection for Fastify.

**Hono** — FlexDoc reads Hono's registered route inventory. Normal HTTP methods are compared directly, and repeated wire-equivalent registrations are retained as duplicate-registration evidence for 3.1 validation. `ALL`/wildcard registrations cannot be represented as one OpenAPI operation and therefore make discovery partial rather than being expanded speculatively.

**FastAPI** — FlexDoc reads the live FastAPI/Starlette route tree and compares it with `app.openapi()` at request time. Starlette path converters such as `{file_path:path}` are normalized to OpenAPI `{file_path}` form, implicit `HEAD` siblings of `GET` routes are collapsed, and inspectable mounted route trees retain their mount prefixes. Opaque ASGI mounts mark discovery partial instead of being guessed. FastAPI's own OpenAPI/Swagger/ReDoc infrastructure and the FlexDoc docs subtree are excluded from drift.

**ASP.NET Core** — FlexDoc reads the live `EndpointDataSource` at request time. Structured route patterns normalize constraints, defaults, optional parameters, and catch-all parameters to OpenAPI `{parameter}` form. Endpoints with no concrete HTTP-method metadata or unsupported methods make discovery partial rather than being expanded speculatively. The FlexDoc docs subtree and configured OpenAPI route are excluded from drift.

**Spring MVC** — FlexDoc reads `RequestMappingHandlerMapping` at request time and compares it with the exact document returned by `FlexDocSpecProvider`. Spring path-variable constraints and capture-all parameters are normalized to OpenAPI parameter syntax. Mappings without a concrete HTTP method and raw wildcard mappings are not expanded speculatively; they mark discovery partial. The configured OpenAPI route and FlexDoc docs subtree are excluded.

FlexDoc's own documentation, renderer, runtime-intelligence, and host-execution routes under the docs prefix are excluded from the runtime inventory.

### Go framework packaging follow-on

The existing Go adapter remains intentionally neutral around `net/http`. Gin, Chi, Echo, and Fiber each expose framework-specific router state through different APIs; the neutral adapter cannot recover those live inventories without importing the frameworks it is supposed to remain independent from.

Runtime Intelligence therefore does not advertise Go framework route discovery in this 3.0 slice. Adding framework-specific Go integrations requires an explicit package/release boundary so importing the neutral adapter does not silently broaden its dependency graph or minimum toolchain. FlexDoc will not use reflection or inferred paths to pretend that coverage exists.

### Security

Runtime discovery can reveal endpoints that were intentionally omitted from the public OpenAPI document. Enabling it is therefore an operator security decision.

On Node integrations, the runtime endpoint is registered under the same FlexDoc documentation-auth boundary as the docs page. FastAPI, ASP.NET Core, and Spring MVC currently rely on application middleware/security or upstream access control rather than a FlexDoc-native documentation-auth option; protect the docs subtree at the application or proxy layer before enabling Runtime Intelligence on non-private documentation.

### Discovery completeness

`discoveryComplete: false` means the runtime inventory is known to be incomplete. In that state, **documented but not observed** entries are advisory because they may be false positives. Runtime-only routes that were positively discovered remain useful evidence.

3.1 adds route-level Contract Validation and a CLI consumer without changing application request handling. The default CLI policy fails only on backend status `fail`; stricter warning/info policies are opt-in. Schema/request/response validation, breaking-drift policy over live traffic, request rejection, generic OpenAPI linting, the headless Runner, and native host execution remain outside this cut.

Other native adapters continue to consume the same renderer contract. FastAPI, ASP.NET Core, and Spring retain their 3.0-compatible Runtime Intelligence route snapshots in this cut; other adapters still do not advertise Runtime Intelligence until their backend integration can supply genuine runtime evidence.
