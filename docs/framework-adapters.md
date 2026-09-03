# Framework adapters

FlexDoc framework support follows one rule: **one canonical renderer, minimal native hosting code**.

## Coverage matrix

| Runtime | Neutral host / package | Framework paths |
| --- | --- | --- |
| Node | `@prauga/flexdoc-backend` | Express, Fastify, NestJS, Hono |
| .NET | `Prauga.FlexDoc.AspNetCore` | ASP.NET Core |
| JVM | `flexdoc-jvm` + `flexdoc-jaxrs` | Spring Boot, Jakarta/JAX-RS, Quarkus, Micronaut, Guice/Governator, Ktor |
| Python | `prauga-flexdoc` (`FlexDocHost`) | ASGI/FastAPI/Starlette, WSGI/Flask, Django |
| PHP | `prauga/flexdoc` (`FlexDocHost`) | Laravel, Symfony |
| Ruby | `prauga-flexdoc` (`Host` + `RackApp`) | Rack, Rails |
| Go | `github.com/prauga/flexdoc/adapters/go` (`net/http`) | net/http, Gin, Chi, Echo, Fiber v3 |
| Rust | `prauga-flexdoc-axum`, `prauga-flexdoc-actix` | Axum, Actix Web |
| Elixir | `prauga_flexdoc` Plug | Plug, Phoenix |

Frameworks that already accept a neutral host directly get examples/helpers instead of new package fragmentation. All committed renderer assets are synchronized from `packages/client/dist/standalone` and checked byte-for-byte in CI.

### Path ownership notes

- Jakarta REST/JAX-RS class-level `@Path` values are compile-time annotations. The packaged `FlexDocJaxRsResource` is rooted at `/docs`; custom paths require a subclass/application resource with a different `@Path`, and its `FlexDocHost` must be configured to the same path.
- Rails mounts the shared Rack transport. `Rails.mount(..., at:)` requires `at:` to match `host.config.path`; mismatches are rejected immediately rather than leaving the page mounted while renderer asset requests 404.
