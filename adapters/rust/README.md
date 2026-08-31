# Prauga FlexDoc Rust / Axum adapter

`prauga-flexdoc-axum` provides self-contained Axum routes for FlexDoc. The crate embeds the canonical browser renderer instead of implementing OpenAPI UI behavior in Rust.

```rust
let app = prauga_flexdoc_axum::router(prauga_flexdoc_axum::Config {
    path: "/docs".into(),
    spec_url: "/openapi.json".into(),
    ..Default::default()
});
```

The published crate includes the version-matched renderer JS/CSS under `assets/`.
