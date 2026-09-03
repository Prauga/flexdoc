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
