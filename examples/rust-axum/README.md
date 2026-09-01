# Rust + Axum + FlexDoc

This example serves the OpenAPI 3.1 showcase at `/openapi.json` and mounts `prauga-flexdoc-axum` at `/docs`. It demonstrates the current renderer with multi-server/custom-server workflows, auth metadata, request parameters/bodies, Try It, API Client handoff, and code samples.

```bash
cargo run
```

Open `http://localhost:3000/docs`.

`prauga-flexdoc-axum` is pinned to `0.2.0`. During this release PR, CI patches crates.io resolution to `../../adapters/rust`; after `0.2.0` is published, the manifest is directly runnable as written.
