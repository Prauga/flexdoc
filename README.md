# FlexDoc

FlexDoc is Prauga's open-source, self-hosted OpenAPI documentation renderer and API explorer. It ships one canonical browser renderer and thin ecosystem adapters so supported backends expose the same documentation, Try It, and API Client behavior.

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

The backend-coverage program shipped in 2.3.0 and the coordinated 2.x line culminated in published **2.9.9**. This source tree is prepared for stable **3.0.0**, combining backend-native Runtime Intelligence with the completed renderer/API Client product-quality gate: live route discovery and implementation drift where the backend can genuinely observe it, shared request execution and editing, responsive/localized chrome, accessibility hardening, and deterministic performance budgets. See [`docs/api-client-roadmap.md`](./docs/api-client-roadmap.md) for the 3.0 definition and follow-on roadmap.

## Package family

| Ecosystem | Package | Source version |
| --- | --- | ---: |
| npm | `@prauga/flexdoc-client` | `3.0.0` |
| npm | `@prauga/flexdoc-backend` | `3.0.0` |
| npm | `@prauga/flexdoc-core` | `0.5.0` |
| npm | `@prauga/flexdoc-cli` | `0.5.0` |
| NuGet | `Prauga.FlexDoc.AspNetCore` | `0.5.0` |
| Maven | `com.prauga.flexdoc:flexdoc-jvm` | `0.8.0` |
| Maven | `com.prauga.flexdoc:flexdoc-jaxrs` | `0.8.0` |
| Maven | `com.prauga.flexdoc:flexdoc-spring-boot-starter` | `0.8.0` |
| PyPI | `prauga-flexdoc` | `0.7.0` |
| Composer | `prauga/flexdoc` | `0.4.2` |
| RubyGems | `prauga-flexdoc` | `0.4.2` |
| crates.io | `prauga-flexdoc-axum` | `0.5.2` |
| crates.io | `prauga-flexdoc-actix` | `0.4.2` |
| Hex | `prauga_flexdoc` | `0.4.2` |
| Go | `github.com/prauga/flexdoc/adapters/go` | `0.5.2` |

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
