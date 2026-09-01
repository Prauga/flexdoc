use axum::{extract::Path, routing::{get, post}, Json, Router};
use serde_json::{json, Value};

fn openapi_spec() -> Value {
    serde_json::from_str(include_str!("../../showcase-openapi.json"))
        .expect("shared FlexDoc showcase OpenAPI document must be valid JSON")
}

async fn list_pets() -> Json<Value> {
    Json(json!([
        { "id": "pet-1", "name": "Miso", "status": "available", "age": 3, "tags": ["friendly", "adoptable"] }
    ]))
}

async fn create_pet(Json(body): Json<Value>) -> Json<Value> {
    Json(json!({
        "id": "pet-new",
        "status": body.get("status").cloned().unwrap_or_else(|| json!("available")),
        "name": body.get("name").cloned().unwrap_or_else(|| json!("Miso")),
        "age": body.get("age").cloned().unwrap_or_else(|| json!(3)),
        "tags": body.get("tags").cloned().unwrap_or_else(|| json!(["friendly"]))
    }))
}

async fn get_pet(Path(pet_id): Path<String>) -> Json<Value> {
    Json(json!({ "id": pet_id, "name": "Miso", "status": "available", "age": 3, "tags": ["friendly"] }))
}

async fn patch_pet(Path(pet_id): Path<String>, Json(body): Json<Value>) -> Json<Value> {
    Json(json!({
        "id": pet_id,
        "name": body.get("name").cloned().unwrap_or_else(|| json!("Miso")),
        "status": body.get("status").cloned().unwrap_or_else(|| json!("available")),
        "age": body.get("age").cloned().unwrap_or_else(|| json!(3)),
        "tags": ["friendly"]
    }))
}

async fn search() -> Json<Value> {
    Json(json!({ "terms": ["small", "friendly"], "count": 1 }))
}

async fn openapi() -> Json<Value> {
    Json(openapi_spec())
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let docs = prauga_flexdoc_axum::router(prauga_flexdoc_axum::Config {
        path: "/docs".into(),
        spec_url: "/openapi.json".into(),
        title: "FlexDoc Rust showcase".into(),
        try_it_enabled: true,
        ..Default::default()
    });

    let app = Router::new()
        .route("/pets", get(list_pets).post(create_pet))
        .route("/pets/{pet_id}", get(get_pet).patch(patch_pet))
        .route("/search", get(search))
        .route("/sessions", post(|| async { Json(json!({ "token": "local-session" })) }))
        .route("/uploads", post(|| async { Json(json!({ "id": "upload-local", "url": "http://localhost:3000/uploads/upload-local" })) }))
        .route("/openapi.json", get(openapi))
        .merge(docs);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await?;
    println!("API:  http://localhost:3000/pets");
    println!("Docs: http://localhost:3000/docs");
    println!("Try the configured localhost server, the variable canary server, or enter any custom endpoint in Try It/API Client.");
    axum::serve(listener, app).await?;
    Ok(())
}
