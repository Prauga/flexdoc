# Prauga FlexDoc for Actix Web

`prauga-flexdoc-actix` `0.1.0` exposes an Actix `Scope` backed by the same canonical FlexDoc renderer shipped by the Axum adapter.

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

The crate packages renderer JS/CSS locally and serves fingerprinted immutable asset URLs. No CDN or Actix-specific renderer implementation is used.
