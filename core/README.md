# @prauga/flexdoc-core

Framework-neutral OpenAPI behavior shared by FlexDoc's renderer, CLI, and API Client surfaces.

The package owns parsing/reference resolution, operation normalization, request serialization/authentication, and code-sample generation. It has no React dependency and does not render UI.

```ts
import {
  OpenAPIParser,
  bundleExternalReferences,
  buildRequest,
  generateCodeSample,
} from '@prauga/flexdoc-core';
```

`@prauga/flexdoc-client` keeps a compatible public API and delegates its OpenAPI utilities to this implementation.
