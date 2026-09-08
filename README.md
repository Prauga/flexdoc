# FlexDoc

FlexDoc is Prauga's open-source, self-hosted OpenAPI documentation renderer and API explorer. It ships one canonical browser renderer and thin ecosystem adapters so supported backends expose the same documentation, Try It, API Client, Runtime Intelligence, and backend-produced Contract Validation behavior where the host can genuinely observe it.

No FlexDoc account, hosted dashboard, telemetry service, or runtime CDN is required.

## Backend coverage through FlexDoc 2.3.0

- **JavaScript/TypeScript:** Express, Fastify, NestJS, Hono
- **C#/.NET:** ASP.NET Core
- **JVM:** Spring Boot, Jakarta/JAX-RS, Quarkus, Micronaut, Guice/Governator-style services, Kotlin Ktor
- **Python:** FastAPI/Starlette/ASGI, Flask/WSGI, Django
- **PHP:** generic PHP host, Laravel, Symfony
- **Ruby:** Rack, Rails
- **Go:** `net/http`, Gin, Chi, Echo v5, Fiber v3
- **Rust:** Axum, Actix Web
- **Elixir:** Plug, Phoenix

The backend-coverage program shipped in 2.3.0 and the coordinated 2.x line culminated in published **2.9.9**. Stable **3.0.0** added backend-native Runtime Intelligence, and published **3.1.0** added operation-level Contract Validation on Node Express/Fastify/Hono/NestJS with matching renderer and CLI consumption. The current source milestone is **3.2**, taking the canonical API Client request/script/collection model into headless CLI/CI execution while reusing the existing advertised host-execution contract. See [`docs/api-client-roadmap.md`](./docs/api-client-roadmap.md) for the exact milestone boundary and deferred work.

## CLI

`@prauga/flexdoc-cli` is the first-class command-line surface for static docs and 3.1 Contract Validation. The 3.2 source tree additionally adds portable headless API Client execution through `flexdoc run`:

```bash
npx @prauga/flexdoc-cli serve openapi.yaml --watch
npx @prauga/flexdoc-cli build openapi.yaml --out ./public
npx @prauga/flexdoc-cli validate http://127.0.0.1:3000/docs/__flexdoc/runtime

# 3.2 source milestone; package version advances during release preparation
node tools/flexdoc-cli/bin/flexdoc.js run ./pets.flexdoc.json --json
```

`validate` consumes the installed Node backend's structured 3.1 validation result rather than reimplementing contract comparison. It supports JSON output, custom headers, bearer/basic authentication for protected Runtime Intelligence endpoints, and opt-in stricter CI failure policies such as `--fail-on warning`. By default it exits `1` only when the backend reports `fail` (or the endpoint/payload cannot be consumed).

`run` consumes a versioned artifact exported from the canonical API Client workspace and delegates to the same collection/request executor and `flex.*` script/test runtime. Ordinary requests execute directly from Node; capability-gated requests can reuse the existing same-origin host-execution advertisement. See [`docs/headless-runner.md`](./docs/headless-runner.md) for the 3.2 artifact, security, reporting, and cancellation contract.

## Package family

| Ecosystem | Package | Source version |
| --- | --- | ---: |
| npm | `@prauga/flexdoc-client` | `3.1.0` |
| npm | `@prauga/flexdoc-backend` | `3.1.0` |
| npm | `@prauga/flexdoc-core` | `0.5.0` |
| npm | `@prauga/flexdoc-cli` | `0.6.0` |
| NuGet | `Prauga.FlexDoc.AspNetCore` | `0.5.1` |
| Maven | `com.prauga.flexdoc:flexdoc-jvm` | `0.8.1` |
| Maven | `com.prauga.flexdoc:flexdoc-jaxrs` | `0.8.1` |
| Maven | `com.prauga.flexdoc:flexdoc-spring-boot-starter` | `0.8.1` |
| PyPI | `prauga-flexdoc` | `0.7.1` |
| Composer | `prauga/flexdoc` | `0.4.3` |
| RubyGems | `prauga-flexdoc` | `0.4.3` |
| crates.io | `prauga-flexdoc-axum` | `0.5.3` |
| crates.io | `prauga-flexdoc-actix` | `0.4.3` |
| Hex | `prauga_flexdoc` | `0.4.3` |
| Go | `github.com/prauga/flexdoc/adapters/go` | `0.5.3` |

Ecosystem package versions are intentionally independent. Renderer contract v1 is the cross-language compatibility boundary.

> The package table reflects the versions encoded by the current source commit. Release-preparation commits update these source versions only when the matching release is ready; source version numbers alone do not mean an artifact has been published.

## Architecture

```text
canonical browser renderer
  +-- Node backend -> Express / Fastify / NestJS / Hono
  +-- ASP.NET Core
  +-- JVM host -> Spring / Jakarta REST / Quarkus / Micronaut / Guice-Governator / Ktor
  +-- Python host -> ASGI / WSGI / FastAPI / Flask / Django
  +-- PHP host -> Laravel / Symfony
  +-- Ruby host -> Rack -> Rails
  +-- Go net/http -> Gin / Chi / Echo / Fiber v3
  +-- Rust -> Axum / Actix Web
  +-- Elixir Plug -> Phoenix
```

Adapters serve version-matched local renderer assets and do not reimplement schemas, request serialization, code samples, Try It, API Client behavior, navigation, or theming.

See [`examples/`](./examples/README.md), [`docs/framework-coverage-roadmap.md`](./docs/framework-coverage-roadmap.md), [`docs/api-client-roadmap.md`](./docs/api-client-roadmap.md), and [`docs/distribution.md`](./docs/distribution.md).

## License

FlexDoc is licensed under **AGPL-3.0-or-later**. See [LICENSE](./LICENSE).
