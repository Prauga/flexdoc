# FlexDoc Rust / Axum adapter

Thin Axum routes for FlexDoc. Rust hosts the page and canonical renderer assets; the browser renderer remains the only OpenAPI UI implementation.

```rust
let app = flexdoc_axum::router(flexdoc_axum::Config {
    path: "/docs".into(),
    spec_url: "/openapi.json".into(),
    assets_dir: "./flexdoc-renderer".into(),
    ..Default::default()
});
```

The asset directory must contain `flexdoc.standalone.js` and `flexdoc.standalone.css` from the matching renderer bundle.
