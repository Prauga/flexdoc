use actix_web::{web, App, HttpResponse, HttpServer};
use prauga_flexdoc_actix::{scope, Config};

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    HttpServer::new(|| {
        App::new()
            .route("/openapi.json", web::get().to(|| async {
                HttpResponse::Ok().json(serde_json::json!({"openapi":"3.1.0","info":{"title":"Actix FlexDoc Example","version":"1.0.0"},"paths":{}}))
            }))
            .service(scope(Config { title: "Actix FlexDoc Example".into(), ..Default::default() }))
    })
    .bind(("127.0.0.1", 8080))?
    .run()
    .await
}
