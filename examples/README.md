# FlexDoc examples

These examples are the executable capability map for the current FlexDoc 3.1 release. Registry-consuming manifests and generated locks are pinned to the published package versions listed below so clean standalone installs remain reproducible. Repository CI may substitute packages built from the current commit when validating source changes.

The examples deliberately separate two kinds of capability:

- **Canonical renderer/API Client** features are framework-neutral and are available wherever the same FlexDoc renderer is hosted.
- **Runtime Intelligence** is advertised only when FlexDoc is installed inside a backend integration that can inspect a genuine framework route inventory. No example synthesizes runtime data from OpenAPI to make the matrix look broader than the implementation really is.

| Example | FlexDoc package / integration | Current focus | Runtime Intelligence |
| --- | --- | --- | --- |
| [`basic-usage`](./basic-usage) | React + `@prauga/flexdoc-client` `3.1.0` | Minimal renderer integration | — client only |
| [`interactive-demo`](./interactive-demo) | React + `@prauga/flexdoc-client` `3.1.0` | **Complete framework-neutral renderer**: deep links, preferences, command palette, Try It → API Client, downloads, code samples, responsive/a11y chrome | — client only |
| [`api-client`](./api-client) | Full API Client + `@prauga/flexdoc-client` `3.1.0` | **Complete standalone API Client**: environments, variables, CodeMirror scripts, runner/history, response inspection, persistence, shortcuts | — client only |
| [`nestjs`](./nestjs) | NestJS + `@prauga/flexdoc-backend` `3.1.0` | Code-first OpenAPI + full renderer/API Client | **Yes — underlying Express/Fastify adapter** |
| [`javascript-express`](./javascript-express) | Express + `@prauga/flexdoc-backend` `3.1.0` | Primary backend-native showcase with intentional route drift | **Yes — live Express router** |
| [`javascript-fastify`](./javascript-fastify) | Fastify + `@prauga/flexdoc-backend` `3.1.0` | Shared OpenAPI showcase + intentional runtime-only route | **Yes — live Fastify route tree** |
| [`javascript-hono`](./javascript-hono) | Hono + `@prauga/flexdoc-backend` `3.1.0` | Small inline contract + intentional runtime-only route | **Yes — live Hono route inventory** |
| [`dotnet-aspnetcore`](./dotnet-aspnetcore) | `Prauga.FlexDoc.AspNetCore` `0.5.1` | Exact server-side contract + runtime-only minimal API route | **Yes — `EndpointDataSource`** |
| [`java-spring`](./java-spring) | Spring Boot + `flexdoc-spring-boot-starter` `0.8.1` | Exact `FlexDocSpecProvider` contract + runtime-only MVC route | **Yes — `RequestMappingHandlerMapping`** |
| [`java-quarkus`](./java-quarkus) | Quarkus/Jakarta REST + `flexdoc-jaxrs` `0.8.1` | Canonical JVM renderer hosting | No in current slice |
| [`java-micronaut`](./java-micronaut) | Micronaut + `flexdoc-jvm` `0.8.1` | Canonical JVM renderer hosting | No in current slice |
| [`java-guice`](./java-guice) | Guice/JDK HTTP + `flexdoc-jvm` `0.8.1` | Framework-neutral JVM host | No — no framework route integration |
| [`kotlin-ktor`](./kotlin-ktor) | Ktor 3.5.2 + `flexdoc-jvm` `0.8.1` | Canonical JVM renderer hosting | No in current slice |
| [`python-fastapi`](./python-fastapi) | FastAPI/ASGI + `prauga-flexdoc` `0.7.1` | Code-first OpenAPI + hidden runtime-only route | **Yes — live FastAPI/Starlette routes** |
| [`python-flask`](./python-flask) | Flask/WSGI + `prauga-flexdoc` `0.7.1` | Canonical renderer hosting | No — neutral WSGI host |
| [`python-django`](./python-django) | Django + `prauga-flexdoc` `0.7.1` | Canonical renderer hosting | No — neutral Django host |
| [`php-laravel`](./php-laravel) | Laravel + `prauga/flexdoc` `0.4.3` | Canonical PHP renderer hosting | No in current slice |
| [`php-symfony`](./php-symfony) | Symfony + `prauga/flexdoc` `0.4.3` | Canonical PHP renderer hosting | No in current slice |
| [`ruby-rack`](./ruby-rack) | Rack + `prauga-flexdoc` gem `0.4.3` | Neutral Rack renderer hosting | No |
| [`ruby-rails`](./ruby-rails) | Rails + `prauga-flexdoc` gem `0.4.3` | Canonical Ruby renderer hosting | No in current slice |
| [`go-net-http`](./go-net-http) | Go `net/http` adapter `v0.5.3` | Neutral Go renderer hosting | No — neutral router boundary |
| [`go-gin`](./go-gin) | Gin over the `net/http` adapter `v0.5.3` | Framework example over neutral host | No in current slice |
| [`go-chi`](./go-chi) | Chi over the `net/http` adapter `v0.5.3` | Framework example over neutral host | No in current slice |
| [`go-echo`](./go-echo) | Echo v5 over the `net/http` adapter `v0.5.3` | Framework example over neutral host | No in current slice |
| [`go-fiber`](./go-fiber) | Fiber v3 direct `net/http` adaptation, adapter `v0.5.3` | Framework example over neutral host | No in current slice |
| [`rust-axum`](./rust-axum) | `prauga-flexdoc-axum` `0.5.3` | Canonical Rust renderer hosting | No in current slice |
| [`rust-actix`](./rust-actix) | `prauga-flexdoc-actix` `0.4.3` | Canonical Rust renderer hosting | No in current slice |
| [`elixir-phoenix`](./elixir-phoenix) | Phoenix forwarding `prauga_flexdoc` Plug `0.4.3` | Canonical Plug renderer hosting | No in current slice |

## What to run for the current surface

Start with `javascript-express` when evaluating FlexDoc as a product: it demonstrates the full documentation/API Client experience **and** the backend-native distinction, including a route that exists in the running application but not in OpenAPI. Use `interactive-demo` for the framework-neutral renderer surface and `api-client` for focused API-development workflows.

Runtime-capable examples intentionally include either a runtime-only route or a live controller/router inventory so the Runtime panel demonstrates evidence from the running backend rather than repeating the specification.

## Design rule

One canonical renderer remains the source of truth. Where a runtime has a useful neutral host boundary (JVM, Python, PHP, Ruby, Go/`net/http`, Plug), framework integrations compose that host rather than creating new renderer implementations. Dedicated packages exist only where transport/runtime boundaries require them, such as ASP.NET Core, Axum, Actix Web, and Plug packaging.

The package numbers above are the published registry versions used by standalone examples. CI may substitute locally built packages when validating source changes, but the checked-in registry pins and generated locks intentionally track public artifacts.
