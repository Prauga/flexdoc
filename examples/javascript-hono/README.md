# Hono + FlexDoc 3.0

This example uses Hono `4.13.x` with the optional `setupHonoFlexDoc` integration. Its registry dependency remains `@prauga/flexdoc-backend` `3.0.0` during 3.0 release preparation, while repository CI validates the local 3.0 package. Runtime Intelligence reads Hono's actual registered routes instead of inferring them from the OpenAPI document.

The contract documents `/health` and `/pets/{petId}`. `GET /internal/health` is deliberately registered only in Hono so the Runtime panel demonstrates implemented-but-undocumented drift. The docs surface also enables Basic/Advanced Try It, handoff to the sibling API Client page, persisted workspace state and code samples.

The integration remains framework-native without making Hono a hard dependency of the core backend package. A post-publish lock-refresh change will advance the npm dependency to 3.0.0.
