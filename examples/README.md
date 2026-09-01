# FlexDoc examples

These examples are runnable integrations for the **current FlexDoc release represented by this repository**. They are intentionally kept in lockstep with the source manifests so the examples users copy never describe an older FlexDoc API.

The direct-spec examples share [`showcase-openapi.json`](./showcase-openapi.json), an OpenAPI 3.1 document that exercises the current renderer and request engine: multiple servers, server variables, localhost/custom-server workflows, path/query/header parameters, arrays and `deepObject`, API key/Basic/Bearer/OAuth metadata, JSON/form/multipart bodies, reusable schemas/responses, extensions, code samples, Try It, and the Try It → API Client handoff.

CI runs `npm run check:example-versions` and fails if an example drifts behind the source package/adapter version.

| Example | FlexDoc package |
| --- | --- |
| [`javascript-express`](./javascript-express) | `@prauga/flexdoc-backend` `2.2.0` |
| [`javascript-fastify`](./javascript-fastify) | `@prauga/flexdoc-backend` `2.2.0` |
| [`python-fastapi`](./python-fastapi) | `prauga-flexdoc` `0.2.0` |
| [`java-spring`](./java-spring) | `com.prauga.flexdoc:flexdoc-spring-boot-starter` `0.3.0` |
| [`go-net-http`](./go-net-http) | `github.com/prauga/flexdoc/adapters/go` `v0.2.0` |
| [`rust-axum`](./rust-axum) | `prauga-flexdoc-axum` `0.2.0` |

The React and NestJS examples live under [`packages/examples`](../packages/examples):

- `basic-usage` — React + `@prauga/flexdoc-client` `2.2.0`
- `interactive-demo` — React + `@prauga/flexdoc-client` `2.2.0`
- `nestjs` — NestJS + `@prauga/flexdoc-backend` `2.2.0`

## Release-candidate validation

Examples keep exact release versions in their manifests. Before those versions are published, CI substitutes the package/adapter built from the same commit (npm workspace/local path, Maven local repository, Cargo patch, Go replace, or local Python wheel). That means the release PR validates the artifact that will be published while preserving copy-pasteable post-release manifests.

Third-party framework versions are independent of the FlexDoc version guard and may use compatible ranges.
