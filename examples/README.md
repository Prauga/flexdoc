# FlexDoc examples

All runnable or compile/smoke-tested FlexDoc framework examples live here. CI keeps FlexDoc package versions aligned with their source manifests.

| Example | FlexDoc package / integration |
| --- | --- |
| [`basic-usage`](./basic-usage) | React + `@prauga/flexdoc-client` `2.8.0` |
| [`interactive-demo`](./interactive-demo) | React + `@prauga/flexdoc-client` `2.8.0` |
| [`api-client`](./api-client) | Full API Client + `@prauga/flexdoc-client` `2.8.0` |
| [`nestjs`](./nestjs) | NestJS + `@prauga/flexdoc-backend` `2.8.0` |
| [`javascript-express`](./javascript-express) | Express + `@prauga/flexdoc-backend` `2.8.0` |
| [`javascript-fastify`](./javascript-fastify) | Fastify + `@prauga/flexdoc-backend` `2.8.0` |
| [`javascript-hono`](./javascript-hono) | Hono + `@prauga/flexdoc-backend` `2.8.0` |
| [`dotnet-aspnetcore`](./dotnet-aspnetcore) | `Prauga.FlexDoc.AspNetCore` `0.3.0` |
| [`java-spring`](./java-spring) | Spring Boot + `flexdoc-spring-boot-starter` `0.6.0` |
| [`java-quarkus`](./java-quarkus) | Quarkus/Jakarta REST + `flexdoc-jaxrs` `0.6.0` |
| [`java-micronaut`](./java-micronaut) | Micronaut + `flexdoc-jvm` `0.6.0` |
| [`java-guice`](./java-guice) | Guice/JDK HTTP + `flexdoc-jvm` `0.6.0` |
| [`kotlin-ktor`](./kotlin-ktor) | Ktor 3.5.2 + `flexdoc-jvm` `0.6.0` |
| [`python-fastapi`](./python-fastapi) | FastAPI/ASGI + `prauga-flexdoc` `0.5.0` |
| [`python-flask`](./python-flask) | Flask/WSGI + `prauga-flexdoc` `0.5.0` |
| [`python-django`](./python-django) | Django + `prauga-flexdoc` `0.5.0` |
| [`php-laravel`](./php-laravel) | Laravel + `prauga/flexdoc` `0.3.0` |
| [`php-symfony`](./php-symfony) | Symfony + `prauga/flexdoc` `0.3.0` |
| [`ruby-rack`](./ruby-rack) | Rack + `prauga-flexdoc` gem `0.3.0` |
| [`ruby-rails`](./ruby-rails) | Rails + `prauga-flexdoc` gem `0.3.0` |
| [`go-net-http`](./go-net-http) | Go `net/http` adapter `v0.4.0` |
| [`go-gin`](./go-gin) | Gin over the `net/http` adapter `v0.4.0` |
| [`go-chi`](./go-chi) | Chi over the `net/http` adapter `v0.4.0` |
| [`go-echo`](./go-echo) | Echo v5 over the `net/http` adapter `v0.4.0` |
| [`go-fiber`](./go-fiber) | Fiber v3 direct `net/http` adaptation, adapter `v0.4.0` |
| [`rust-axum`](./rust-axum) | `prauga-flexdoc-axum` `0.4.0` |
| [`rust-actix`](./rust-actix) | `prauga-flexdoc-actix` `0.3.0` |
| [`elixir-phoenix`](./elixir-phoenix) | Phoenix forwarding `prauga_flexdoc` Plug `0.3.0` |

## Design rule

One canonical renderer remains the source of truth. Where a runtime has a useful neutral host boundary (JVM, Python, PHP, Ruby, Go/`net/http`, Plug), framework integrations compose that host rather than creating new renderer implementations. Dedicated packages exist only where transport/runtime boundaries require them, such as ASP.NET Core, Axum, Actix Web, and Plug packaging.
