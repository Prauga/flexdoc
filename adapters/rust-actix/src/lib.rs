use actix_web::{http::header, web, HttpResponse, Scope};
use serde_json::json;

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
    fn default() -> Self {
        Self {
            path: "/docs".into(),
            spec_url: "/openapi.json".into(),
            title: "API Reference".into(),
            theme: "system".into(),
            try_it_enabled: true,
        }
    }
}

/// Build an Actix Web scope that serves the docs shell and packaged canonical renderer assets.
pub fn scope(mut cfg: Config) -> Scope {
    cfg.path = format!("/{}", cfg.path.trim_matches('/'));
    if cfg.path == "/" { cfg.path = "/docs".into(); }
    let base = cfg.path.clone();
    web::scope(&base)
        .app_data(web::Data::new(cfg))
        .route("", web::get().to(page))
        .route("/", web::get().to(page))
        .route("/__flexdoc/renderer.js", web::get().to(js))
        .route("/__flexdoc/renderer.css", web::get().to(css))
}

async fn page(cfg: web::Data<Config>) -> HttpResponse {
    HttpResponse::Ok()
        .insert_header((header::CONTENT_TYPE, "text/html; charset=utf-8"))
        .insert_header((header::CACHE_CONTROL, "no-cache"))
        .body(render_html(&cfg))
}

async fn js() -> HttpResponse { asset(RENDERER_JS, "application/javascript; charset=utf-8") }
async fn css() -> HttpResponse { asset(RENDERER_CSS, "text/css; charset=utf-8") }

fn asset(body: &'static [u8], content_type: &'static str) -> HttpResponse {
    HttpResponse::Ok()
        .insert_header((header::CONTENT_TYPE, content_type))
        .insert_header((header::CACHE_CONTROL, "public, max-age=31536000, immutable"))
        .body(body)
}

fn renderer_version() -> String {
    let mut hash = 0xcbf29ce484222325_u64;
    for byte in RENDERER_JS.iter().chain([0_u8].iter()).chain(RENDERER_CSS.iter()) {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    format!("{hash:016x}")
}

fn safe_json(value: serde_json::Value) -> String {
    value.to_string()
        .replace('<', "\\u003c")
        .replace('>', "\\u003e")
        .replace('&', "\\u0026")
        .replace('\u{2028}', "\\u2028")
        .replace('\u{2029}', "\\u2029")
}

fn escape_html(value: &str) -> String {
    value.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}

fn render_html(cfg: &Config) -> String {
    let options = json!({
        "contractVersion": "1",
        "title": cfg.title,
        "theme": cfg.theme,
        "tryIt": {"enabled": cfg.try_it_enabled}
    });
    let version = renderer_version();
    format!(r#"<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>{}</title><link rel="stylesheet" href="{}/__flexdoc/renderer.css?v={}"></head><body><div id="flexdoc-root"></div><script>window.__FLEXDOC_SPEC_URL__={};window.__FLEXDOC_OPTIONS__={};</script><script src="{}/__flexdoc/renderer.js?v={}"></script><script>(async function(){{const root=document.getElementById('flexdoc-root');try{{const baseUri=new URL(window.__FLEXDOC_SPEC_URL__,window.location.href).toString();const response=await fetch(baseUri);if(!response.ok)throw new Error('Unable to load OpenAPI specification: HTTP '+response.status);const spec=await response.json();const config={{spec:spec,options:window.__FLEXDOC_OPTIONS__||{{}},baseUri:baseUri}};if(window.FlexDocStandalone.mountAsync)await window.FlexDocStandalone.mountAsync(root,config);else window.FlexDocStandalone.mount(root,config);}}catch(error){{root.textContent=error instanceof Error?error.message:String(error);}}}})();</script></body></html>"#,
        escape_html(&cfg.title), cfg.path, version, safe_json(json!(cfg.spec_url)), safe_json(options), cfg.path, version)
}

#[cfg(test)]
mod tests {
    use super::*;
    use actix_web::{test, App};

    #[actix_rt::test]
    async fn serves_docs_and_canonical_assets() {
        let app = test::init_service(App::new().service(scope(Config {
            path: "/reference".into(),
            title: "Actix <API>".into(),
            ..Default::default()
        }))).await;

        let docs = test::call_service(&app, test::TestRequest::get().uri("/reference").to_request()).await;
        assert!(docs.status().is_success());
        let docs_body = test::read_body(docs).await;
        let docs_text = String::from_utf8(docs_body.to_vec()).unwrap();
        assert!(docs_text.contains("Actix &lt;API&gt;"));
        assert!(docs_text.contains("/reference/__flexdoc/renderer.js?v="));

        let js = test::call_service(&app, test::TestRequest::get().uri("/reference/__flexdoc/renderer.js").to_request()).await;
        assert!(js.status().is_success());
        assert_eq!(js.headers().get(header::CACHE_CONTROL).unwrap(), "public, max-age=31536000, immutable");
        assert_eq!(test::read_body(js).await.as_ref(), RENDERER_JS);
    }
}
