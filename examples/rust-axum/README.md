# Rust + Axum + FlexDoc

This example serves the OpenAPI 3.1 showcase at `/openapi.json` and mounts `prauga-flexdoc-axum` at `/docs`. It demonstrates the current renderer with multi-server/custom-server workflows, auth metadata, request parameters/bodies, Try It, API Client handoff, and code samples.

```bash
cargo run
```

Open `http://localhost:3000/docs`.

`prauga-flexdoc-axum` is pinned to `0.4.0` and resolves directly from the published crate on crates.io. Repository CI also patches crates.io resolution to `../../adapters/rust` when validating source changes against the local adapter.
