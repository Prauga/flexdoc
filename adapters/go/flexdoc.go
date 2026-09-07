// Package flexdoc provides a self-contained net/http handler for the Prauga FlexDoc renderer.
package flexdoc

import (
    "crypto/sha256"
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

// Config holds FlexDoc renderer settings.
type Config struct {
    // Path is the URL prefix where the docs shell and renderer assets are served.
    Path                          string
    // SpecURL is the OpenAPI document URL resolved by the browser bootstrap page.
    SpecURL                       string
    // Title is the page and renderer title shown in the docs shell.
    Title                         string
    // Theme is the renderer theme preset: "system", "light", or "dark".
    Theme                         string
    // TryItEnabled controls whether the Try It client is enabled.
    TryItEnabled                  bool
    // Expand is an optional expansion preset or section list forwarded to the renderer.
    Expand                        any
    // TryItDefaultServer is an optional default server URL for Try It requests.
    TryItDefaultServer            string
    // TryItCredentials is an optional fetch credentials mode for Try It requests.
    TryItCredentials              string
    // TryItAPIClientPersistenceKey is an optional persistence key, or false to disable.
    TryItAPIClientPersistenceKey  any
    // TryItHostExecution emits host-execution protocol metadata; execution is not implemented by this adapter.
    TryItHostExecution              bool
}

type handler struct { cfg Config; assets fs.FS; spec []byte; rendererVersion string }

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
    return &handler{cfg: cfg, assets: assets, spec: spec, rendererVersion: assetVersion(assets)}
}

func assetVersion(assets fs.FS) string {
    hash := sha256.New()
    for _, name := range []string{"flexdoc.standalone.js", "flexdoc.standalone.css"} {
        data, err := fs.ReadFile(assets, name)
        if err != nil { return "unavailable" }
        _, _ = hash.Write(data)
        _, _ = hash.Write([]byte{0})
    }
    return fmt.Sprintf("%x", hash.Sum(nil)[:8])
}

func (h *handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
    switch r.URL.Path {
    case h.cfg.Path, h.cfg.Path + "/":
        w.Header().Set("Content-Type", "text/html; charset=utf-8")
        w.Header().Set("Cache-Control", "no-cache")
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
    tryIt := map[string]any{"enabled": h.cfg.TryItEnabled}
    if h.cfg.TryItDefaultServer != "" { tryIt["defaultServer"] = h.cfg.TryItDefaultServer }
    if h.cfg.TryItCredentials != "" { tryIt["credentials"] = h.cfg.TryItCredentials }
    if h.cfg.TryItAPIClientPersistenceKey != nil { tryIt["apiClientPersistenceKey"] = h.cfg.TryItAPIClientPersistenceKey }
    if h.cfg.TryItHostExecution {
        tryIt["hostExecution"] = map[string]any{
            "available": false,
            "endpoint": h.cfg.Path + "/__flexdoc/execute",
            "capabilities": []string{},
        }
    }

    options := map[string]any{"contractVersion":"1", "title":h.cfg.Title, "theme":h.cfg.Theme, "tryIt":tryIt}
    if h.cfg.Expand != nil { options["expand"] = h.cfg.Expand }

    base := path.Clean(h.cfg.Path)
    return fmt.Sprintf(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>%s</title><link rel="stylesheet" href="%s/__flexdoc/renderer.css?v=%s"></head><body><div id="flexdoc-root"></div><script>window.__FLEXDOC_SPEC_URL__=%s;window.__FLEXDOC_OPTIONS__=%s;</script><script src="%s/__flexdoc/renderer.js?v=%s"></script><script>(async function(){const root=document.getElementById('flexdoc-root');try{const baseUri=new URL(window.__FLEXDOC_SPEC_URL__,window.location.href).toString();const response=await fetch(baseUri);if(!response.ok)throw new Error('Unable to load OpenAPI specification: HTTP '+response.status);const spec=await response.json();const config={spec:spec,options:window.__FLEXDOC_OPTIONS__||{},baseUri:baseUri};if(window.FlexDocStandalone.mountAsync)await window.FlexDocStandalone.mountAsync(root,config);else window.FlexDocStandalone.mount(root,config);}catch(error){root.textContent=error instanceof Error?error.message:String(error);}})();</script></body></html>`, html.EscapeString(h.cfg.Title), base, h.rendererVersion, safeJSON(h.cfg.SpecURL), safeJSON(options), base, h.rendererVersion)
}
