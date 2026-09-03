# FlexDoc examples

All runnable FlexDoc examples live in this directory. They represent the **current FlexDoc release represented by this repository** and are intentionally kept in lockstep with source manifests so copyable examples do not describe an older API.

CI runs `npm run check:example-versions` and fails if an example drifts behind the source package/adapter version.

| Example | FlexDoc package |
| --- | --- |
| [`basic-usage`](./basic-usage) | React + `@prauga/flexdoc-client` `2.2.0` |
| [`interactive-demo`](./interactive-demo) | React + `@prauga/flexdoc-client` `2.2.0` |
| [`api-client`](./api-client) | Full API Client + `@prauga/flexdoc-client` `2.2.0` |
| [`nestjs`](./nestjs) | NestJS + `@prauga/flexdoc-backend` `2.2.0` |
| [`javascript-express`](./javascript-express) | `@prauga/flexdoc-backend` `2.2.0` |
| [`javascript-fastify`](./javascript-fastify) | `@prauga/flexdoc-backend` `2.2.0` |
| [`dotnet-aspnetcore`](./dotnet-aspnetcore) | `Prauga.FlexDoc.AspNetCore` `0.1.0` |
| [`python-fastapi`](./python-fastapi) | `prauga-flexdoc` `0.3.0` |
| [`python-flask`](./python-flask) | Flask + `prauga-flexdoc` `0.3.0` |
| [`python-django`](./python-django) | Django + `prauga-flexdoc` `0.3.0` |
| [`java-spring`](./java-spring) | `com.prauga.flexdoc:flexdoc-spring-boot-starter` `0.4.0` |
| [`java-quarkus`](./java-quarkus) | Quarkus + `com.prauga.flexdoc:flexdoc-jaxrs` `0.4.0` |
| [`java-micronaut`](./java-micronaut) | Micronaut + `com.prauga.flexdoc:flexdoc-jvm` `0.4.0` |
| [`java-guice`](./java-guice) | Guice/JDK HTTP + `com.prauga.flexdoc:flexdoc-jvm` `0.4.0` |
| [`php-laravel`](./php-laravel) | Laravel + `prauga/flexdoc` `0.1.0` |
| [`php-symfony`](./php-symfony) | Symfony + `prauga/flexdoc` `0.1.0` |
| [`go-net-http`](./go-net-http) | `github.com/prauga/flexdoc/adapters/go` `v0.2.0` |
| [`rust-axum`](./rust-axum) | `prauga-flexdoc-axum` `0.2.0` |

## Architecture coverage

The Java, Python, and PHP examples follow the same rule: one framework-neutral host per runtime owns the renderer shell/assets and framework integrations only translate HTTP responses or register routes. Dedicated language workflows exercise those integrations against real framework components.

## Release-candidate validation

Examples keep exact release versions in their manifests. Before those versions are published, CI substitutes or builds the package/adapter from the same commit where the ecosystem supports it. Third-party framework versions remain independent.
