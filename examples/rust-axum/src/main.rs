use axum::{routing::get, Json, Router};
use serde_json::{json, Value};

fn openapi_spec() -> Value {
    json!({
        "openapi": "3.1.0",
        "info": { "title": "FlexDoc Rust example", "version": "1.0.0" },
        "servers": [{ "url": "http://localhost:3000" }],
        "paths": {
            "/hello": {
                "get": {
                    "summary": "Say hello",
                    "responses": {
                        "200": {
                            "description": "Greeting",
                            "content": {
                                "application/json": {
                                    "schema": {
                                        "type": "object",
                                        "properties": { "message": { "type": "string" } }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    })
}

async fn hello() -> Json<Value> {
    Json(json!({ "message": "Hello from Rust!" }))
}

async fn openapi() -> Json<Value> {
    Json(openapi_spec())
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let docs = prauga_flexdoc_axum::router(prauga_flexdoc_axum::Config {
        path: "/docs".into(),
        spec_url: "/openapi.json".into(),
        title: "FlexDoc Rust example".into(),
        try_it_enabled: true,
        ..Default::default()
    });

    let app = Router::new()
        .route("/hello", get(hello))
        .route("/openapi.json", get(openapi))
        .merge(docs);
    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await?;
    println!("API:  http://localhost:3000/hello");
    println!("Docs: http://localhost:3000/docs");
    axum::serve(listener, app).await?;
    Ok(())
}
