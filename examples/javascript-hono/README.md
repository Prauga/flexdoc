# Hono + FlexDoc 3.0

This example uses Hono `4.13.x` with the optional `setupHonoFlexDoc` integration from `@prauga/flexdoc-backend` `2.9.9`. Runtime Intelligence reads Hono's actual registered routes instead of inferring them from the OpenAPI document.

The contract documents `/health` and `/pets/{petId}`. `GET /internal/health` is deliberately registered only in Hono so the Runtime panel demonstrates implemented-but-undocumented drift. The docs surface also enables Try It, API Client handoff, persisted workspace state and code samples.

The integration remains framework-native without making Hono a hard dependency of the core backend package. The npm dependency stays at the repository's coordinated source version until the 3.0 release versioning pass.
