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

## Package family

| Ecosystem | Package | Source version |
| --- | --- | ---: |
| npm | `@prauga/flexdoc-client` | `2.3.0` |
| npm | `@prauga/flexdoc-backend` | `2.3.0` |
| npm | `@prauga/flexdoc-core` | `0.3.0` |
| npm | `@prauga/flexdoc-cli` | `0.3.0` |
| NuGet | `Prauga.FlexDoc.AspNetCore` | `0.2.0` |
| Maven | `com.prauga.flexdoc:flexdoc-jvm` | `0.5.0` |
| Maven | `com.prauga.flexdoc:flexdoc-jaxrs` | `0.5.0` |
| Maven | `com.prauga.flexdoc:flexdoc-spring-boot-starter` | `0.5.0` |
| PyPI | `prauga-flexdoc` | `0.4.0` |
| Composer | `prauga/flexdoc` | `0.2.0` |
| RubyGems | `prauga-flexdoc` | `0.2.0` |
| crates.io | `prauga-flexdoc-axum` | `0.3.0` |
| crates.io | `prauga-flexdoc-actix` | `0.2.0` |
| Hex | `prauga_flexdoc` | `0.2.0` |
| Go | `github.com/prauga/flexdoc/adapters/go` | `0.3.0` |

Ecosystem package versions are intentionally independent. Renderer contract v1 is the cross-language compatibility boundary.

> This source tree is prepared for the coordinated **FlexDoc 2.3.0** release. Ecosystem packages keep independent semantic versions while sharing renderer contract v1.

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

See [`examples/`](./examples/README.md) and [`docs/distribution.md`](./docs/distribution.md).

## License

FlexDoc is licensed under **AGPL-3.0-or-later**. See [LICENSE](./LICENSE).
