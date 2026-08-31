# Prauga FlexDoc Rust / Axum adapter

`prauga-flexdoc-axum` provides self-contained Axum routes for FlexDoc. The crate embeds the canonical browser renderer instead of implementing OpenAPI UI behavior in Rust.

With an existing OpenAPI endpoint:

```rust
let app = prauga_flexdoc_axum::router(prauga_flexdoc_axum::Config {
    path: "/docs".into(),
    spec_url: "/openapi.json".into(),
    ..Default::default()
});
```

For code-first APIs using `utoipa`, pass the generated document directly:

```rust
use utoipa::OpenApi;

let docs = prauga_flexdoc_axum::router_with_openapi(
    prauga_flexdoc_axum::Config::default(),
    &ApiDoc::openapi(),
)?;
```

`router_with_openapi` accepts any `serde::Serialize` OpenAPI value, serves it beneath the FlexDoc route, and requires no separate application-owned spec endpoint.

The published crate includes the version-matched renderer JS/CSS under `assets/`.
