use std::{env, sync::Arc};

use axum::{routing::get, Json, Router};
use prauga_flexdoc_axum::{router as flexdoc_router, Config, HostExecution};
use serde_json::{json, Value};

#[tokio::main]
async fn main() {
    let mode = env::var("FLEXDOC_BENCH_MODE").unwrap_or_else(|_| "baseline".into());
    let port: u16 = env::var("FLEXDOC_BENCH_PORT").ok().and_then(|value| value.parse().ok()).unwrap_or(5810);
    let origin = env::var("FLEXDOC_BENCH_ORIGIN").unwrap_or_else(|_| format!("http://127.0.0.1:{port}"));

    let mut app = Router::new()
        .route("/health", get(|| async { Json(json!({"ok": true})) }))
        .route("/target", get(|| async { Json(json!({"ok": true, "runtime": "rust-axum"})) }))
        .route("/openapi.json", get(|| async { Json(openapi()) }));

    if mode != "baseline" {
        let mut config = Config {
            path: "/docs".into(),
            spec_url: "/openapi.json".into(),
            title: "FlexDoc host-impact benchmark".into(),
            try_it_default_server: Some(origin.clone()),
            ..Default::default()
        };
        if mode == "host" {
            let executor = HostExecution::new([origin.clone()]).expect("host execution");
            config.try_it_host_execution = true;
            config.host_execution = Some(Arc::new(executor));
        }
        app = app.merge(flexdoc_router(config));
    }

    let listener = tokio::net::TcpListener::bind(("127.0.0.1", port)).await.expect("bind");
    axum::serve(listener, app).await.expect("serve");
}

fn openapi() -> Value {
    json!({
        "openapi": "3.0.3",
        "info": {"title": "FlexDoc host-impact benchmark", "version": "1.0.0"},
        "paths": {"/target": {"get": {"responses": {"200": {"description": "ok"}}}}}
    })
}
