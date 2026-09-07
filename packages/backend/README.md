# FlexDoc Backend

[![npm version](https://img.shields.io/npm/v/@prauga/flexdoc-backend.svg)](https://www.npmjs.com/package/@prauga/flexdoc-backend)
[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)

Thin self-hosted integrations that mount the FlexDoc renderer, optional API-host execution routes, and runtime intelligence endpoints on Express, Fastify, NestJS, or Hono.

## Installation

```bash
npm install @prauga/flexdoc-backend
```

## Usage

### Express

```javascript
const express = require('express');
const { setupExpressFlexDoc } = require('@prauga/flexdoc-backend');
const spec = require('./openapi.json');

const app = express();

setupExpressFlexDoc(app, '/docs', {
  spec,
  options: {
    title: 'My API Documentation',
    tryIt: { enabled: true },
    runtimeIntelligence: true,
  },
});

app.listen(3000);
```

### NestJS

```typescript
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder } from '@nestjs/swagger';
import { setupNestFlexDoc } from '@prauga/flexdoc-backend';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const openApiConfig = new DocumentBuilder()
    .setTitle('My API')
    .setVersion('1.0.0')
    .build();

  setupNestFlexDoc(app, '/docs', openApiConfig, {
    options: {
      title: 'My API Documentation',
      tryIt: { enabled: true, hostExecution: true },
      runtimeIntelligence: true,
    },
  });

  await app.listen(3000);
}
bootstrap();
```

### Fastify and Hono

- `setupFastifyFlexDoc(app, path, options)` — static OpenAPI document
- `setupFastifySwaggerFlexDoc(app, path, options)` — document from `@fastify/swagger`
- `setupHonoFlexDoc(app, path, options)` — Hono without adding Hono as a dependency

Use `setupFlexDoc(app, path, options)` directly when you already have an Express-compatible `app.use` surface.

## Configuration

`FlexDocModuleOptions` requires a mount `path` and either an inline `spec` or a remote `specUrl`. Renderer behavior is configured through `options`, which mirrors the client `FlexDocRendererOptions` contract (theme, Try It, code samples, footer, optional docs-route auth, host execution, and runtime intelligence).

## NestJS module

`FlexDocModule.forRoot` / `forRootAsync` registers the same routes through Nest's HTTP adapter. `FlexDocService.generateHTML` is available for programmatic HTML generation.

## License

AGPL-3.0-or-later
