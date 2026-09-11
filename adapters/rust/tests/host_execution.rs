use axum::{
    body::{to_bytes, Body},
    extract::Request as AxumRequest,
    http::{header, Request, StatusCode},
    response::{IntoResponse, Redirect, Response},
    routing::{any, get},
    Json, Router,
};
use prauga_flexdoc_axum::{router, Config, HostExecution};
use serde_json::{json, Value};
use std::{collections::BTreeMap, sync::Arc, time::Duration};
use tower::ServiceExt;

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
        StatusCode::FOUND,
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

fn docs(base: &str) -> Router {
    let executor = Arc::new(HostExecution::new([base]).unwrap());
    router(Config {
        try_it_host_execution: true,
        host_execution: Some(executor),
        ..Default::default()
    })
}

async fn send_json(app: Router, envelope: Value, marker: bool) -> (StatusCode, Value, String) {
    let mut builder = Request::builder()
        .method("POST")
        .uri("/docs/__flexdoc/execute")
        .header(header::CONTENT_TYPE, "application/json");
    if marker {
        builder = builder.header("X-FlexDoc-Execute", "1");
    }
    let response = app
        .oneshot(builder.body(Body::from(envelope.to_string())).unwrap())
        .await
        .unwrap();
    let status = response.status();
    let cache = response
        .headers()
        .get(header::CACHE_CONTROL)
        .and_then(|value| value.to_str().ok())
        .unwrap_or_default()
        .to_string();
    let bytes = to_bytes(response.into_body(), 40 * 1024 * 1024)
        .await
        .unwrap();
    let body = serde_json::from_slice(&bytes).unwrap();
    (status, body, cache)
}

fn inner_response(result: &Value) -> Value {
    serde_json::from_str(result["body"].as_str().unwrap()).unwrap()
}

#[tokio::test]
async fn route_requires_marker_and_returns_no_store_json() {
    let (base, task) = spawn_target().await;
    let envelope = json!({"request":{"url":format!("{base}/echo"),"method":"GET"}});
    let (status, body, cache) = send_json(docs(&base), envelope, false).await;
    assert_eq!(status, StatusCode::FORBIDDEN);
    assert_eq!(body["error"], "Missing X-FlexDoc-Execute header.");
    assert_eq!(cache, "no-store");
    task.abort();
}

#[tokio::test]
async fn preserves_encoded_query_and_strips_unsafe_headers() {
    let (base, task) = spawn_target().await;
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
    let (status, result, _) = send_json(docs(&base), envelope, true).await;
    assert_eq!(status, StatusCode::OK, "{result}");
    let echoed = inner_response(&result);
    assert!(echoed["uri"].as_str().unwrap().contains("encoded=%2F"));
    assert!(
        echoed["uri"]
            .as_str()
            .unwrap()
            .contains("added=hello+world")
            || echoed["uri"]
                .as_str()
                .unwrap()
                .contains("added=hello%20world")
    );
    assert_eq!(echoed["headers"]["x-flex-test"], "yes");
    assert!(echoed["headers"].get("origin").is_none());
    assert_ne!(
        echoed["headers"].get("host").and_then(Value::as_str),
        Some("evil.example")
    );
    assert_eq!(echoed["body"], "payload");
    task.abort();
}

#[tokio::test]
async fn reapplies_query_api_key_after_same_origin_redirect() {
    let (base, task) = spawn_target().await;
    let envelope = json!({
        "request": {
            "url": format!("{base}/redirect"),
            "method": "GET",
            "auth": {"type":"apiKey","in":"query","key":"token","value":"secret"}
        }
    });
    let (status, result, _) = send_json(docs(&base), envelope, true).await;
    assert_eq!(status, StatusCode::OK, "{result}");
    let echoed = inner_response(&result);
    let uri = echoed["uri"].as_str().unwrap();
    assert!(uri.contains("redirected=1"));
    assert!(uri.contains("token=secret"));
    task.abort();
}

#[tokio::test]
async fn rejects_cross_origin_redirects() {
    let (base, task) = spawn_target().await;
    let envelope = json!({"request":{"url":format!("{base}/cross-origin"),"method":"GET"}});
    let (status, body, _) = send_json(docs(&base), envelope, true).await;
    assert_eq!(status, StatusCode::FORBIDDEN);
    assert!(body["error"]
        .as_str()
        .unwrap()
        .contains("cross-origin redirects"));
    task.abort();
}

#[tokio::test]
async fn forwards_canonical_multipart_file_envelope() {
    let (base, task) = spawn_target().await;
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
    let boundary = "----flexdoc-test-boundary";
    let mut body = Vec::new();
    body.extend_from_slice(format!("--{boundary}\r\nContent-Disposition: form-data; name=\"descriptor\"\r\nContent-Type: application/json\r\n\r\n{}\r\n", descriptor).as_bytes());
    body.extend_from_slice(format!("--{boundary}\r\nContent-Disposition: form-data; name=\"formData[0]\"; filename=\"actual.txt\"\r\nContent-Type: text/plain\r\n\r\nfile-bytes\r\n--{boundary}--\r\n").as_bytes());
    let response = docs(&base)
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/docs/__flexdoc/execute")
                .header("X-FlexDoc-Execute", "1")
                .header(
                    header::CONTENT_TYPE,
                    format!("multipart/form-data; boundary={boundary}"),
                )
                .body(Body::from(body))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let bytes = to_bytes(response.into_body(), 40 * 1024 * 1024)
        .await
        .unwrap();
    let result: Value = serde_json::from_slice(&bytes).unwrap();
    let echoed = inner_response(&result);
    let forwarded = echoed["body"].as_str().unwrap();
    assert!(forwarded.contains("name=\"upload\""));
    assert!(forwarded.contains("filename=\"actual.txt\""));
    assert!(forwarded.contains("file-bytes"));
    assert!(forwarded.contains("name=\"note\""));
    assert!(forwarded.contains("hello"));
    task.abort();
}

#[tokio::test]
async fn blocks_metadata_targets_before_connection() {
    let executor = Arc::new(HostExecution::new(["http://169.254.169.254"]).unwrap());
    let app = router(Config {
        try_it_host_execution: true,
        host_execution: Some(executor),
        ..Default::default()
    });
    let envelope =
        json!({"request":{"url":"http://169.254.169.254/latest/meta-data","method":"GET"}});
    let (status, body, _) = send_json(app, envelope, true).await;
    assert_eq!(status, StatusCode::FORBIDDEN);
    assert!(body["error"].as_str().unwrap().contains("metadata"));
}

#[tokio::test]
async fn enforces_full_response_deadline() {
    let (base, task) = spawn_target().await;
    let envelope = json!({"timeoutMs":100,"request":{"url":format!("{base}/slow"),"method":"GET"}});
    let (status, body, _) = send_json(docs(&base), envelope, true).await;
    assert_eq!(status, StatusCode::BAD_GATEWAY);
    assert!(body["error"].as_str().unwrap().contains("timed out"));
    task.abort();
}

#[tokio::test]
async fn rejects_responses_larger_than_ten_mib() {
    let (base, task) = spawn_target().await;
    let envelope = json!({"request":{"url":format!("{base}/large"),"method":"GET"}});
    let (status, body, _) = send_json(docs(&base), envelope, true).await;
    assert_eq!(status, StatusCode::BAD_GATEWAY);
    assert!(body["error"].as_str().unwrap().contains("10 MiB"));
    task.abort();
}
