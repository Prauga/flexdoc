use axum::{extract::State, http::{header, HeaderValue, StatusCode}, response::{Html, IntoResponse, Response}, routing::get, Router};
use serde_json::json;
use std::{path::PathBuf, sync::Arc};

#[derive(Clone, Debug)]
pub struct Config {
    pub path: String,
    pub spec_url: String,
    pub title: String,
    pub theme: String,
    pub try_it_enabled: bool,
    pub assets_dir: PathBuf,
}

impl Default for Config {
    fn default() -> Self { Self { path:"/docs".into(), spec_url:"/openapi.json".into(), title:"API Reference".into(), theme:"system".into(), try_it_enabled:true, assets_dir:".".into() } }
}

#[derive(Clone)]
struct AppState { cfg: Arc<Config> }

pub fn router(mut cfg: Config) -> Router {
    cfg.path = format!("/{}", cfg.path.trim_matches('/'));
    let base = cfg.path.clone();
    let state = AppState { cfg: Arc::new(cfg) };
    Router::new()
        .route(&base, get(page))
        .route(&(base.clone() + "/"), get(page))
        .route(&(base.clone() + "/__flexdoc/renderer.js"), get(js))
        .route(&(base + "/__flexdoc/renderer.css"), get(css))
        .with_state(state)
}

async fn page(State(state): State<AppState>) -> Html<String> { Html(render_html(&state.cfg)) }
async fn js(State(state): State<AppState>) -> Response { asset(&state.cfg, "flexdoc.standalone.js", "application/javascript; charset=utf-8").await }
async fn css(State(state): State<AppState>) -> Response { asset(&state.cfg, "flexdoc.standalone.css", "text/css; charset=utf-8").await }

async fn asset(cfg: &Config, name: &str, content_type: &'static str) -> Response {
    match tokio::fs::read(cfg.assets_dir.join(name)).await {
        Ok(body) => {
            let mut response = body.into_response();
            response.headers_mut().insert(header::CONTENT_TYPE, HeaderValue::from_static(content_type));
            response.headers_mut().insert(header::CACHE_CONTROL, HeaderValue::from_static("public, max-age=31536000, immutable"));
            response
        }
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "FlexDoc renderer asset is unavailable").into_response(),
    }
}

fn safe_json(value: serde_json::Value) -> String {
    value.to_string().replace('<', "\\u003c").replace('>', "\\u003e").replace('&', "\\u0026").replace('\u{2028}', "\\u2028").replace('\u{2029}', "\\u2029")
}

fn escape_html(value: &str) -> String {
    value.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;").replace('"', "&quot;").replace('\'', "&#39;")
}

fn render_html(cfg: &Config) -> String {
    let options = json!({"contractVersion":"1","title":cfg.title,"theme":cfg.theme,"tryIt":{"enabled":cfg.try_it_enabled}});
    format!(r#"<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>{}</title><link rel="stylesheet" href="{}/__flexdoc/renderer.css"></head><body><div id="flexdoc-root"></div><script>window.__FLEXDOC_SPEC_URL__={};window.__FLEXDOC_OPTIONS__={};</script><script src="{}/__flexdoc/renderer.js"></script><script>(async function(){{const root=document.getElementById('flexdoc-root');try{{const baseUri=new URL(window.__FLEXDOC_SPEC_URL__,window.location.href).toString();const response=await fetch(baseUri);if(!response.ok)throw new Error('Unable to load OpenAPI specification: HTTP '+response.status);const spec=await response.json();const config={{spec:spec,options:window.__FLEXDOC_OPTIONS__||{{}},baseUri:baseUri}};if(window.FlexDocStandalone.mountAsync)await window.FlexDocStandalone.mountAsync(root,config);else window.FlexDocStandalone.mount(root,config);}}catch(error){{root.textContent=error instanceof Error?error.message:String(error);}}}})();</script></body></html>"#, escape_html(&cfg.title), cfg.path, safe_json(json!(cfg.spec_url)), safe_json(options), cfg.path)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn html_is_script_safe() {
        let cfg = Config { title:"</script><script>alert(1)</script>".into(), path:"/docs".into(), ..Default::default() };
        let body = render_html(&cfg);
        assert!(!body.contains("</script><script>alert(1)</script>"));
        assert!(body.contains("/docs/__flexdoc/renderer.js"));
    }
}
