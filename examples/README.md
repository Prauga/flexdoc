# FlexDoc examples

These examples are intentionally small, runnable integrations that use the **current FlexDoc release versions represented by this repository**.

CI runs `npm run check:example-versions` and fails if an example drifts behind the source package/adapter version, so version bumps must update the examples in the same change.

| Example | FlexDoc package |
| --- | --- |
| [`javascript-express`](./javascript-express) | `@prauga/flexdoc-backend` `2.1.0` |
| [`javascript-fastify`](./javascript-fastify) | `@prauga/flexdoc-backend` `2.1.0` |
| [`python-fastapi`](./python-fastapi) | `prauga-flexdoc` `0.1.0` |
| [`java-spring`](./java-spring) | `com.prauga.flexdoc:flexdoc-spring-boot-starter` `0.2.0` |
| [`go-net-http`](./go-net-http) | `github.com/prauga/flexdoc/adapters/go` `v0.1.0` |
| [`rust-axum`](./rust-axum) | `prauga-flexdoc-axum` `0.1.0` |

The existing React and NestJS examples remain under [`packages/examples`](../packages/examples):

- `basic-usage` — React + `@prauga/flexdoc-client` `2.1.0`
- `interactive-demo` — React + `@prauga/flexdoc-client` `2.1.0`
- `nestjs` — NestJS + `@prauga/flexdoc-backend` `2.1.0`

## Version policy

Examples use exact FlexDoc versions on purpose. This makes every example describe the release it was tested against, while the CI version guard forces those exact pins to move whenever the corresponding package/adapter version changes.

Third-party framework versions are independent of this rule and may use compatible ranges.
