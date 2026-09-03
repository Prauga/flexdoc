# FlexDoc

FlexDoc is Prauga's open-source, self-hosted OpenAPI documentation renderer and API explorer. It ships one canonical browser renderer and thin ecosystem adapters so every supported backend serves the same renderer behavior.

No FlexDoc account, hosted dashboard, telemetry service, or runtime CDN is required.

## Capabilities

- OpenAPI 3.0/3.1 documentation and API exploration
- interactive Try It and API Client workflows
- one canonical standalone renderer with local packaged assets
- Express, Fastify, NestJS, ASP.NET Core
- Spring Boot, Jakarta REST/Quarkus, Micronaut, Guice/Governator-style JVM applications
- FastAPI/ASGI, Flask/WSGI, Django
- PHP, Laravel, Symfony
- Go `net/http` and Rust Axum

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
| crates.io | `prauga-flexdoc-axum` | `0.2.0` |
| Go | `github.com/prauga/flexdoc/adapters/go` | `0.2.0` |

Versions are independent across ecosystems. Renderer contract v1 is the compatibility boundary.

## Framework architecture

```text
canonical browser renderer
  +-- Node backend host -> Express / Fastify / NestJS
  +-- ASP.NET Core
  +-- JVM host -> Spring / Jakarta REST / Quarkus / Micronaut / Guice-Governator
  +-- Python host -> ASGI / WSGI / FastAPI / Flask / Django
  +-- PHP host -> Laravel / Symfony
  +-- Go net/http
  +-- Rust Axum
```

Adapters obtain or expose the OpenAPI document, host a small page, and serve version-matched local renderer assets. They do not reimplement schemas, request serialization, code samples, Try It, API Client behavior, navigation, or theming.

See [`examples/`](./examples/README.md) and [`docs/distribution.md`](./docs/distribution.md).

## Development

```bash
npm ci
npm run check:example-versions
npm run lint
npm run build:client
npm test -w packages/client -- --runInBand
npm test -w packages/backend -- --runInBand
python3 -m unittest discover -s adapters/python/tests -v
mvn -f adapters/java/pom.xml verify
```

## License

FlexDoc is licensed under **AGPL-3.0-or-later**. See [LICENSE](./LICENSE).

## Project

- Repository: https://github.com/prauga/flexdoc
- Documentation/demo: https://prauga.github.io/flexdoc
- Issues: https://github.com/prauga/flexdoc/issues
