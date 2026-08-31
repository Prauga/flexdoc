# Framework adapters

FlexDoc integrations are intentionally thin. Every framework serves the same standalone browser renderer and passes it an OpenAPI document plus renderer options; framework packages do not implement their own schema, endpoint, Try It, or code-sample rendering.

## Express

```ts
import { setupExpressFlexDoc } from '@prauga/flexdoc-backend';

setupExpressFlexDoc(app, '/docs', {
  spec,
  options: { theme: 'dark', tryIt: { enabled: true } },
});
```

The existing `setupFlexDoc` API remains compatible; `setupExpressFlexDoc` is the explicit framework-named entry point.

## Fastify

```ts
import { setupFastifyFlexDoc } from '@prauga/flexdoc-backend';

setupFastifyFlexDoc(fastify, '/docs', {
  spec,
  options: { tryIt: { enabled: true } },
});
```

The Fastify adapter registers native GET routes and does not require Express compatibility middleware. It serves the renderer JS/CSS locally and supports the same docs-route authentication configuration as the Express integration.

## NestJS

When `@nestjs/swagger` is installed, FlexDoc can generate the OpenAPI document as part of setup:

```ts
import { DocumentBuilder } from '@nestjs/swagger';
import { setupNestFlexDoc } from '@prauga/flexdoc-backend';

const config = new DocumentBuilder()
  .setTitle('Orders API')
  .setVersion('1.0')
  .addBearerAuth()
  .build();

setupNestFlexDoc(app, '/docs', config, {
  options: { tryIt: { enabled: true } },
});
```

`@nestjs/swagger` is resolved only when this helper is used, so it remains optional for other backend integrations. FlexDoc detects the Nest HTTP adapter and uses native Fastify routing or Express routing accordingly.

## Java / Spring Boot

The `adapters/java-spring` Maven module is a Spring Boot starter-style adapter. It packages the same version-matched standalone renderer assets into the JAR under `META-INF/flexdoc`.

```yaml
flexdoc:
  path: /docs
  spec-location: classpath:/openapi.json
  title: Orders API
  theme: dark
  try-it-enabled: true
```

Applications that already generate OpenAPI dynamically can supply a `FlexDocSpecProvider` bean instead of `spec-location`. This makes integrations such as springdoc straightforward without forcing a springdoc dependency into the FlexDoc starter.

## Adapter contract

An adapter is responsible for only four things:

1. obtain or generate the OpenAPI document;
2. render the small FlexDoc host HTML with safely serialized JSON;
3. serve the version-matched `flexdoc.standalone.js` and `flexdoc.standalone.css` assets locally;
4. optionally implement framework-native documentation-route access control and server-side spec loading.

OpenAPI normalization, request construction, Try It, code generation, schemas, search, navigation, theming and responsive UI belong to the canonical browser renderer/client engine and must not be reimplemented by adapters.
