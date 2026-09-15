use std::{env, sync::Arc};

use actix_web::{web, App, HttpResponse, HttpServer};
use prauga_flexdoc_actix::{scope, Config, HostExecution};
use serde_json::json;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let mode = env::var("FLEXDOC_BENCH_MODE").unwrap_or_else(|_| "baseline".into());
    let port: u16 = env::var("FLEXDOC_BENCH_PORT").ok().and_then(|value| value.parse().ok()).unwrap_or(5810);
    let origin = env::var("FLEXDOC_BENCH_ORIGIN").unwrap_or_else(|_| format!("http://127.0.0.1:{port}"));

    let flex_config = if mode == "baseline" {
        None
    } else {
        let mut config = Config {
            path: "/docs".into(),
            spec_url: "/openapi.json".into(),
            title: "FlexDoc host-impact benchmark".into(),
            try_it_default_server: Some(origin.clone()),
            ..Default::default()
        };
        if mode == "host" {
            config.try_it_host_execution = true;
            config.host_execution = Some(Arc::new(HostExecution::new([origin.clone()]).expect("host execution")));
        }
        Some(config)
    };

    HttpServer::new(move || {
        let app = App::new()
            .route("/health", web::get().to(|| async { HttpResponse::Ok().json(json!({"ok": true})) }))
            .route("/target", web::get().to(|| async { HttpResponse::Ok().json(json!({"ok": true, "runtime": "rust-actix"})) }))
            .route("/openapi.json", web::get().to(|| async { HttpResponse::Ok().json(openapi()) }));
        match flex_config.clone() {
            Some(config) => app.service(scope(config)),
            None => app,
        }
    })
    .bind(("127.0.0.1", port))?
    .workers(2)
    .run()
    .await
}

fn openapi() -> serde_json::Value {
    json!({
        "openapi": "3.0.3",
        "info": {"title": "FlexDoc host-impact benchmark", "version": "1.0.0"},
        "paths": {"/target": {"get": {"responses": {"200": {"description": "ok"}}}}}
    })
}
