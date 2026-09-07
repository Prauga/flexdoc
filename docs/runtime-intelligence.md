# Runtime Intelligence

FlexDoc 3.0 begins using information available because FlexDoc is installed inside the running backend rather than treating OpenAPI as the only source of truth.

## Node framework coverage

Runtime Intelligence is **off by default**. Enable it explicitly:

```ts
setupExpressFlexDoc(app, '/docs', {
  spec,
  options: {
    runtimeIntelligence: true,
  },
});
```

The same `runtimeIntelligence: true` option is supported by the Node Express, NestJS, Fastify, and Hono integrations. NestJS reports the underlying HTTP adapter discovered by the integration.

When enabled, FlexDoc registers `GET <docsPath>/__flexdoc/runtime` under the same documentation route and authentication boundary. The renderer requests that endpoint and shows:

- the detected framework and framework version when available;
- Node version, platform, and architecture;
- the request-derived runtime server origin;
- routes observed in the running application;
- OpenAPI operations that have a matching runtime route;
- implemented routes missing from OpenAPI;
- documented routes not observed in the runtime router;
- whether discovery is complete or partial.

A snapshot has one framework-neutral shape:

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

FlexDoc's own documentation, renderer, runtime-intelligence, and host-execution routes under the docs prefix are excluded from the runtime inventory.

### Security

Runtime discovery can reveal endpoints that were intentionally omitted from the public OpenAPI document. Enabling it is therefore an operator security decision. The runtime endpoint is protected by the same FlexDoc documentation-auth boundary as the docs page. On non-private documentation, use FlexDoc documentation auth or another upstream access-control layer before enabling Runtime Intelligence.

### Discovery completeness

`discoveryComplete: false` means the runtime inventory is known to be incomplete. In that state, **documented but not observed** entries are advisory because they may be false positives. Runtime-only routes that were positively discovered remain useful evidence.

3.0 discovery is intentionally observational. It reports live runtime knowledge and basic route-presence drift but does not reject requests or fail CI. Contract enforcement, schema mismatches, and breaking-drift policy belong to 3.1 Contract Validation.

Native adapters do not yet provide runtime discovery. They continue to consume the same renderer contract without advertising runtime intelligence until their backend integration can supply a genuine runtime snapshot.
