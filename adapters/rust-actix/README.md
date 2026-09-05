# Prauga FlexDoc for Actix Web

`prauga-flexdoc-actix` `0.3.0` exposes an Actix `Scope` backed by the same canonical FlexDoc renderer shipped by the Axum adapter.

```rust
use actix_web::{App, HttpServer};
use prauga_flexdoc_actix::{scope, Config};

HttpServer::new(|| App::new().service(scope(Config {
    path: "/docs".into(),
    spec_url: "/openapi.json".into(),
    title: "My API".into(),
    ..Default::default()
})))
```

`Config` also accepts `expand`, `try_it_default_server`, `try_it_credentials`, and `try_it_api_client_persistence_key`. Flexible renderer values use `serde_json::Value`, so expansion can be a preset string or section array and persistence can be a string or JSON `false`.

The crate packages renderer JS/CSS locally and serves fingerprinted immutable asset URLs. No CDN or Actix-specific renderer implementation is used.
