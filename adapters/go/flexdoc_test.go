package flexdoc

import (
    "io/fs"
    "net/http/httptest"
    "strings"
    "testing"
    "testing/fstest"
)

func TestHandlerServesPageAndAssets(t *testing.T) {
    assets := fstest.MapFS{
        "flexdoc.standalone.js": &fstest.MapFile{Data: []byte("window.FlexDocStandalone={};")},
        "flexdoc.standalone.css": &fstest.MapFile{Data: []byte("body{}")},
    }
    _ = fs.ValidPath("flexdoc.standalone.js")
    h := Handler(Config{Path:"/reference", SpecURL:"/openapi.json", Title:"</script><script>alert(1)</script>", Theme:"dark", TryItEnabled:true}, assets)
    req := httptest.NewRequest("GET", "/reference", nil)
    rec := httptest.NewRecorder()
    h.ServeHTTP(rec, req)
    if rec.Code != 200 { t.Fatalf("status = %d", rec.Code) }
    body := rec.Body.String()
    if !strings.Contains(body, "/reference/__flexdoc/renderer.js") { t.Fatal("renderer route missing") }
    if strings.Contains(body, "</script><script>alert(1)</script>") { t.Fatal("unsafe title rendered") }

    req = httptest.NewRequest("GET", "/reference/__flexdoc/renderer.js", nil)
    rec = httptest.NewRecorder()
    h.ServeHTTP(rec, req)
    if rec.Code != 200 || !strings.Contains(rec.Header().Get("Cache-Control"), "immutable") { t.Fatal("asset response invalid") }
}
