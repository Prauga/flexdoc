# Fastify

This example uses the published `@prauga/flexdoc-backend` Fastify integration with an explicit OpenAPI document. The Fastify route schema still validates the runtime route, while the checked-in `spec` is passed directly to `setupFastifyFlexDoc`.

```bash
npm install
npm start
```

Open `http://localhost:3000/docs`.

The FlexDoc dependency is intentionally pinned to `2.1.0`; repository CI requires it to match the current backend package version and boots the app to verify the published integration API.
