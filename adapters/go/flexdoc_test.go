package flexdoc

import (
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
    if !strings.Contains(body, "/reference/__flexdoc/renderer.js") { t.Fatal("renderer route missing") }
    if strings.Contains(body, "</script><script>alert(1)</script>") { t.Fatal("unsafe title rendered") }
}
