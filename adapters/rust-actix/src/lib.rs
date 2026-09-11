//! Actix Web scope integration for the Prauga FlexDoc OpenAPI renderer.
//!
//! The crate embeds the canonical browser renderer and exposes [`scope`] for
//! mounting documentation alongside your Actix application.

mod host_execution;

pub use host_execution::{HostExecution, HostExecutionFile, HostExecutionResult};

use actix_web::{
    http::{header, StatusCode},
    web, HttpRequest, HttpResponse, Scope,
};
use futures_util::{stream, StreamExt};
use serde_json::{json, Value};
use std::{collections::HashMap, convert::Infallible, sync::Arc};

use host_execution::MAX_EXECUTION_REQUEST_BYTES;

static RENDERER_JS: &[u8] = include_bytes!("../assets/flexdoc.standalone.js");
static RENDERER_CSS: &[u8] = include_bytes!("../assets/flexdoc.standalone.css");

/// FlexDoc renderer configuration for Actix Web.
#[derive(Clone, Debug)]
pub struct Config {
    /// Docs mount path.
    pub path: String,
    /// OpenAPI document URL resolved by the browser bootstrap page.
    pub spec_url: String,
    /// Page and renderer title.
    pub title: String,
    /// Renderer theme preset: `system`, `light`, or `dark`.
    pub theme: String,
    /// Whether the Try It client is enabled.
    pub try_it_enabled: bool,
    /// Optional expansion preset or section list forwarded to the renderer.
    pub expand: Option<Value>,
    /// Optional default server URL for Try It requests.
    pub try_it_default_server: Option<String>,
    /// Optional fetch credentials mode for Try It requests.
    pub try_it_credentials: Option<String>,
    /// Optional persistence key, or JSON `false` to disable.
    pub try_it_api_client_persistence_key: Option<Value>,
    /// Request native host-execution metadata and route ownership.
    pub try_it_host_execution: bool,
    /// Real native executor. `None` keeps host execution unavailable and the route unregistered.
    pub host_execution: Option<Arc<HostExecution>>,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            path: "/docs".into(),
            spec_url: "/openapi.json".into(),
            title: "API Reference".into(),
            theme: "system".into(),
            try_it_enabled: true,
            expand: None,
            try_it_default_server: None,
            try_it_credentials: None,
            try_it_api_client_persistence_key: None,
            try_it_host_execution: false,
            host_execution: None,
        }
    }
}

/// Build an Actix Web scope that serves the docs shell, renderer assets, and optionally native execution.
pub fn scope(mut cfg: Config) -> Scope {
    cfg.path = format!("/{}", cfg.path.trim_matches('/'));
    if cfg.path == "/" {
        cfg.path = "/docs".into();
    }
    let base = cfg.path.clone();
    let owns_execution = cfg.try_it_host_execution && cfg.host_execution.is_some();
    let mut scope = web::scope(&base)
        .app_data(web::Data::new(cfg))
        .route("", web::get().to(page))
        .route("/", web::get().to(page))
        .route("/__flexdoc/renderer.js", web::get().to(js))
        .route("/__flexdoc/renderer.css", web::get().to(css));
    if owns_execution {
        scope = scope.route("/__flexdoc/execute", web::post().to(execute));
    }
    scope
}

async fn page(cfg: web::Data<Config>) -> HttpResponse {
    HttpResponse::Ok()
        .insert_header((header::CONTENT_TYPE, "text/html; charset=utf-8"))
        .insert_header((header::CACHE_CONTROL, "no-cache"))
        .body(render_html(&cfg))
}

async fn js() -> HttpResponse {
    asset(RENDERER_JS, "application/javascript; charset=utf-8")
}
async fn css() -> HttpResponse {
    asset(RENDERER_CSS, "text/css; charset=utf-8")
}

async fn execute(
    cfg: web::Data<Config>,
    request: HttpRequest,
    mut payload: web::Payload,
) -> HttpResponse {
    let Some(executor) = cfg.host_execution.as_ref() else {
        return HttpResponse::NotFound().finish();
    };
    let marker = request
        .headers()
        .get("x-flexdoc-execute")
        .and_then(|value| value.to_str().ok())
        .map(str::to_owned);
    if marker.as_deref() != Some("1") {
        return execution_response(
            executor
                .handle(marker.as_deref(), Value::Null, HashMap::new())
                .await,
        );
    }

    let mut bytes = Vec::new();
    while let Some(chunk) = payload.next().await {
        let chunk = match chunk {
            Ok(chunk) => chunk,
            Err(_) => {
                return execution_error(
                    StatusCode::BAD_REQUEST,
                    "Unable to read host execution request body.",
                )
            }
        };
        if bytes.len().saturating_add(chunk.len()) > MAX_EXECUTION_REQUEST_BYTES {
            return execution_error(
                StatusCode::BAD_REQUEST,
                "Host execution request exceeded the 32 MiB safety limit.",
            );
        }
        bytes.extend_from_slice(&chunk);
    }

    let content_type = request
        .headers()
        .get(header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("")
        .to_owned();
    let (envelope, files) = if content_type
        .split(';')
        .next()
        .is_some_and(|value| value.trim().eq_ignore_ascii_case("application/json"))
    {
        let envelope: Value = match serde_json::from_slice(&bytes) {
            Ok(value @ Value::Object(_)) => value,
            _ => {
                return execution_error(
                    StatusCode::BAD_REQUEST,
                    "Host execution body must be valid UTF-8 JSON object.",
                )
            }
        };
        (envelope, HashMap::new())
    } else if content_type
        .split(';')
        .next()
        .is_some_and(|value| value.trim().eq_ignore_ascii_case("multipart/form-data"))
    {
        match parse_multipart_envelope(&content_type, bytes).await {
            Ok(value) => value,
            Err(message) => return execution_error(StatusCode::BAD_REQUEST, &message),
        }
    } else {
        return execution_error(
            StatusCode::BAD_REQUEST,
            "Host execution requires application/json or multipart/form-data.",
        );
    };

    execution_response(executor.handle(marker.as_deref(), envelope, files).await)
}

async fn parse_multipart_envelope(
    content_type: &str,
    bytes: Vec<u8>,
) -> Result<(Value, HashMap<usize, HostExecutionFile>), String> {
    let boundary = multer::parse_boundary(content_type)
        .map_err(|_| "Host execution multipart body is invalid.".to_string())?;
    let stream = stream::once(async move { Ok::<_, Infallible>(web::Bytes::from(bytes)) });
    let mut multipart = multer::Multipart::new(stream, boundary);
    let mut descriptor: Option<Vec<u8>> = None;
    let mut files = HashMap::new();
    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|_| "Host execution multipart body is invalid.".to_string())?
    {
        let name = field.name().unwrap_or_default().to_owned();
        let filename = field.file_name().unwrap_or_default().to_owned();
        let content_type = field
            .content_type()
            .map(ToString::to_string)
            .unwrap_or_default();
        let data = field
            .bytes()
            .await
            .map_err(|_| "Unable to read multipart host execution upload.".to_string())?
            .to_vec();
        if name == "descriptor" {
            if descriptor.is_some() {
                return Err(
                    "Host execution multipart request contains multiple descriptors.".into(),
                );
            }
            descriptor = Some(data);
            continue;
        }
        let Some(index_text) = name
            .strip_prefix("formData[")
            .and_then(|value| value.strip_suffix(']'))
        else {
            continue;
        };
        let Ok(index) = index_text.parse::<usize>() else {
            continue;
        };
        if files.contains_key(&index) {
            return Err(format!(
                "Host execution multipart request contains duplicate formData[{index}] parts."
            ));
        }
        files.insert(
            index,
            HostExecutionFile {
                filename,
                content_type,
                data,
            },
        );
    }
    let descriptor = descriptor
        .ok_or_else(|| "Host execution multipart request requires a descriptor.".to_string())?;
    let envelope: Value = serde_json::from_slice(&descriptor).map_err(|_| {
        "Host execution multipart descriptor must be valid UTF-8 JSON object.".to_string()
    })?;
    if !envelope.is_object() {
        return Err("Host execution multipart descriptor must be valid UTF-8 JSON object.".into());
    }
    Ok((envelope, files))
}

fn execution_response(result: HostExecutionResult) -> HttpResponse {
    let status = StatusCode::from_u16(result.status).unwrap_or(StatusCode::BAD_GATEWAY);
    HttpResponse::build(status)
        .insert_header((header::CACHE_CONTROL, "no-store"))
        .json(result.body)
}

fn execution_error(status: StatusCode, message: &str) -> HttpResponse {
    HttpResponse::build(status)
        .insert_header((header::CACHE_CONTROL, "no-store"))
        .json(json!({"error":message}))
}

fn asset(body: &'static [u8], content_type: &'static str) -> HttpResponse {
    HttpResponse::Ok()
        .insert_header((header::CONTENT_TYPE, content_type))
        .insert_header((header::CACHE_CONTROL, "public, max-age=31536000, immutable"))
        .body(body)
}

fn renderer_version() -> String {
    let mut hash = 0xcbf29ce484222325_u64;
    for byte in RENDERER_JS
        .iter()
        .chain([0_u8].iter())
        .chain(RENDERER_CSS.iter())
    {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    format!("{hash:016x}")
}

fn safe_json(value: serde_json::Value) -> String {
    value
        .to_string()
        .replace('<', "\\u003c")
        .replace('>', "\\u003e")
        .replace('&', "\\u0026")
        .replace('\u{2028}', "\\u2028")
        .replace('\u{2029}', "\\u2029")
}

fn escape_html(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}

fn renderer_options(cfg: &Config) -> Value {
    let mut options = json!({
        "contractVersion": "1",
        "title": cfg.title,
        "theme": cfg.theme,
        "tryIt": {"enabled": cfg.try_it_enabled}
    });

    if let Some(expand) = &cfg.expand {
        options["expand"] = expand.clone();
    }

    let try_it = options["tryIt"]
        .as_object_mut()
        .expect("Try It options are an object");
    if let Some(default_server) = &cfg.try_it_default_server {
        try_it.insert("defaultServer".into(), json!(default_server));
    }
    if let Some(credentials) = &cfg.try_it_credentials {
        try_it.insert("credentials".into(), json!(credentials));
    }
    if let Some(persistence_key) = &cfg.try_it_api_client_persistence_key {
        try_it.insert("apiClientPersistenceKey".into(), persistence_key.clone());
    }
    if cfg.try_it_host_execution {
        let available = cfg.host_execution.is_some();
        let capabilities = cfg
            .host_execution
            .as_ref()
            .map(|executor| executor.capabilities())
            .unwrap_or(&[]);
        try_it.insert(
            "hostExecution".into(),
            json!({
                "available": available,
                "endpoint": format!("{}/__flexdoc/execute", cfg.path),
                "capabilities": capabilities
            }),
        );
    }

    options
}

fn render_html(cfg: &Config) -> String {
    let options = renderer_options(cfg);
    let version = renderer_version();
    format!(
        r#"<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>{}</title><link rel="stylesheet" href="{}/__flexdoc/renderer.css?v={}"></head><body><div id="flexdoc-root"></div><script>window.__FLEXDOC_SPEC_URL__={};window.__FLEXDOC_OPTIONS__={};</script><script src="{}/__flexdoc/renderer.js?v={}"></script><script>(async function(){{const root=document.getElementById('flexdoc-root');try{{const baseUri=new URL(window.__FLEXDOC_SPEC_URL__,window.location.href).toString();const response=await fetch(baseUri);if(!response.ok)throw new Error('Unable to load OpenAPI specification: HTTP '+response.status);const spec=await response.json();const config={{spec:spec,options:window.__FLEXDOC_OPTIONS__||{{}},baseUri:baseUri}};if(window.FlexDocStandalone.mountAsync)await window.FlexDocStandalone.mountAsync(root,config);else window.FlexDocStandalone.mount(root,config);}}catch(error){{root.textContent=error instanceof Error?error.message:String(error);}}}})();</script></body></html>"#,
        escape_html(&cfg.title),
        cfg.path,
        version,
        safe_json(json!(cfg.spec_url)),
        safe_json(options),
        cfg.path,
        version
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use actix_web::{test, App};

    #[actix_rt::test]
    async fn renderer_settings_are_omitted_until_configured() {
        let default_options = renderer_options(&Config::default());
        assert_eq!(default_options["tryIt"]["enabled"], true);
        assert!(default_options.get("expand").is_none());
        assert!(default_options["tryIt"].get("defaultServer").is_none());

        let configured = Config {
            expand: Some(json!("documentation")),
            try_it_default_server: Some("https://api.example.test".into()),
            try_it_credentials: Some("include".into()),
            try_it_api_client_persistence_key: Some(json!(false)),
            try_it_host_execution: true,
            ..Default::default()
        };
        let options = renderer_options(&configured);
        assert_eq!(options["expand"], "documentation");
        assert_eq!(options["tryIt"]["enabled"], true);
        assert_eq!(
            options["tryIt"]["defaultServer"],
            "https://api.example.test"
        );
        assert_eq!(options["tryIt"]["credentials"], "include");
        assert_eq!(options["tryIt"]["apiClientPersistenceKey"], false);
        assert_eq!(options["tryIt"]["hostExecution"]["available"], false);
        assert_eq!(
            options["tryIt"]["hostExecution"]["endpoint"],
            "/docs/__flexdoc/execute"
        );
        assert_eq!(options["tryIt"]["hostExecution"]["capabilities"], json!([]));

        let executor = Arc::new(HostExecution::new(["https://api.example.test"]).unwrap());
        let native = renderer_options(&Config {
            try_it_host_execution: true,
            host_execution: Some(executor),
            ..Default::default()
        });
        assert_eq!(native["tryIt"]["hostExecution"]["available"], true);
        assert_eq!(native["tryIt"]["hostExecution"]["capabilities"], json!([]));
    }

    #[actix_rt::test]
    async fn disabled_executor_does_not_register_fake_route() {
        let app = test::init_service(App::new().service(scope(Config {
            try_it_host_execution: true,
            ..Default::default()
        })))
        .await;
        let response = test::call_service(
            &app,
            test::TestRequest::post()
                .uri("/docs/__flexdoc/execute")
                .to_request(),
        )
        .await;
        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }

    #[actix_rt::test]
    async fn serves_docs_and_canonical_assets() {
        let app = test::init_service(App::new().service(scope(Config {
            path: "/reference".into(),
            spec_url: "</script><script>alert(2)</script>".into(),
            title: "Actix </script><script>alert(1)</script>".into(),
            ..Default::default()
        })))
        .await;

        let docs = test::call_service(
            &app,
            test::TestRequest::get().uri("/reference").to_request(),
        )
        .await;
        assert!(docs.status().is_success());
        let docs_body = test::read_body(docs).await;
        let docs_text = String::from_utf8(docs_body.to_vec()).unwrap();
        assert!(!docs_text.contains("</script><script>alert(1)</script>"));
        assert!(!docs_text.contains("</script><script>alert(2)</script>"));
        assert!(docs_text.contains("\\u003c/script\\u003e"));
        assert!(docs_text.contains("/reference/__flexdoc/renderer.js?v="));

        let js = test::call_service(
            &app,
            test::TestRequest::get()
                .uri("/reference/__flexdoc/renderer.js")
                .to_request(),
        )
        .await;
        assert!(js.status().is_success());
        assert_eq!(
            js.headers().get(header::CACHE_CONTROL).unwrap(),
            "public, max-age=31536000, immutable"
        );
        assert_eq!(test::read_body(js).await.as_ref(), RENDERER_JS);
    }
}
