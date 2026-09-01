# FlexDoc

FlexDoc is Prauga's open-source, self-hosted OpenAPI documentation renderer and API explorer. It ships one canonical browser renderer and thin ecosystem adapters, so React, Node backends, Spring Boot, Go, Python, Rust, and static exports use the same OpenAPI behavior and UI.

No FlexDoc account, hosted dashboard, telemetry service, or runtime CDN is required.

## Capabilities

- OpenAPI 3.0/3.1 normalization and reference resolution, including relative external references
- responsive API reference UI with search and deep links
- interactive **Try It** execution and response inspection
- full **API Client** workflow with Try It handoff
- configured OpenAPI server selection, server variables, and arbitrary custom endpoints such as canaries or localhost
- API key, Basic, Bearer, OAuth2/OpenID bearer authentication
- OpenAPI parameter serialization including deepObject, matrix, label, pipe/space-delimited and explode semantics
- JSON, form-urlencoded and multipart request bodies
- code examples for cURL, JavaScript, Python, Go and Java from one canonical request model
- schema composition and recursive-reference rendering
- light/dark theming and renderer options
- standalone browser JS/CSS with no runtime CDN dependency
- CLI local serving and static export
- Express, Fastify, NestJS, Spring Boot, Go `net/http`, Python ASGI and Rust Axum integrations

## Package family

| Ecosystem | Package | Source version |
| --- | --- | ---: |
| npm | `@prauga/flexdoc-client` | `2.2.0` |
| npm | `@prauga/flexdoc-backend` | `2.2.0` |
| npm | `@prauga/flexdoc-core` | `0.2.0` |
| npm | `@prauga/flexdoc-cli` | `0.2.0` |
| Maven | `com.prauga.flexdoc:flexdoc-spring-boot-starter` | `0.3.0` |
| PyPI | `prauga-flexdoc` | `0.2.0` |
| crates.io | `prauga-flexdoc-axum` | `0.2.0` |
| Go | `github.com/prauga/flexdoc/adapters/go` | `0.2.0` |

These versions are independent across ecosystems. Renderer contract v1 is the compatibility boundary.

## Examples

Runnable examples are available in [`examples/`](./examples/README.md) for Express, Fastify, FastAPI, Spring Boot, Go and Rust. React and NestJS examples live under [`packages/examples/`](./packages/examples/).

The examples use the full OpenAPI 3.1 feature showcase where the framework allows a direct specification. FlexDoc dependencies use exact current release versions. `npm run check:example-versions` derives the expected versions from the package and adapter manifests and CI rejects stale example pins whenever a release version changes.

## React

```bash
npm install @prauga/flexdoc-client@^2.2
```

```tsx
import { FlexDoc } from '@prauga/flexdoc-client';
import '@prauga/flexdoc-client/styles.css';

export function Docs({ spec }) {
  return <FlexDoc spec={spec} theme="light" />;
}
```

## Node backend integrations

```bash
npm install @prauga/flexdoc-backend@^2.2
```

```ts
import express from 'express';
import { setupExpressFlexDoc } from '@prauga/flexdoc-backend';

const app = express();
setupExpressFlexDoc(app, '/docs', {
  spec,
  options: {
    title: 'Example API',
    tryIt: { enabled: true },
    codeSamples: { enabled: true, languages: ['curl', 'javascript', 'python', 'go', 'java'] },
  },
});
app.listen(3000);
```

`setupFastifyFlexDoc` and `setupNestFlexDoc` use the same canonical renderer.

## CLI / static export

```bash
npx @prauga/flexdoc-cli serve openapi.yaml --watch
npx @prauga/flexdoc-cli build openapi.yaml --out ./docs
```

Static output contains `index.html`, `flexdoc.js`, `flexdoc.css`, and a bundled `openapi.json`. External `$ref` documents are resolved at build time.

## Spring Boot

```xml
<dependency>
  <groupId>com.prauga.flexdoc</groupId>
  <artifactId>flexdoc-spring-boot-starter</artifactId>
  <version>0.3.0</version>
</dependency>
```

With springdoc's conventional `/v3/api-docs` endpoint, the default integration exposes FlexDoc at `/docs`. See [`adapters/java-spring`](./adapters/java-spring/README.md).

## Go

```go
import flexdoc "github.com/prauga/flexdoc/adapters/go"

http.Handle("/docs", flexdoc.Handler(flexdoc.Config{
    Path: "/docs",
    SpecURL: "/openapi.json",
    Title: "My API",
    TryItEnabled: true,
}))
```

The module embeds the exact canonical renderer assets at release time.

## Python / ASGI

```python
from prauga_flexdoc import FlexDocASGI, FlexDocConfig

app.mount("/docs", FlexDocASGI(
    FlexDocConfig(path="/docs", spec_url="/openapi.json", title="My API")
))
```

The `prauga-flexdoc` wheel includes the renderer assets and has no runtime FlexDoc service dependency.

## Rust / Axum

```rust
let docs = prauga_flexdoc_axum::router(prauga_flexdoc_axum::Config {
    path: "/docs".into(),
    spec_url: "/openapi.json".into(),
    ..Default::default()
});
```

The crate embeds the canonical JS/CSS with `include_bytes!`.

## Architecture

```text
OpenAPI document
      |
      v
framework-neutral normalization / request engine
      |
      v
canonical browser renderer
      |
      +--> React
      +--> standalone / CLI
      +--> Express / Fastify / NestJS
      +--> Spring Boot
      +--> Go net/http
      +--> Python ASGI
      +--> Rust Axum
```

Adapters obtain or expose the OpenAPI document, host a small page, and serve version-matched local renderer assets. They do not reimplement schemas, request serialization, code samples, Try It, API Client behavior, navigation, or theming.

## Development

Monorepo development and CI use Node.js `22.22.3` or newer, matching the root `engines.node` contract. The published CLI intentionally keeps the broader Node.js `>=20` runtime contract because consumers execute built CLI/runtime code rather than the repository's ESLint/Vite development toolchain.

```bash
npm ci
npm run check:example-versions
npm run lint
npm run build:client
npm test -w packages/client -- --runInBand
npm test -w packages/backend -- --runInBand
npm run check:adapter-assets
(cd adapters/go && go test ./...)
python3 -m unittest discover -s adapters/python/tests -v
cargo test --manifest-path adapters/rust/Cargo.toml --all-targets
mvn -f adapters/java-spring/pom.xml verify
```

## Release and migration

- [Distribution and versioning](./docs/distribution.md)
- [OpenAPI compatibility](./docs/openapi-compatibility.md)
- [Framework adapters](./docs/framework-adapters.md)
- [Renderer architecture](./docs/renderer-product.md)

## Security and self-hosting

Renderer assets are packaged with each integration rather than fetched from a third-party CDN. Documentation-route credentials are validated server-side and are not serialized into browser configuration. Publishing tokens, signing keys and production secrets must not be committed.

## License

FlexDoc is licensed under **AGPL-3.0-or-later**. See [LICENSE](./LICENSE).

## Project

- Repository: https://github.com/prauga/flexdoc
- Documentation/demo: https://prauga.github.io/flexdoc
- Issues: https://github.com/prauga/flexdoc/issues
