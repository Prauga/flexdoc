# Hono + FlexDoc 3.1

This example uses Hono `4.13.x` with the optional `setupHonoFlexDoc` integration. Its registry dependency is pinned to published `@prauga/flexdoc-backend` `3.3.0` for reproducible standalone installs, while repository CI validates against the backend package built from the current commit. Runtime Intelligence reads Hono's actual registered routes instead of inferring them from the OpenAPI document.

The contract documents `/health` and `/pets/{petId}`. `GET /internal/health` is registered only in Hono and listed in `runtimeIntelligence.acknowledgedUndocumented`, so validation stays green and the route remains in the runtime route list. The docs surface also enables Basic/Advanced Try It, handoff to the sibling API Client page, persisted workspace state and code samples.

The integration remains framework-native without making Hono a hard dependency of the core backend package.
