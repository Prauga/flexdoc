# FlexDoc examples

All runnable FlexDoc examples live here and are kept aligned to the source adapter versions by CI.

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
| [`ruby-rack`](./ruby-rack) | Rack + `prauga-flexdoc` gem `0.1.0` |
| [`ruby-rails`](./ruby-rails) | Rails + `prauga-flexdoc` gem `0.1.0` |
| [`go-net-http`](./go-net-http) | `github.com/prauga/flexdoc/adapters/go` `v0.2.0` |
| [`rust-axum`](./rust-axum) | `prauga-flexdoc-axum` `0.2.0` |

## Adapter rule

Every ecosystem owns one native renderer host where practical. Framework integrations register routes or translate responses over that host. The Java, Python, PHP, and Ruby slices all follow this pattern and have dedicated language CI.
