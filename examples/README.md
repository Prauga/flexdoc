# FlexDoc examples

All runnable FlexDoc examples live in this directory. They represent the **current FlexDoc release represented by this repository** and are intentionally kept in lockstep with source manifests so copyable examples do not describe an older API.

The direct-spec examples share [`showcase-openapi.json`](./showcase-openapi.json), an OpenAPI 3.1 document that exercises the current renderer and request engine: multiple servers, server variables, localhost/custom-server workflows, path/query/header parameters, arrays and `deepObject`, API key/Basic/Bearer/OAuth metadata, JSON/form/multipart bodies, reusable schemas/responses, extensions, code samples, Try It, and the Try It → API Client handoff.

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
| [`go-net-http`](./go-net-http) | `github.com/prauga/flexdoc/adapters/go` `v0.2.0` |
| [`rust-axum`](./rust-axum) | `prauga-flexdoc-axum` `0.2.0` |

## Full API Client demo

[`api-client`](./api-client) is the dedicated standalone API development workspace. It uses `ApiClientWorkspace`, so it demonstrates arbitrary HTTP requests, auth, query parameters, headers, request bodies, response inspection, local collections/folders, saved requests, and browser-local persistence without requiring an OpenAPI document.

Run it from the repository root:

```bash
npm run example:api-client
```

## JVM coverage

The Java 0.4.0 family intentionally separates renderer hosting from frameworks. `java-spring` proves the existing Spring Boot starter still works after delegating to `flexdoc-jvm`; `java-quarkus` exercises the Jakarta REST adapter in a real Quarkus test runtime; `java-micronaut` maps Micronaut HTTP routes directly to the neutral host; and `java-guice` binds the same host through Guice and serves it with the JDK HTTP server, which is also the integration model for Governator-style Guice applications.

## Python coverage

The Python 0.3.0 package follows the same pattern: `FlexDocHost` owns renderer hosting, `FlexDocASGI` and `FlexDocWSGI` are protocol transports, and the FastAPI/Flask/Django helpers are thin native integrations. CI exercises all three framework examples against the locally built wheel.

## Release-candidate validation

Examples keep exact release versions in their manifests. Before those versions are published, CI substitutes the package/adapter built from the same commit (npm workspace/local path, Maven local repository, Cargo patch, Go replace, local Python wheel, or project reference). That means the release PR validates the artifact that will be published while preserving copy-pasteable post-release manifests.

Third-party framework versions are independent of the FlexDoc version guard and may use compatible ranges.
