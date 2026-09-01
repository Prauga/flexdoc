use axum::{extract::State, http::{header, HeaderValue, StatusCode}, response::{Html, IntoResponse, Response}, routing::get, Json, Router};
use serde::Serialize;
use serde_json::{json, Value};
use std::sync::Arc;

static RENDERER_JS: &[u8] = include_bytes!("../assets/flexdoc.standalone.js");
static RENDERER_CSS: &[u8] = include_bytes!("../assets/flexdoc.standalone.css");

#[derive(Clone, Debug)]
pub struct Config {
    pub path: String,
    pub spec_url: String,
    pub title: String,
    pub theme: String,
    pub try_it_enabled: bool,
}

impl Default for Config {
    fn default() -> Self { Self { path:"/docs".into(), spec_url:"/openapi.json".into(), title:"API Reference".into(), theme:"system".into(), try_it_enabled:true } }
}

#[derive(Clone)]
struct AppState { cfg: Arc<Config>, spec: Option<Arc<Value>> }

pub fn router(cfg: Config) -> Router { build_router(cfg, None) }

/// Build FlexDoc routes from a generated OpenAPI value, including `utoipa::OpenApi` values.
/// The generated document is exposed only under the FlexDoc route and requires no separate
/// application-owned `/openapi.json` endpoint.
pub fn router_with_openapi<T: Serialize>(mut cfg: Config, spec: &T) -> Result<Router, serde_json::Error> {
    let value = serde_json::to_value(spec)?;
    cfg.path = format!("/{}", cfg.path.trim_matches('/'));
    cfg.spec_url = format!("{}/__flexdoc/openapi.json", cfg.path);
    Ok(build_router(cfg, Some(value)))
}

fn build_router(mut cfg: Config, spec: Option<Value>) -> Router {
    cfg.path = format!("/{}", cfg.path.trim_matches('/'));
    let base = cfg.path.clone();
    if spec.is_some() { cfg.spec_url = format!("{}/__flexdoc/openapi.json", base); }
    let state = AppState { cfg: Arc::new(cfg), spec: spec.map(Arc::new) };
    Router::new()
        .route(&base, get(page))
        .route(&(base.clone() + "/"), get(page))
        .route(&(base.clone() + "/__flexdoc/renderer.js"), get(js))
        .route(&(base.clone() + "/__flexdoc/renderer.css"), get(css))
        .route(&(base + "/__flexdoc/openapi.json"), get(openapi))
        .with_state(state)
}

async fn page(State(state): State<AppState>) -> Response {
    let mut response = Html(render_html(&state.cfg)).into_response();
    response.headers_mut().insert(header::CACHE_CONTROL, HeaderValue::from_static("no-cache"));
    response
}
async fn js() -> Response { asset(RENDERER_JS, "application/javascript; charset=utf-8") }
async fn css() -> Response { asset(RENDERER_CSS, "text/css; charset=utf-8") }
async fn openapi(State(state): State<AppState>) -> Response {
    match state.spec.as_deref() {
        Some(spec) => Json(spec.clone()).into_response(),
        None => StatusCode::NOT_FOUND.into_response(),
    }
}

fn asset(body: &'static [u8], content_type: &'static str) -> Response {
    let mut response = body.into_response();
    response.headers_mut().insert(header::CONTENT_TYPE, HeaderValue::from_static(content_type));
    response.headers_mut().insert(header::CACHE_CONTROL, HeaderValue::from_static("public, max-age=31536000, immutable"));
    response
}

fn safe_json(value: serde_json::Value) -> String {
    value.to_string().replace('<', "\\u003c").replace('>', "\\u003e").replace('&', "\\u0026").replace('\u{2028}', "\\u2028").replace('\u{2029}', "\\u2029")
}

fn escape_html(value: &str) -> String {
    value.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;").replace('"', "&quot;").replace('\'', "&#39;")
}

fn renderer_version() -> String {
    let mut hash = 0xcbf29ce484222325_u64;
    for byte in RENDERER_JS.iter().chain([0_u8].iter()).chain(RENDERER_CSS.iter()) {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    format!("{hash:016x}")
}

fn render_html(cfg: &Config) -> String {
    let options = json!({"contractVersion":"1","title":cfg.title,"theme":cfg.theme,"tryIt":{"enabled":cfg.try_it_enabled}});
    let version = renderer_version();
    format!(r#"<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>{}</title><link rel="stylesheet" href="{}/__flexdoc/renderer.css?v={}"></head><body><div id="flexdoc-root"></div><script>window.__FLEXDOC_SPEC_URL__={};window.__FLEXDOC_OPTIONS__={};</script><script src="{}/__flexdoc/renderer.js?v={}"></script><script>(async function(){{const root=document.getElementById('flexdoc-root');try{{const baseUri=new URL(window.__FLEXDOC_SPEC_URL__,window.location.href).toString();const response=await fetch(baseUri);if(!response.ok)throw new Error('Unable to load OpenAPI specification: HTTP '+response.status);const spec=await response.json();const config={{spec:spec,options:window.__FLEXDOC_OPTIONS__||{{}},baseUri:baseUri}};if(window.FlexDocStandalone.mountAsync)await window.FlexDocStandalone.mountAsync(root,config);else window.FlexDocStandalone.mount(root,config);}}catch(error){{root.textContent=error instanceof Error?error.message:String(error);}}}})();</script></body></html>"#, escape_html(&cfg.title), cfg.path, version, safe_json(json!(cfg.spec_url)), safe_json(options), cfg.path, version)
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{body::{to_bytes, Body}, http::Request};
    use tower::ServiceExt;

    #[test]
    fn html_is_script_safe_and_assets_are_embedded() {
        let cfg = Config { title:"</script><script>alert(1)</script>".into(), path:"/docs".into(), ..Default::default() };
        let body = render_html(&cfg);
        assert!(!body.contains("</script><script>alert(1)</script>"));
        assert!(body.contains("/docs/__flexdoc/renderer.js?v="));
        assert!(body.contains("/docs/__flexdoc/renderer.css?v="));
        assert!(!RENDERER_JS.is_empty());
        assert!(!RENDERER_CSS.is_empty());
    }

    #[tokio::test]
    async fn generated_openapi_serves_docs_and_internal_spec_route() {
        let spec = json!({"openapi":"3.1.0","info":{"title":"Test","version":"1"},"paths":{}});
        let app = router_with_openapi(Config { path: "/reference".into(), ..Default::default() }, &spec).expect("serializes OpenAPI");

        let page = app.clone().oneshot(Request::builder().uri("/reference").body(Body::empty()).unwrap()).await.unwrap();
        assert_eq!(page.status(), StatusCode::OK);
        let page_body = to_bytes(page.into_body(), usize::MAX).await.unwrap();
        let page_text = String::from_utf8(page_body.to_vec()).unwrap();
        assert!(page_text.contains("/reference/__flexdoc/openapi.json"));

        let response = app.oneshot(Request::builder().uri("/reference/__flexdoc/openapi.json").body(Body::empty()).unwrap()).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(response.headers().get(header::CONTENT_TYPE).and_then(|value| value.to_str().ok()), Some("application/json"));
        let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
        let decoded: Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(decoded["openapi"], "3.1.0");
    }
}
