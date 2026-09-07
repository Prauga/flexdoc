# Fastify + FlexDoc 3.0

This example serves the shared OpenAPI 3.1 showcase through Fastify and enables FlexDoc 3.0 Runtime Intelligence. FlexDoc reads Fastify's registered route tree at runtime, normalizes framework route syntax, and compares it with the exact OpenAPI document passed to the integration.

`GET /internal/health` is intentionally absent from the spec so the Runtime panel shows real drift. The normal renderer still exposes the completed Try It/API Client handoff, persisted workspace state, scripts, response inspection, keyboard workflows and code samples.

```bash
npm install
npm start
```

Open `http://localhost:3000/docs`.

The FlexDoc dependency is pinned to `2.9.9` until the coordinated 3.0 release versioning pass. Repository CI validates this example against the backend package built from the same commit.
