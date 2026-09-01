package flexdoc

import (
    "encoding/json"
    "net/http/httptest"
    "strings"
    "testing"
    "testing/fstest"
)

func TestHandlerServesBundledAssets(t *testing.T) {
    h := Handler(Config{Path:"/reference", SpecURL:"/openapi.json", Title:"API", Theme:"dark", TryItEnabled:true})
    rec := httptest.NewRecorder()
    h.ServeHTTP(rec, httptest.NewRequest("GET", "/reference/__flexdoc/renderer.js", nil))
    if rec.Code != 200 || rec.Body.Len() == 0 { t.Fatal("bundled renderer asset unavailable") }
}

func TestHandlerWithAssetsIsSafe(t *testing.T) {
    assets := fstest.MapFS{
        "flexdoc.standalone.js": &fstest.MapFile{Data: []byte("window.FlexDocStandalone={};")},
        "flexdoc.standalone.css": &fstest.MapFile{Data: []byte("body{}")},
    }
    h := HandlerWithAssets(Config{Path:"/reference", SpecURL:"/openapi.json", Title:"</script><script>alert(1)</script>", Theme:"dark", TryItEnabled:true}, assets)
    rec := httptest.NewRecorder()
    h.ServeHTTP(rec, httptest.NewRequest("GET", "/reference", nil))
    if rec.Code != 200 { t.Fatalf("status = %d", rec.Code) }
    body := rec.Body.String()
    if !strings.Contains(body, "/reference/__flexdoc/renderer.js?v=") { t.Fatal("versioned renderer route missing") }
    if !strings.Contains(body, "/reference/__flexdoc/renderer.css?v=") { t.Fatal("versioned renderer stylesheet missing") }
    if strings.Contains(body, "</script><script>alert(1)</script>") { t.Fatal("unsafe title rendered") }
}

func TestHandlerFromOpenAPIServesGeneratedSpecAndDocs(t *testing.T) {
    spec := map[string]any{
        "openapi": "3.1.0",
        "info": map[string]any{"title": "Generated", "version": "1"},
        "paths": map[string]any{},
    }
    h, err := HandlerFromOpenAPI(Config{Path:"/reference", Title:"Generated API"}, spec)
    if err != nil { t.Fatalf("HandlerFromOpenAPI: %v", err) }

    page := httptest.NewRecorder()
    h.ServeHTTP(page, httptest.NewRequest("GET", "/reference", nil))
    if page.Code != 200 { t.Fatalf("docs status = %d", page.Code) }
    if !strings.Contains(page.Body.String(), "/reference/__flexdoc/openapi.json") { t.Fatal("docs page does not reference generated spec route") }

    generated := httptest.NewRecorder()
    h.ServeHTTP(generated, httptest.NewRequest("GET", "/reference/__flexdoc/openapi.json", nil))
    if generated.Code != 200 { t.Fatalf("spec status = %d", generated.Code) }
    if got := generated.Header().Get("Content-Type"); !strings.HasPrefix(got, "application/json") { t.Fatalf("content-type = %q", got) }
    var decoded map[string]any
    if err := json.Unmarshal(generated.Body.Bytes(), &decoded); err != nil { t.Fatalf("decode generated spec: %v", err) }
    if decoded["openapi"] != "3.1.0" { t.Fatalf("openapi = %#v", decoded["openapi"]) }
}
