# FlexDoc

FlexDoc is an open-source, self-hosted OpenAPI documentation renderer and API explorer. It ships one canonical browser renderer and thin framework adapters, so React, Node backends, Spring Boot, and static exports all use the same OpenAPI behavior and UI.

FlexDoc is designed to live with your API: no FlexDoc account, hosted dashboard, telemetry service, or runtime CDN is required.

## What is in FlexDoc 2.0

- OpenAPI 3.0/3.1 normalization and reference resolution, including relative external references
- responsive API reference UI with search and deep links
- interactive **Try It** request execution and response inspection
- server selection and OpenAPI server variables
- API key, Basic, Bearer, OAuth2/OpenID bearer request authentication
- OpenAPI parameter serialization including deepObject, matrix, label, pipe/space-delimited and explode semantics
- JSON, form-urlencoded and multipart request bodies
- code examples for cURL, JavaScript, Python, Go and Java generated from the same canonical request model
- schema composition and recursive-reference rendering
- light/dark theming and renderer options
- standalone browser JS/CSS artifacts with no runtime CDN dependency
- CLI serving/static export with external-reference bundling
- Express, Fastify and NestJS integrations
- Spring Boot adapter that packages the same canonical renderer assets

Browser-side loading of cross-origin external OpenAPI references is subject to the target server's CORS policy. Server-side/CLI bundling can avoid that constraint.

## Packages

| Package | Version | Purpose |
| --- | --- | --- |
| `@bluejeans/flexdoc-client` | `2.0.2` | React components plus the canonical standalone renderer |
| `@bluejeans/flexdoc-backend` | `2.0.2` | Thin Express, Fastify and NestJS integrations |
| `@bluejeans/flexdoc-cli` | `0.1.0` source | CLI serving/static export; npm release workflow is prepared |
| `io.github.bluejeans117.flexdoc:flexdoc-spring-boot-starter` | `0.1.0` | Spring Boot adapter published on Maven Central |

Language adapters have independent ecosystem versions. Compatibility is governed by the renderer contract rather than forcing npm, Maven, PyPI, crates.io and Go modules to share one version number. See [Distribution and versioning](./docs/distribution.md).

## CLI / static export

The CLI converts a local or remote OpenAPI document into FlexDoc without requiring React or a backend framework. The source package is in [`tools/flexdoc-cli`](./tools/flexdoc-cli/); after its first npm publication the commands are:

```bash
npx @bluejeans/flexdoc-cli serve openapi.yaml
```

For live local development:

```bash
npx @bluejeans/flexdoc-cli serve openapi.yaml --watch
```

For a deployable static site:

```bash
npx @bluejeans/flexdoc-cli build openapi.yaml --out ./docs
```

The static export contains `index.html`, `flexdoc.js`, `flexdoc.css`, and a bundled `openapi.json`. External `$ref` documents are resolved and bundled at build time, so the deployed site does not need the original external spec files. Use `--base-path /repository-name/` for GitHub Pages project sites or other sub-path deployments.

The CLI has an independent `0.x` release line. Once the package is bootstrapped on npm and its Trusted Publisher is configured, GitHub Releases named `cli/v<version>` publish it through `.github/workflows/publish-cli.yml`. The workflow validates the tag, tests the CLI, installs the packed tarball into a clean consumer, exercises an actual static build, and then publishes with GitHub OIDC.

## React

```bash
npm install @bluejeans/flexdoc-client@^2
```

```tsx
import { FlexDoc } from '@bluejeans/flexdoc-client';
import '@bluejeans/flexdoc-client/styles.css';

export function Docs({ spec }) {
  return <FlexDoc spec={spec} theme="light" />;
}
```

The package also exports the standalone renderer used by non-React adapters and the CLI.

## Express

```bash
npm install @bluejeans/flexdoc-backend@^2
```

```ts
import express from 'express';
import { setupExpressFlexDoc } from '@bluejeans/flexdoc-backend';

const app = express();

setupExpressFlexDoc(app, {
  path: '/docs',
  specUrl: 'https://example.com/openapi.json',
  options: { title: 'Example API' },
});

app.listen(3000);
```

`setupFlexDoc` remains available for the existing Express integration. Native `setupFastifyFlexDoc` and `setupNestFlexDoc` helpers are also exported.

## NestJS

If you use `@nestjs/swagger`, FlexDoc can generate the document through Nest's `SwaggerModule.createDocument` and then serve it with the same renderer:

```ts
import { setupNestFlexDoc } from '@bluejeans/flexdoc-backend';

await setupNestFlexDoc(app, {
  path: '/docs',
  options: { title: 'My API' },
});
```

`@nestjs/swagger` is optional and is only required when using the automatic Nest document helper.

## Spring Boot

The Java adapter is published on Maven Central as `io.github.bluejeans117.flexdoc:flexdoc-spring-boot-starter:0.1.0`. Applications using springdoc can use `/v3/api-docs` without custom spec plumbing:

```xml
<dependency>
  <groupId>io.github.bluejeans117.flexdoc</groupId>
  <artifactId>flexdoc-spring-boot-starter</artifactId>
  <version>0.1.0</version>
</dependency>
```

```yaml
flexdoc:
  path: /docs
  spec-url: /v3/api-docs
  title: My API
  theme: dark
```

See [`adapters/java-spring`](./adapters/java-spring/README.md) for the complete integration.

## Architecture

FlexDoc deliberately has one renderer implementation:

```text
OpenAPI document
      |
      v
normalization / resolution
      |
      v
canonical renderer + request model
      |
      +--> React
      +--> CLI / static export
      +--> standalone static assets
      +--> Node framework adapters
      +--> Spring Boot adapter
      +--> future Python / Rust / Go adapters
```

Framework adapters and the CLI obtain or generate the OpenAPI document, prepare a small host page, and use version-matched renderer assets. They do not reimplement request construction, code generation, Try It, schemas, or theming.

The language-neutral contract is in [`packages/renderer-contract`](./packages/renderer-contract/).

## Development

```bash
npm ci
npm test --workspace=@bluejeans/flexdoc-client
npm run build --workspace=@bluejeans/flexdoc-client
npm test --workspace=@bluejeans/flexdoc-backend
npm run build --workspace=@bluejeans/flexdoc-backend
npm install --prefix tools/flexdoc-cli
FLEXDOC_CLIENT_DIR=packages/client npm test --prefix tools/flexdoc-cli
mvn -f adapters/java-spring/pom.xml verify
```

CI additionally verifies the packed npm client from clean TypeScript consumers, exercises CLI build/serve behavior, runs Chromium against CLI-generated output, and checks that backend and Java artifacts contain the canonical standalone renderer assets.

## Release and distribution

The JavaScript renderer/backend packages are released as a coordinated `2.x` line. The CLI starts at its own `0.x` version while consuming a compatible FlexDoc 2.x renderer. New language adapters start with their own ecosystem-native versions and declare/document renderer-contract compatibility.

Publication credentials must never be committed to this repository. npm, Maven Central, PyPI and other registry credentials/trusted-publishing configuration belong in the registry and GitHub Actions environment configuration.

See [Distribution and versioning](./docs/distribution.md) for the release model, CLI publishing, Maven Central setup, and the planned Python/Rust/Go distribution paths.

## Documentation

- [Getting started](./docs/getting-started.md)
- [Configuration](./docs/configuration.md)
- [OpenAPI compatibility](./docs/openapi-compatibility.md)
- [Framework adapters](./docs/framework-adapters.md)
- [Renderer product/architecture](./docs/renderer-product.md)
- [Distribution and versioning](./docs/distribution.md)
- [Theming](./docs/theming.md)
- [API reference](./docs/api-reference.md)

## Security and self-hosting

FlexDoc renderer assets are packaged with the integration rather than fetched from a third-party CDN. Documentation-route Basic/Bearer credentials are validated on the server and are not serialized into the browser configuration.

Do not commit `.env` files, publishing tokens, signing keys, API credentials, or production secrets. Local `.env*` files are ignored except explicitly named example files.

## License

FlexDoc is licensed under **AGPL-3.0-or-later**. See [LICENSE](./LICENSE).

## Project

- Documentation/demo: https://bluejeans117.github.io/flexdoc
- Issues: https://github.com/bluejeans117/flexdoc/issues
