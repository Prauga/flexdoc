# @prauga/flexdoc-core

Framework-neutral OpenAPI behavior shared by FlexDoc's renderer, CLI, and future API-client surfaces.

The package owns parsing/reference resolution, operation normalization, request serialization/authentication, and code-sample generation. It has no React dependency and does not render UI.

```ts
import {
  OpenAPIParser,
  bundleExternalReferences,
  buildRequest,
  generateCodeSample,
} from '@prauga/flexdoc-core';
```

`0.1.0` is the initial source version. The existing `@prauga/flexdoc-client` public API remains compatible and delegates its OpenAPI utilities to this implementation.
