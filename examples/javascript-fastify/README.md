# Fastify + FlexDoc

This example serves the shared OpenAPI 3.1 feature showcase through Fastify and `setupFastifyFlexDoc`. The runtime routes remain Fastify-native while FlexDoc receives the explicit showcase document, covering multi-server/custom-server workflows, auth metadata, request bodies, Try It, API Client handoff, and code samples.

```bash
npm install
npm start
```

Open `http://localhost:3000/docs`.

The FlexDoc dependency is pinned to `2.8.0` and resolves directly from the published npm package. Repository CI also installs the backend package built from the current commit and boots the app to verify source compatibility at runtime.
