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

Runtime Intelligence is explicit opt-in. If documentation-route authentication is configured, the runtime endpoint is protected by the same boundary. Node Express/Fastify/Hono/NestJS integrations also emit the 3.1 operation-level Contract Validation result consumed by the renderer and CLI.

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

## CLI: build, serve, validate, and run

```bash
npx @prauga/flexdoc-cli serve openapi.yaml --watch
npx @prauga/flexdoc-cli build openapi.yaml --out ./public
npx @prauga/flexdoc-cli validate http://127.0.0.1:3000/docs/__flexdoc/runtime

# 3.2.0 release candidate; use the repository CLI until cli/v0.7.0 is published
node tools/flexdoc-cli/bin/flexdoc.js run ./pets.flexdoc.json --json
```

`build` and `serve` bundle external references and the version-matched renderer; static output requires no FlexDoc service or runtime CDN.

`validate` consumes the Node backend's structured 3.1 validation result and remains contract-only; it does not execute requests or collections. FlexDoc 3.2 adds `flexdoc run <artifact.flexdoc.json>` for portable request/folder/collection execution with the existing scripts, tests, environments, and host-execution contract. The Runner is release-prepared in this source tree and remains a repository command until the 3.2 client and CLI artifacts are actually published; see [Headless Runner](./headless-runner.md). Use `--json` for machine-readable output. Protected Runtime Intelligence/docs-host endpoints can use repeatable `--header <name:value>`, `--bearer <token>`, or `--basic <user:password>`.

For `validate`, the default CI policy exits `1` only when the backend status is `fail` (or the endpoint/payload is invalid); use `--fail-on warning` or `--fail-on info` for stricter validation gates. `run` instead uses `0` when all selected items pass, `1` for failed runs, and `130` for interrupted/cancelled runs.

FastAPI, ASP.NET Core, and Spring continue to provide route-level Runtime Intelligence in this 3.1 cut but do not yet emit the structured `validation` object required by `flexdoc validate`.

## Other ecosystems

FlexDoc ships native packages for ASP.NET Core, JVM/Jakarta REST/Spring, Python ASGI/WSGI, PHP, Ruby, Rust Axum/Actix, Elixir Plug, and Go `net/http`. See [Distribution and versioning](./distribution.md) and each adapter README for installation and mount APIs.

## Next steps

- [Configuration](./configuration.md)
- [Public API reference](./api-reference.md)
- [Theming](./theming.md)
- [Runtime Intelligence](./runtime-intelligence.md)
- [API-host execution](./host-execution.md)
- [Headless Runner](./headless-runner.md)
- [OpenAPI compatibility](./openapi-compatibility.md)