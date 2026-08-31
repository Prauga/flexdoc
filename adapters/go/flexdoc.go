package flexdoc

import (
    "embed"
    "encoding/json"
    "fmt"
    "html"
    "io/fs"
    "net/http"
    "path"
    "strings"
)

//go:embed assets/flexdoc.standalone.js assets/flexdoc.standalone.css
var embeddedRenderer embed.FS

type Config struct {
    Path         string
    SpecURL      string
    Title        string
    Theme        string
    TryItEnabled bool
}

type handler struct { cfg Config; assets fs.FS; spec []byte }

// Handler returns a self-contained net/http handler using the canonical FlexDoc renderer bundled with this Go module.
func Handler(cfg Config) http.Handler {
    assets, err := fs.Sub(embeddedRenderer, "assets")
    if err != nil { panic(err) }
    return HandlerWithAssets(cfg, assets)
}

// HandlerFromOpenAPI renders a generated OpenAPI document directly. This is suitable for
// Huma and other code-first generators and avoids requiring an application-owned spec route.
func HandlerFromOpenAPI(cfg Config, spec any) (http.Handler, error) {
    data, err := json.Marshal(spec)
    if err != nil { return nil, fmt.Errorf("marshal OpenAPI document: %w", err) }
    assets, err := fs.Sub(embeddedRenderer, "assets")
    if err != nil { return nil, err }
    return handlerWithSpec(cfg, assets, data), nil
}

// HandlerWithAssets allows applications to override the bundled renderer assets, primarily for development/testing.
func HandlerWithAssets(cfg Config, assets fs.FS) http.Handler { return handlerWithSpec(cfg, assets, nil) }

func handlerWithSpec(cfg Config, assets fs.FS, spec []byte) http.Handler {
    if cfg.Path == "" { cfg.Path = "/docs" }
    if cfg.SpecURL == "" { cfg.SpecURL = "/openapi.json" }
    if len(spec) > 0 { cfg.SpecURL = strings.TrimRight(cfg.Path, "/") + "/__flexdoc/openapi.json" }
    if cfg.Title == "" { cfg.Title = "API Reference" }
    if cfg.Theme == "" { cfg.Theme = "system" }
    cfg.Path = "/" + strings.Trim(strings.TrimSpace(cfg.Path), "/")
    if len(spec) > 0 { cfg.SpecURL = cfg.Path + "/__flexdoc/openapi.json" }
    return &handler{cfg: cfg, assets: assets, spec: spec}
}

func (h *handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
    switch r.URL.Path {
    case h.cfg.Path, h.cfg.Path + "/":
        w.Header().Set("Content-Type", "text/html; charset=utf-8")
        _, _ = w.Write([]byte(h.html()))
    case h.cfg.Path + "/__flexdoc/renderer.js": h.asset(w, "flexdoc.standalone.js", "application/javascript; charset=utf-8")
    case h.cfg.Path + "/__flexdoc/renderer.css": h.asset(w, "flexdoc.standalone.css", "text/css; charset=utf-8")
    case h.cfg.Path + "/__flexdoc/openapi.json":
        if len(h.spec) == 0 { http.NotFound(w, r); return }
        w.Header().Set("Content-Type", "application/json; charset=utf-8")
        w.Header().Set("Cache-Control", "no-store")
        _, _ = w.Write(h.spec)
    default: http.NotFound(w, r)
    }
}

func (h *handler) asset(w http.ResponseWriter, name, contentType string) {
    data, err := fs.ReadFile(h.assets, name)
    if err != nil { http.Error(w, "FlexDoc renderer asset is unavailable", http.StatusInternalServerError); return }
    w.Header().Set("Content-Type", contentType)
    w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
    _, _ = w.Write(data)
}

func safeJSON(value any) string {
    data, _ := json.Marshal(value)
    return strings.NewReplacer("<", `\u003c`, ">", `\u003e`, "&", `\u0026`, "\u2028", `\\u2028`, "\u2029", `\\u2029`).Replace(string(data))
}

func (h *handler) html() string {
    options := map[string]any{"contractVersion":"1", "title":h.cfg.Title, "theme":h.cfg.Theme, "tryIt":map[string]bool{"enabled":h.cfg.TryItEnabled}}
    base := path.Clean(h.cfg.Path)
    return fmt.Sprintf(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>%s</title><link rel="stylesheet" href="%s/__flexdoc/renderer.css"></head><body><div id="flexdoc-root"></div><script>window.__FLEXDOC_SPEC_URL__=%s;window.__FLEXDOC_OPTIONS__=%s;</script><script src="%s/__flexdoc/renderer.js"></script><script>(async function(){const root=document.getElementById('flexdoc-root');try{const baseUri=new URL(window.__FLEXDOC_SPEC_URL__,window.location.href).toString();const response=await fetch(baseUri);if(!response.ok)throw new Error('Unable to load OpenAPI specification: HTTP '+response.status);const spec=await response.json();const config={spec:spec,options:window.__FLEXDOC_OPTIONS__||{},baseUri:baseUri};if(window.FlexDocStandalone.mountAsync)await window.FlexDocStandalone.mountAsync(root,config);else window.FlexDocStandalone.mount(root,config);}catch(error){root.textContent=error instanceof Error?error.message:String(error);}})();</script></body></html>`, html.EscapeString(h.cfg.Title), base, safeJSON(h.cfg.SpecURL), safeJSON(options), base)
}
