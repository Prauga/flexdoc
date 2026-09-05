# Fastify + FlexDoc

This example serves the shared OpenAPI 3.1 feature showcase through Fastify and `setupFastifyFlexDoc`. The runtime routes remain Fastify-native while FlexDoc receives the explicit showcase document, covering multi-server/custom-server workflows, auth metadata, request bodies, Try It, API Client handoff, and code samples.

```bash
npm install
npm start
```

Open `http://localhost:3000/docs`.

The FlexDoc dependency is pinned to `2.8.0`. During this release PR, CI installs the backend package from the same commit and boots the app to verify the integration at runtime; after `2.8.0` is published, the manifest is directly runnable as written.