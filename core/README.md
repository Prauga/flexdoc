# @prauga/flexdoc-core

Framework-neutral OpenAPI and request-policy behavior shared by FlexDoc's renderer, CLI, API Client, backend integrations, and future execution gateways.

The package owns parsing/reference resolution, operation normalization, request serialization/authentication, code-sample generation, and the portable host-execution target-policy contract. It has no React dependency and does not render UI or open network connections.

```ts
import {
  OpenAPIParser,
  bundleExternalReferences,
  buildRequest,
  createHostExecutionTargetPolicy,
  generateCodeSample,
} from '@prauga/flexdoc-core';

const policy = createHostExecutionTargetPolicy({
  allowedOrigins: ['https://api.internal.example/v1'],
});
```

The host-execution policy normalizes exact HTTP(S) origins and exposes the security invariants already shared by FlexDoc's native transports: same-origin-only redirects, no URL-embedded credentials, and runtime rejection of link-local/cloud-metadata destinations. The core contract intentionally does **not** perform DNS resolution or socket connection pinning; each backend runtime or Cloud gateway must enforce those invariants using its native networking stack.

This lets future execution gateways consume the same allowlist/security model instead of introducing a parallel SSRF policy contract while still allowing runtime-specific enforcement.

`@prauga/flexdoc-client` keeps a compatible public API and delegates its OpenAPI utilities to this implementation.
