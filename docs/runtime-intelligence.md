# Runtime Intelligence

FlexDoc 3.0 begins using information available because FlexDoc is installed inside the running backend rather than treating OpenAPI as the only source of truth.

## First slice: Express and NestJS on Express

Runtime Intelligence is **off by default**. Enable it explicitly:

```ts
setupExpressFlexDoc(app, '/docs', {
  spec,
  options: {
    runtimeIntelligence: true,
  },
});
```

When enabled, FlexDoc registers `GET <docsPath>/__flexdoc/runtime` under the same documentation route and authentication boundary. The renderer requests that endpoint when documentation loads and shows:

- the framework and request-derived runtime server origin;
- routes observed in the running Express router;
- OpenAPI operations that have a matching runtime route;
- implemented routes missing from OpenAPI;
- documented routes not observed in the runtime router;
- whether discovery is complete or partial.

Express `:parameter` segments are normalized to OpenAPI `{parameter}` form before comparison. Middleware is not treated as an API route.

### Security

Runtime discovery can reveal endpoints that were intentionally omitted from the public OpenAPI document. Enabling it is therefore an operator security decision. On non-private documentation, protect the docs route with FlexDoc documentation auth or another upstream access-control layer before enabling Runtime Intelligence.

### Discovery completeness

Direct Express routes are discovered from the live router. If FlexDoc encounters a mounted router whose mount prefix cannot be reconstructed safely from runtime metadata, the snapshot is marked `discoveryComplete: false` instead of inventing a path. In that state, "documented but not observed" entries are advisory because they may be false positives.

This first 3.0 slice intentionally does not enforce drift or fail CI. Contract enforcement belongs to 3.1; 3.0 establishes runtime knowledge and presence drift first. Fastify, Hono, and native adapter discovery will implement the same public snapshot protocol in follow-up 3.0 slices.
