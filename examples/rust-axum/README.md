# Rust + Axum

This example keeps the OpenAPI 3.1 document in memory, serves it at `/openapi.json`, and points the published `prauga-flexdoc-axum` router at that URL.

```bash
cargo run
```

Open `http://localhost:3000/docs`.

`prauga-flexdoc-axum` is intentionally pinned to `0.1.0`; repository CI requires it to match the current Rust adapter version.
