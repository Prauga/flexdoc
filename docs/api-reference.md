# FlexDoc public API reference

This reference describes the supported entry points shipped by the FlexDoc 3.1 source tree. Package declarations and native source comments are the authoritative signature reference; configuration behavior is detailed in [Configuration](./configuration.md).

## Browser client

Install `@prauga/flexdoc-client` and import from its package root.

### `FlexDoc`

Renders an OpenAPI 3.0.x or 3.1.x document, including navigation, operation documentation, Basic/Advanced Try It, code samples, Runtime Intelligence when advertised by the host, and the sibling API Client workspace.

```tsx
import { FlexDoc } from '@prauga/flexdoc-client';

<FlexDoc
  spec={openApiDocument}
  theme="light"
  options={{
    tryIt: { enabled: true },
  }}
/>;
```

`FlexDocProps` accepts:

- `spec`: the parsed `OpenAPISpec`;
- `theme`: the host/default theme, `light` or `dark`;
- `manageTheme`: whether FlexDoc owns and persists viewer theme overrides. It defaults to `true`; set it to `false` when the embedding application owns theme state, making `theme` authoritative and hiding only the viewer-theme selector;
- `customStyles`: styles applied to the renderer root;
- `options`: `FlexDocRendererOptions`, including theme, navigation, Try It, code-sample, localization, and Runtime Intelligence settings.

With the default `manageTheme={true}`, a persisted viewer theme can override the `theme` prop. With `manageTheme={false}`, FlexDoc does not apply or write a viewer theme override, but other viewer preferences such as expansion settings remain available.

### `ApiClient` and `ApiClientWorkspace`

`ApiClient` is the low-level request editor and executor. `ApiClientWorkspace` adds persisted collections, nested folders, environments, scripts, history, and collection runs.

```tsx
import { ApiClientWorkspace } from '@prauga/flexdoc-client';

<ApiClientWorkspace
  persistenceKey="pets-api"
  initialRequest={{ method: 'GET', url: '{{baseUrl}}/pets' }}
/>
```

Set `persistenceKey={false}` to disable IndexedDB persistence. Request credentials and scripts are stored as entered and are not encrypted. `ApiClientWorkspace` follows the same theme-ownership convention as `FlexDoc`: `manageTheme` defaults to `true`, while `manageTheme={false}` leaves the supplied theme under host control. FlexDoc's embedded API Client uses externally managed theme mode so the surrounding documentation renderer remains the single owner.

### OpenAPI and request utilities

The package root exports:

- parsing and references: `OpenAPIParser`, `bundleExternalReferences`;
- normalization: `normalizeOperation`, `resolveObject`, `resolvePathItem`, `resolveServerVariables`;
- OpenAPI requests: `buildRequest`, `initialRequestValues`, `parametersFor`;
- API Client requests: `buildHttpRequest`, `inferHttpBodyMode`, `resolveHttpRequestDraftVariables`, `requestDraftFromBuiltRequest`;
- execution and runners: `executeApiClientRequest`, `runApiClientCollection`;
- Try It handoff: `createOpenApiApiClientSession`;
- scripting: `runApiClientScript` and the `apiClientScript*Completions` helpers;
- Postman import: `importPostmanDocument`, `importPostmanCollection`, `importPostmanEnvironment`, and merge helpers;
- code samples: `generateCodeSample`, `languageLabel`.

Use the exported TypeScript declarations for complete parameter and result types.

## Node backend

Install `@prauga/flexdoc-backend`. Express, Fastify, Fastify Swagger, and Hono helpers mount the same packaged renderer and accept a path plus `FlexDocModuleOptions` without its `path` field. `setupNestFlexDoc` is the exception: it takes the Nest application, path, `@nestjs/swagger` document-builder config, then FlexDoc options (without `path`, `spec`, or `specUrl`) and creates the document internally. `setupFastifySwaggerFlexDoc` also omits `spec` and `specUrl` because it reads the document from `@fastify/swagger`.

```ts
import { setupExpressFlexDoc } from '@prauga/flexdoc-backend';

setupExpressFlexDoc(app, '/docs', {
  spec,
  options: {
    runtimeIntelligence: true,
    tryIt: { hostExecution: { enabled: true } },
  },
});
```

Supported setup entry points are:

- `setupFlexDoc` and `setupExpressFlexDoc`;
- `setupFastifyFlexDoc` and `setupFastifySwaggerFlexDoc`;
- `setupNestFlexDoc`;
- `setupHonoFlexDoc`;
- NestJS `FlexDocModule.forRoot(...)` and `FlexDocModule.forRootAsync(...)`.

Runtime Intelligence helpers, `validateRuntimeContract`, Contract Validation result/finding/status types, and host-execution primitives are exported for adapter authors. Applications should normally use the framework setup functions instead of calling those low-level primitives directly. Node Express, Fastify, Hono, and NestJS Runtime Intelligence snapshots produce the 3.1 `validation` object; duplicate-registration findings are a verified product claim for Express/Nest-on-Express and Hono, not Fastify in this cut.

Documentation authentication is configured through `options.auth`. Host execution and Runtime Intelligence are separate, explicit opt-ins. Server-only secrets are not serialized into renderer options.

## Framework-neutral core

`@prauga/flexdoc-core` contains the non-React OpenAPI parser, resolver, normalizer, request builder, HTTP request model, and code-sample generator used by the renderer and CLI.

```ts
import {
  OpenAPIParser,
  buildHttpRequest,
  buildRequest,
  generateCodeSample,
} from '@prauga/flexdoc-core';
```

It does not render UI or perform network requests.

## CLI

`@prauga/flexdoc-cli` exposes `flexdoc build`, `flexdoc serve`, and the 3.1 `flexdoc validate` Contract Validation consumer.

```bash
flexdoc serve openapi.yaml --watch
flexdoc build openapi.yaml --out ./docs --base-path /reference/
flexdoc validate http://127.0.0.1:3000/docs/__flexdoc/runtime
```

`build` and `serve` accept local JSON/YAML documents or HTTP(S) URLs and bundle external references. Static output contains the version-matched canonical renderer and requires no runtime CDN.

`validate` requires a backend snapshot containing the 3.1 `validation` object and does not re-run validation client-side. It accepts `--json`, repeatable `--header <name:value>`, `--bearer <token>`, `--basic <user:password>`, and `--fail-on error|warning|info`. The default policy exits `1` only when backend status is `fail`; `--fail-on warning` and `--fail-on info` make CI stricter.

The CLI and renderer both reject inconsistent validation status/summary/finding combinations. FastAPI, ASP.NET Core, and Spring snapshots do not yet contain `validation`, so the CLI intentionally rejects them rather than creating a second source of truth.

## Native adapters

Native packages expose one configuration type and one or more framework mount helpers. Their source comments and package READMEs provide exact signatures:

- ASP.NET Core: `FlexDocOptions` and `MapFlexDoc`;
- JVM: `FlexDocConfig`, `FlexDocHost`, `FlexDocHttpResponse`, and `FlexDocSpecSupplier`;
- Jakarta REST: `FlexDocJaxRsResource`;
- Spring Boot: `FlexDocProperties`, `FlexDocSpecProvider`, and auto-configuration;
- Python: `FlexDocConfig`, `FlexDocHost`, `FlexDocASGI`, `FlexDocWSGI`, and framework setup helpers;
- PHP: `FlexDocConfig`, `FlexDocHost`, Laravel registration, and the Symfony controller;
- Ruby: `Prauga::FlexDoc::Config`, `Host`, `RackApp`, and Rails mounting;
- Rust/Axum: `Config`, `router`, and `router_with_openapi`;
- Rust/Actix: `Config` and `scope`;
- Elixir: `PraugaFlexDoc.Config` and `PraugaFlexDoc.Plug`;
- Go: `Config`, `Handler`, `HandlerFromOpenAPI`, and `HandlerWithAssets`.

Renderer contract v1 is the compatibility boundary between the canonical browser client and native hosts. Package version numbers remain independent across ecosystems. FastAPI, ASP.NET Core, and Spring continue to expose 3.0-compatible Runtime Intelligence route snapshots in this 3.1 cut; structured Contract Validation production is currently a Node backend capability.

## Version and publication status

The exact versions encoded by source are listed in [Distribution and versioning](./distribution.md). During release preparation, source manifests may be ahead of registry packages. Standalone examples deliberately remain pinned to the last published versions until the corresponding tags and registry artifacts exist; a separate post-publish lock-refresh change advances those pins.
