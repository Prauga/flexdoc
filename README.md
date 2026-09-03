# FlexDoc

FlexDoc is Prauga's open-source, self-hosted OpenAPI documentation renderer and API explorer. It ships one canonical browser renderer and thin ecosystem adapters, so React, Node backends, ASP.NET Core, JVM frameworks, Go, Python, Rust, and static exports use the same OpenAPI behavior and UI.

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
- Express, Fastify, NestJS, ASP.NET Core, Spring Boot, Jakarta REST/Quarkus, Micronaut, Guice-style JVM, FastAPI/ASGI, Flask/WSGI, Django, Go `net/http`, and Rust Axum integrations

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
| crates.io | `prauga-flexdoc-axum` | `0.2.0` |
| Go | `github.com/prauga/flexdoc/adapters/go` | `0.2.0` |

These versions are independent across ecosystems. Renderer contract v1 is the compatibility boundary.

## Examples

All runnable examples are consolidated in [`examples/`](./examples/README.md), including React, the standalone API Client, Node frameworks, ASP.NET Core, FastAPI, Flask, Django, Spring Boot, Quarkus, Micronaut, Guice, Go and Rust.

## React

```bash
npm install @prauga/flexdoc-client@^2.2
```

## Node backend integrations

```bash
npm install @prauga/flexdoc-backend@^2.2
```

Express, Fastify, and NestJS helpers use the same canonical renderer.

## ASP.NET Core

```csharp
app.MapFlexDoc(options => {
    options.Path = "/docs";
    options.SpecUrl = "/openapi.json";
    options.Title = "My API";
});
```

## Java / JVM

The Java family is coordinated at `0.4.0`. `flexdoc-jvm` owns the renderer host with no web-framework dependency; Spring Boot and Jakarta REST are thin transports over it. Quarkus, Micronaut, and Guice/Governator-style applications are exercised through real examples.

## Python

The Python package is `prauga-flexdoc` `0.3.0`. `FlexDocHost` owns renderer hosting; `FlexDocASGI` and `FlexDocWSGI` are thin protocol transports.

FastAPI:

```python
from prauga_flexdoc import setup_fastapi_flexdoc
setup_fastapi_flexdoc(app, '/docs', title='My API')
```

Flask:

```python
from prauga_flexdoc import setup_flask_flexdoc
setup_flask_flexdoc(app, '/docs', spec_url='/openapi.json', title='My API')
```

Django:

```python
from prauga_flexdoc import django_urlpatterns
urlpatterns = [*django_urlpatterns('/docs', spec_url='/openapi.json', title='My API')]
```

## Go

The Go module exposes a standard `net/http` handler and embeds the exact canonical renderer assets at release time.

## Rust / Axum

The Axum crate embeds the canonical JS/CSS with `include_bytes!`.

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
      +--> React / standalone / CLI
      +--> Express / Fastify / NestJS
      +--> ASP.NET Core
      +--> JVM host --> Spring Boot / Jakarta REST / Quarkus / Micronaut / Guice-Governator
      +--> Python host --> ASGI / WSGI / FastAPI / Flask / Django
      +--> Go net/http
      +--> Rust Axum
```

Adapters obtain or expose the OpenAPI document, host a small page, and serve version-matched local renderer assets. They do not reimplement schemas, request serialization, code samples, Try It, API Client behavior, navigation, or theming.

## Development

```bash
npm ci
npm run check:example-versions
npm run lint
npm run build:client
npm test -w packages/client -- --runInBand
npm test -w packages/backend -- --runInBand
npm run check:adapter-assets
python3 -m unittest discover -s adapters/python/tests -v
mvn -f adapters/java/pom.xml verify
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
