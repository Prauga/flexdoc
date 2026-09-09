use actix_web::{
    http::{header as actix_header, StatusCode},
    test, App,
};
use axum::{
    body::{to_bytes, Body},
    extract::Request as AxumRequest,
    http::{header, Request},
    response::{IntoResponse, Redirect, Response},
    routing::{any, get},
    Json, Router,
};
use prauga_flexdoc_actix::{scope, Config, HostExecution};
use serde_json::{json, Value};
use std::{collections::BTreeMap, sync::Arc, time::Duration};

async fn echo(request: AxumRequest) -> Response {
    let (parts, body) = request.into_parts();
    let bytes = to_bytes(body, 40 * 1024 * 1024).await.unwrap();
    let mut headers = BTreeMap::new();
    for (name, value) in &parts.headers {
        headers.insert(
            name.as_str().to_string(),
            value.to_str().unwrap_or_default().to_string(),
        );
    }
    Json(json!({
        "method": parts.method.as_str(),
        "uri": parts.uri.to_string(),
        "headers": headers,
        "body": String::from_utf8_lossy(&bytes),
    }))
    .into_response()
}

async fn redirect_to_echo() -> impl IntoResponse {
    Redirect::temporary("/echo?redirected=1")
}
async fn cross_origin_redirect() -> Response {
    (
        axum::http::StatusCode::FOUND,
        [(header::LOCATION, "https://example.com/elsewhere")],
    )
        .into_response()
}
async fn slow() -> &'static str {
    tokio::time::sleep(Duration::from_millis(250)).await;
    "late"
}
async fn large() -> Vec<u8> {
    vec![b'x'; 10 * 1024 * 1024 + 1]
}

async fn spawn_target() -> (String, tokio::task::JoinHandle<()>) {
    let app = Router::new()
        .route("/echo", any(echo))
        .route("/redirect", any(redirect_to_echo))
        .route("/cross-origin", any(cross_origin_redirect))
        .route("/slow", get(slow))
        .route("/large", get(large));
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    let task = tokio::spawn(async move {
        axum::serve(listener, app).await.unwrap();
    });
    (format!("http://{address}"), task)
}

fn config(base: &str) -> Config {
    Config {
        try_it_host_execution: true,
        host_execution: Some(Arc::new(HostExecution::new([base]).unwrap())),
        ..Default::default()
    }
}

fn inner_response(result: &Value) -> Value {
    serde_json::from_str(result["body"].as_str().unwrap()).unwrap()
}

#[actix_rt::test]
async fn route_requires_marker_and_returns_no_store_json() {
    let (base, task) = spawn_target().await;
    let app = test::init_service(App::new().service(scope(config(&base)))).await;
    let request = test::TestRequest::post()
        .uri("/docs/__flexdoc/execute")
        .insert_header((actix_header::CONTENT_TYPE, "application/json"))
        .set_payload(json!({"request":{"url":format!("{base}/echo"),"method":"GET"}}).to_string())
        .to_request();
    let response = test::call_service(&app, request).await;
    assert_eq!(response.status(), StatusCode::FORBIDDEN);
    assert_eq!(
        response.headers().get(actix_header::CACHE_CONTROL).unwrap(),
        "no-store"
    );
    let body: Value = test::read_body_json(response).await;
    assert_eq!(body["error"], "Missing X-FlexDoc-Execute header.");
    task.abort();
}

#[actix_rt::test]
async fn preserves_encoded_query_and_strips_unsafe_headers() {
    let (base, task) = spawn_target().await;
    let app = test::init_service(App::new().service(scope(config(&base)))).await;
    let envelope = json!({
        "request": {
            "url": format!("{base}/echo?encoded=%2F"),
            "method": "POST",
            "query": [{"key":"added","value":"hello world"}],
            "headers": [
                {"key":"X-Flex-Test","value":"yes"},
                {"key":"Origin","value":"https://evil.example"},
                {"key":"Host","value":"evil.example"}
            ],
            "bodyMode": "raw",
            "body": "payload",
            "contentType": "text/plain"
        }
    });
    let request = test::TestRequest::post()
        .uri("/docs/__flexdoc/execute")
        .insert_header(("X-FlexDoc-Execute", "1"))
        .insert_header((actix_header::CONTENT_TYPE, "application/json"))
        .set_payload(envelope.to_string())
        .to_request();
    let response = test::call_service(&app, request).await;
    assert_eq!(response.status(), StatusCode::OK);
    let result: Value = test::read_body_json(response).await;
    let echoed = inner_response(&result);
    let uri = echoed["uri"].as_str().unwrap();
    assert!(uri.contains("encoded=%2F"));
    assert!(uri.contains("added=hello+world") || uri.contains("added=hello%20world"));
    assert_eq!(echoed["headers"]["x-flex-test"], "yes");
    assert!(echoed["headers"].get("origin").is_none());
    assert_ne!(
        echoed["headers"].get("host").and_then(Value::as_str),
        Some("evil.example")
    );
    assert_eq!(echoed["body"], "payload");
    task.abort();
}

#[actix_rt::test]
async fn reapplies_query_api_key_after_same_origin_redirect() {
    let (base, task) = spawn_target().await;
    let app = test::init_service(App::new().service(scope(config(&base)))).await;
    let envelope = json!({
        "request": {
            "url": format!("{base}/redirect"),
            "method": "GET",
            "auth": {"type":"apiKey","in":"query","key":"token","value":"secret"}
        }
    });
    let request = test::TestRequest::post()
        .uri("/docs/__flexdoc/execute")
        .insert_header(("X-FlexDoc-Execute", "1"))
        .insert_header((actix_header::CONTENT_TYPE, "application/json"))
        .set_payload(envelope.to_string())
        .to_request();
    let response = test::call_service(&app, request).await;
    assert_eq!(response.status(), StatusCode::OK);
    let result: Value = test::read_body_json(response).await;
    let uri = inner_response(&result)["uri"].as_str().unwrap().to_string();
    assert!(uri.contains("redirected=1"));
    assert!(uri.contains("token=secret"));
    task.abort();
}

#[actix_rt::test]
async fn rejects_cross_origin_redirects() {
    let (base, task) = spawn_target().await;
    let app = test::init_service(App::new().service(scope(config(&base)))).await;
    let envelope = json!({"request":{"url":format!("{base}/cross-origin"),"method":"GET"}});
    let request = test::TestRequest::post()
        .uri("/docs/__flexdoc/execute")
        .insert_header(("X-FlexDoc-Execute", "1"))
        .insert_header((actix_header::CONTENT_TYPE, "application/json"))
        .set_payload(envelope.to_string())
        .to_request();
    let response = test::call_service(&app, request).await;
    assert_eq!(response.status(), StatusCode::FORBIDDEN);
    let body: Value = test::read_body_json(response).await;
    assert!(body["error"]
        .as_str()
        .unwrap()
        .contains("cross-origin redirects"));
    task.abort();
}

#[actix_rt::test]
async fn forwards_canonical_multipart_file_envelope() {
    let (base, task) = spawn_target().await;
    let app = test::init_service(App::new().service(scope(config(&base)))).await;
    let descriptor = json!({
        "request": {
            "url": format!("{base}/echo"),
            "method": "POST",
            "bodyMode": "formdata",
            "formData": [
                {"key":"upload","type":"file","enabled":true,"fileName":"fallback.txt","contentType":"text/plain"},
                {"key":"note","value":"hello","enabled":true}
            ]
        }
    });
    let boundary = "----flexdoc-actix-test";
    let mut body = Vec::new();
    body.extend_from_slice(format!("--{boundary}\r\nContent-Disposition: form-data; name=\"descriptor\"\r\nContent-Type: application/json\r\n\r\n{}\r\n", descriptor).as_bytes());
    body.extend_from_slice(format!("--{boundary}\r\nContent-Disposition: form-data; name=\"formData[0]\"; filename=\"actual.txt\"\r\nContent-Type: text/plain\r\n\r\nfile-bytes\r\n--{boundary}--\r\n").as_bytes());
    let request = test::TestRequest::post()
        .uri("/docs/__flexdoc/execute")
        .insert_header(("X-FlexDoc-Execute", "1"))
        .insert_header((
            actix_header::CONTENT_TYPE,
            format!("multipart/form-data; boundary={boundary}"),
        ))
        .set_payload(body)
        .to_request();
    let response = test::call_service(&app, request).await;
    assert_eq!(response.status(), StatusCode::OK);
    let result: Value = test::read_body_json(response).await;
    let echoed = inner_response(&result);
    let forwarded = echoed["body"].as_str().unwrap();
    assert!(forwarded.contains("name=\"upload\""));
    assert!(forwarded.contains("filename=\"actual.txt\""));
    assert!(forwarded.contains("file-bytes"));
    assert!(forwarded.contains("name=\"note\""));
    assert!(forwarded.contains("hello"));
    task.abort();
}

#[actix_rt::test]
async fn blocks_metadata_targets_before_connection() {
    let executor = Arc::new(HostExecution::new(["http://169.254.169.254"]).unwrap());
    let app = test::init_service(App::new().service(scope(Config {
        try_it_host_execution: true,
        host_execution: Some(executor),
        ..Default::default()
    })))
    .await;
    let request = test::TestRequest::post()
        .uri("/docs/__flexdoc/execute")
        .insert_header(("X-FlexDoc-Execute", "1"))
        .insert_header((actix_header::CONTENT_TYPE, "application/json"))
        .set_payload(
            json!({"request":{"url":"http://169.254.169.254/latest/meta-data","method":"GET"}})
                .to_string(),
        )
        .to_request();
    let response = test::call_service(&app, request).await;
    assert_eq!(response.status(), StatusCode::FORBIDDEN);
    let body: Value = test::read_body_json(response).await;
    assert!(body["error"].as_str().unwrap().contains("metadata"));
}

#[actix_rt::test]
async fn enforces_full_response_deadline() {
    let (base, task) = spawn_target().await;
    let app = test::init_service(App::new().service(scope(config(&base)))).await;
    let request = test::TestRequest::post()
        .uri("/docs/__flexdoc/execute")
        .insert_header(("X-FlexDoc-Execute", "1"))
        .insert_header((actix_header::CONTENT_TYPE, "application/json"))
        .set_payload(
            json!({"timeoutMs":100,"request":{"url":format!("{base}/slow"),"method":"GET"}})
                .to_string(),
        )
        .to_request();
    let response = test::call_service(&app, request).await;
    assert_eq!(response.status(), StatusCode::BAD_GATEWAY);
    let body: Value = test::read_body_json(response).await;
    assert!(body["error"].as_str().unwrap().contains("timed out"));
    task.abort();
}

#[actix_rt::test]
async fn rejects_responses_larger_than_ten_mib() {
    let (base, task) = spawn_target().await;
    let app = test::init_service(App::new().service(scope(config(&base)))).await;
    let request = test::TestRequest::post()
        .uri("/docs/__flexdoc/execute")
        .insert_header(("X-FlexDoc-Execute", "1"))
        .insert_header((actix_header::CONTENT_TYPE, "application/json"))
        .set_payload(json!({"request":{"url":format!("{base}/large"),"method":"GET"}}).to_string())
        .to_request();
    let response = test::call_service(&app, request).await;
    assert_eq!(response.status(), StatusCode::BAD_GATEWAY);
    let body: Value = test::read_body_json(response).await;
    assert!(body["error"].as_str().unwrap().contains("10 MiB"));
    task.abort();
}
