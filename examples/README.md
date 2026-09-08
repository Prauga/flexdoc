# FlexDoc examples

These examples are the executable capability map for FlexDoc 3.0. During release preparation their manifests remain pinned to the last published registry artifacts so clean installs keep working. CI explicitly substitutes locally built release candidates where source-version validation is required. A post-publish lock-refresh change advances the registry pins.

The examples deliberately separate two kinds of capability:

- **Canonical renderer/API Client** features are framework-neutral and are available wherever the same FlexDoc renderer is hosted.
- **Runtime Intelligence** is advertised only when FlexDoc is installed inside a backend integration that can inspect a genuine framework route inventory. No example synthesizes runtime data from OpenAPI to make the matrix look broader than the implementation really is.

| Example | FlexDoc package / integration | 3.0 focus | Runtime Intelligence |
| --- | --- | --- | --- |
| [`basic-usage`](./basic-usage) | React + `@prauga/flexdoc-client` `3.1.0` | Minimal renderer integration | — client only |
| [`interactive-demo`](./interactive-demo) | React + `@prauga/flexdoc-client` `3.1.0` | **Complete framework-neutral renderer**: deep links, preferences, command palette, Try It → API Client, downloads, code samples, responsive/a11y chrome | — client only |
| [`api-client`](./api-client) | Full API Client + `@prauga/flexdoc-client` `3.1.0` | **Complete standalone API Client**: environments, variables, CodeMirror scripts, runner/history, response inspection, persistence, shortcuts | — client only |
| [`nestjs`](./nestjs) | NestJS + `@prauga/flexdoc-backend` `3.1.0` | Code-first OpenAPI + full renderer/API Client | **Yes — underlying Express/Fastify adapter** |
| [`javascript-express`](./javascript-express) | Express + `@prauga/flexdoc-backend` `3.1.0` | Primary backend-native 3.0 showcase with intentional route drift | **Yes — live Express router** |
| [`javascript-fastify`](./javascript-fastify) | Fastify + `@prauga/flexdoc-backend` `3.1.0` | Shared OpenAPI showcase + intentional runtime-only route | **Yes — live Fastify route tree** |
| [`javascript-hono`](./javascript-hono) | Hono + `@prauga/flexdoc-backend` `3.1.0` | Small inline contract + intentional runtime-only route | **Yes — live Hono route inventory** |
| [`dotnet-aspnetcore`](./dotnet-aspnetcore) | `Prauga.FlexDoc.AspNetCore` `0.5.1` | Exact server-side contract + runtime-only minimal API route | **Yes — `EndpointDataSource`** |
| [`java-spring`](./java-spring) | Spring Boot + `flexdoc-spring-boot-starter` `0.8.1` | Exact `FlexDocSpecProvider` contract + runtime-only MVC route | **Yes — `RequestMappingHandlerMapping`** |
| [`java-quarkus`](./java-quarkus) | Quarkus/Jakarta REST + `flexdoc-jaxrs` `0.8.1` | Canonical JVM renderer hosting | No in current 3.0 slice |
| [`java-micronaut`](./java-micronaut) | Micronaut + `flexdoc-jvm` `0.8.1` | Canonical JVM renderer hosting | No in current 3.0 slice |
| [`java-guice`](./java-guice) | Guice/JDK HTTP + `flexdoc-jvm` `0.8.1` | Framework-neutral JVM host | No — no framework route integration |
| [`kotlin-ktor`](./kotlin-ktor) | Ktor 3.5.2 + `flexdoc-jvm` `0.8.1` | Canonical JVM renderer hosting | No in current 3.0 slice |
| [`python-fastapi`](./python-fastapi) | FastAPI/ASGI + `prauga-flexdoc` `0.7.1` | Code-first OpenAPI + hidden runtime-only route | **Yes — live FastAPI/Starlette routes** |
| [`python-flask`](./python-flask) | Flask/WSGI + `prauga-flexdoc` `0.7.1` | Canonical renderer hosting | No — neutral WSGI host |
| [`python-django`](./python-django) | Django + `prauga-flexdoc` `0.7.1` | Canonical renderer hosting | No — neutral Django host |
| [`php-laravel`](./php-laravel) | Laravel + `prauga/flexdoc` `0.4.3` | Canonical PHP renderer hosting | No in current 3.0 slice |
| [`php-symfony`](./php-symfony) | Symfony + `prauga/flexdoc` `0.4.3` | Canonical PHP renderer hosting | No in current 3.0 slice |
| [`ruby-rack`](./ruby-rack) | Rack + `prauga-flexdoc` gem `0.4.3` | Neutral Rack renderer hosting | No |
| [`ruby-rails`](./ruby-rails) | Rails + `prauga-flexdoc` gem `0.4.3` | Canonical Ruby renderer hosting | No in current 3.0 slice |
| [`go-net-http`](./go-net-http) | Go `net/http` adapter `v0.5.3` | Neutral Go renderer hosting | No — neutral router boundary |
| [`go-gin`](./go-gin) | Gin over the `net/http` adapter `v0.5.3` | Framework example over neutral host | No in current 3.0 slice |
| [`go-chi`](./go-chi) | Chi over the `net/http` adapter `v0.5.3` | Framework example over neutral host | No in current 3.0 slice |
| [`go-echo`](./go-echo) | Echo v5 over the `net/http` adapter `v0.5.3` | Framework example over neutral host | No in current 3.0 slice |
| [`go-fiber`](./go-fiber) | Fiber v3 direct `net/http` adaptation, adapter `v0.5.3` | Framework example over neutral host | No in current 3.0 slice |
| [`rust-axum`](./rust-axum) | `prauga-flexdoc-axum` `0.5.3` | Canonical Rust renderer hosting | No in current 3.0 slice |
| [`rust-actix`](./rust-actix) | `prauga-flexdoc-actix` `0.4.3` | Canonical Rust renderer hosting | No in current 3.0 slice |
| [`elixir-phoenix`](./elixir-phoenix) | Phoenix forwarding `prauga_flexdoc` Plug `0.4.3` | Canonical Plug renderer hosting | No in current 3.0 slice |

## What to run for the 3.0 surface

Start with `javascript-express` when evaluating FlexDoc as a product: it demonstrates the full documentation/API Client experience **and** the backend-native distinction, including a route that exists in the running application but not in OpenAPI. Use `interactive-demo` for the framework-neutral renderer surface and `api-client` for focused API-development workflows.

Runtime-capable examples intentionally include either a runtime-only route or a live controller/router inventory so the Runtime panel demonstrates evidence from the running backend rather than repeating the specification.

## Design rule

One canonical renderer remains the source of truth. Where a runtime has a useful neutral host boundary (JVM, Python, PHP, Ruby, Go/`net/http`, Plug), framework integrations compose that host rather than creating new renderer implementations. Dedicated packages exist only where transport/runtime boundaries require them, such as ASP.NET Core, Axum, Actix Web, and Plug packaging.

The package numbers above are the last published registry versions used by standalone examples during release preparation. The source release-candidate versions are listed in the root README and `docs/distribution.md`; examples move to them only after the matching packages and tags are public.
