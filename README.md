# FlexDoc

FlexDoc is Prauga's open-source, self-hosted OpenAPI documentation renderer and API explorer. It ships one canonical browser renderer and thin ecosystem adapters so supported backends expose the same documentation and API Client behavior.

No FlexDoc account, hosted dashboard, telemetry service, or runtime CDN is required.

## Current backend coverage

- JavaScript/TypeScript: Express, Fastify, NestJS
- .NET: ASP.NET Core
- JVM: Spring Boot, Jakarta REST/Quarkus, Micronaut, Guice/Governator-style services
- Python: FastAPI/ASGI, Flask/WSGI, Django
- PHP: generic PHP, Laravel, Symfony
- Ruby: Rack, Rails
- Go: `net/http`
- Rust: Axum

## Package family

| Ecosystem | Package | Source version |
| --- | --- | ---: |
| npm | `@prauga/flexdoc-client` | `2.2.0` |
| npm | `@prauga/flexdoc-backend` | `2.2.0` |
| npm | `@prauga/flexdoc-core` | `0.2.0` |
| npm | `@prauga/flexdoc-cli` | `0.2.0` |
| NuGet | `Prauga.FlexDoc.AspNetCore` | `0.1.0` |
| Maven | `com.prauga.flexdoc:flexdoc-jvm` | `0.4.0` |
| Maven | `com.prauga.flexdoc:flexdoc-jaxrs` | `0.4.0` |
| Maven | `com.prauga.flexdoc:flexdoc-spring-boot-starter` | `0.4.0` |
| PyPI | `prauga-flexdoc` | `0.3.0` |
| Composer | `prauga/flexdoc` | `0.1.0` |
| RubyGems | `prauga-flexdoc` | `0.1.0` |
| crates.io | `prauga-flexdoc-axum` | `0.2.0` |
| Go | `github.com/prauga/flexdoc/adapters/go` | `0.2.0` |

Versions are independent across ecosystems. Renderer contract v1 is the compatibility boundary.

## Architecture

```text
canonical browser renderer
  +-- Node backend host -> Express / Fastify / NestJS
  +-- ASP.NET Core
  +-- JVM host -> Spring / Jakarta REST / Quarkus / Micronaut / Guice-Governator
  +-- Python host -> ASGI / WSGI / FastAPI / Flask / Django
  +-- PHP host -> Laravel / Symfony
  +-- Ruby host -> Rack -> Rails
  +-- Go net/http
  +-- Rust Axum
```

Adapters serve version-matched local renderer assets and do not reimplement schemas, request serialization, code samples, Try It, API Client behavior, navigation, or theming.

See [`examples/`](./examples/README.md) and [`docs/distribution.md`](./docs/distribution.md).

## License

FlexDoc is licensed under **AGPL-3.0-or-later**. See [LICENSE](./LICENSE).
