# Getting started with FlexDoc

FlexDoc serves a self-contained OpenAPI 3.0.x/3.1.x reference and API Client. Choose the browser package for React applications or the backend package for Node framework integration.

## React

```bash
npm install @prauga/flexdoc-client
```

```tsx
import { FlexDoc } from '@prauga/flexdoc-client';
import spec from './openapi.json';

export function ApiReference() {
  return (
    <FlexDoc
      spec={spec}
      options={{
        title: 'Pets API',
        tryIt: { enabled: true },
      }}
    />
  );
}
```

The operation page provides Basic/Advanced Try It. **Open in API Client** navigates to the sibling workspace for collections, environments, scripts, history, and collection runs.

## Express

```bash
npm install @prauga/flexdoc-backend
```

```ts
import express from 'express';
import { setupExpressFlexDoc } from '@prauga/flexdoc-backend';
import spec from './openapi.json' with { type: 'json' };

const app = express();

setupExpressFlexDoc(app, '/docs', {
  spec,
  options: {
    runtimeIntelligence: true,
    tryIt: { enabled: true },
  },
});

app.listen(3000);
```

Runtime Intelligence is explicit opt-in. If documentation-route authentication is configured, the runtime endpoint is protected by the same boundary.

## NestJS

Pass the `@nestjs/swagger` document-builder config; `setupNestFlexDoc` creates the OpenAPI document internally:

```ts
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder } from '@nestjs/swagger';
import { setupNestFlexDoc } from '@prauga/flexdoc-backend';
import { AppModule } from './app.module';

const app = await NestFactory.create(AppModule);
const swagger = new DocumentBuilder().setTitle('Pets API').setVersion('1.0').build();

setupNestFlexDoc(app, '/docs', swagger, {
  options: { runtimeIntelligence: true },
});

await app.listen(3000);
```

`FlexDocModule.forRoot(...)` and `forRootAsync(...)` remain available when module-based registration is preferred.

## Fastify and Hono

Use `setupFastifyFlexDoc` or `setupHonoFlexDoc` with the same path, document source, and renderer options as the Express helper. `setupFastifySwaggerFlexDoc` takes the same path and renderer options, but derives its document from `@fastify/swagger` and does not accept `spec` or `specUrl`.

## Static output

```bash
npx @prauga/flexdoc-cli serve openapi.yaml --watch
npx @prauga/flexdoc-cli build openapi.yaml --out ./public
```

Static output bundles external references and the version-matched renderer; it requires no FlexDoc service or runtime CDN.

## Other ecosystems

FlexDoc ships native packages for ASP.NET Core, JVM/Jakarta REST/Spring, Python ASGI/WSGI, PHP, Ruby, Rust Axum/Actix, Elixir Plug, and Go `net/http`. See [Distribution and versioning](./distribution.md) and each adapter README for installation and mount APIs.

## Next steps

- [Configuration](./configuration.md)
- [Public API reference](./api-reference.md)
- [Theming](./theming.md)
- [Runtime Intelligence](./runtime-intelligence.md)
- [API-host execution](./host-execution.md)
- [OpenAPI compatibility](./openapi-compatibility.md)
