# Fastify + FlexDoc 3.1

This example serves the shared OpenAPI 3.1 showcase through Fastify and enables FlexDoc 3.1 Runtime Intelligence. FlexDoc reads Fastify's registered route tree at runtime, normalizes framework route syntax, and compares it with the exact OpenAPI document passed to the integration.

`GET /internal/health` is intentionally absent from the spec so the Runtime panel shows real drift. The normal renderer still exposes Basic/Advanced Try It, handoff to the sibling API Client page, persisted workspace state, scripts, response inspection, keyboard workflows and code samples.

```bash
npm install
npm start
```

Open `http://localhost:3000/docs`.

The standalone FlexDoc dependency is pinned to `3.1.0`, the current published release, for reproducible installs. Repository CI substitutes the backend package built from the same commit when validating source changes.
