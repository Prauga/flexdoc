# Fastify + FlexDoc 3.1

This example serves the shared OpenAPI 3.1 showcase through Fastify and enables FlexDoc 3.1 Runtime Intelligence. FlexDoc reads Fastify's registered route tree at runtime, normalizes framework route syntax, and compares it with the exact OpenAPI document passed to the integration.

`GET /internal/health` is absent from the spec and listed in `runtimeIntelligence.acknowledgedUndocumented`, so that finding is informational. `POST /internal/reindex` is also absent from the spec and is not acknowledged, so contract validation fails. The renderer still exposes Basic/Advanced Try It, handoff to the sibling API Client page, persisted workspace state, scripts, response inspection, keyboard workflows and code samples.

```bash
npm install
npm start
```

Open `http://localhost:3000/docs`.

The standalone FlexDoc dependency is pinned to published `@prauga/flexdoc-backend` `3.5.0`. Repository CI substitutes the backend package built from the same commit when validating source changes.
