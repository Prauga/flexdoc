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
| [`python-fastapi`](./python-fastapi) | `prauga-flexdoc` `0.2.0` |
| [`java-spring`](./java-spring) | `com.prauga.flexdoc:flexdoc-spring-boot-starter` `0.3.0` |
| [`go-net-http`](./go-net-http) | `github.com/prauga/flexdoc/adapters/go` `v0.2.0` |
| [`rust-axum`](./rust-axum) | `prauga-flexdoc-axum` `0.2.0` |

## Full API Client demo

[`api-client`](./api-client) is the dedicated standalone API development workspace. It uses `ApiClientWorkspace`, so it demonstrates arbitrary HTTP requests, auth, query parameters, headers, request bodies, response inspection, local collections/folders, saved requests, and browser-local persistence without requiring an OpenAPI document.

Run it from the repository root:

```bash
npm run example:api-client
```

## Release-candidate validation

Examples keep exact release versions in their manifests. Before those versions are published, CI substitutes the package/adapter built from the same commit (npm workspace/local path, Maven local repository, Cargo patch, Go replace, or local Python wheel). That means the release PR validates the artifact that will be published while preserving copy-pasteable post-release manifests.

Third-party framework versions are independent of the FlexDoc version guard and may use compatible ranges.
