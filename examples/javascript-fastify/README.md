# Fastify + @fastify/swagger

This example generates OpenAPI from Fastify route schemas and lets FlexDoc consume the generated document after Fastify's ready lifecycle.

```bash
npm install
npm start
```

Open `http://localhost:3000/docs`.

The FlexDoc dependency is intentionally pinned to `2.1.0`; repository CI requires it to match the current backend package version.
