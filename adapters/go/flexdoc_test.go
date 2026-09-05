package flexdoc

import (
    "encoding/json"
    "net/http/httptest"
    "strings"
    "testing"
    "testing/fstest"
)

func testAssets() fstest.MapFS {
    return fstest.MapFS{
        "flexdoc.standalone.js": &fstest.MapFile{Data: []byte("window.FlexDocStandalone={};")},
        "flexdoc.standalone.css": &fstest.MapFile{Data: []byte("body{}")},
    }
}

func optionsFromHTML(t *testing.T, body string) map[string]any {
    t.Helper()
    const prefix = "window.__FLEXDOC_OPTIONS__="
    start := strings.Index(body, prefix)
    if start < 0 { t.Fatal("renderer options missing") }
    rest := body[start+len(prefix):]
    end := strings.Index(rest, ";</script>")
    if end < 0 { t.Fatal("renderer options terminator missing") }
    var options map[string]any
    if err := json.Unmarshal([]byte(rest[:end]), &options); err != nil { t.Fatalf("decode renderer options: %v", err) }
    return options
}

func TestHandlerServesBundledAssets(t *testing.T) {
    h := Handler(Config{Path:"/reference", SpecURL:"/openapi.json", Title:"API", Theme:"dark", TryItEnabled:true})
    rec := httptest.NewRecorder()
    h.ServeHTTP(rec, httptest.NewRequest("GET", "/reference/__flexdoc/renderer.js", nil))
    if rec.Code != 200 || rec.Body.Len() == 0 { t.Fatal("bundled renderer asset unavailable") }
}

func TestHandlerWithAssetsIsSafe(t *testing.T) {
    h := HandlerWithAssets(Config{Path:"/reference", SpecURL:"/openapi.json?x=</script>", Title:"</script><script>alert(1)</script>", Theme:"dark", TryItEnabled:true}, testAssets())
    rec := httptest.NewRecorder()
    h.ServeHTTP(rec, httptest.NewRequest("GET", "/reference", nil))
    if rec.Code != 200 { t.Fatalf("status = %d", rec.Code) }
    body := rec.Body.String()
    if !strings.Contains(body, "/reference/__flexdoc/renderer.js?v=") { t.Fatal("versioned renderer route missing") }
    if !strings.Contains(body, "/reference/__flexdoc/renderer.css?v=") { t.Fatal("versioned renderer stylesheet missing") }
    if strings.Contains(body, "</script><script>alert(1)</script>") { t.Fatal("unsafe title rendered") }
    if strings.Contains(body, `"/openapi.json?x=</script>"`) { t.Fatal("unsafe spec URL rendered") }
}

func TestRendererOptionsOmitOptionalFields(t *testing.T) {
    h := HandlerWithAssets(Config{Path:"/reference", SpecURL:"/openapi.json", Title:"API", Theme:"dark", TryItEnabled:true}, testAssets())
    rec := httptest.NewRecorder()
    h.ServeHTTP(rec, httptest.NewRequest("GET", "/reference", nil))
    options := optionsFromHTML(t, rec.Body.String())
    if _, ok := options["expand"]; ok { t.Fatal("expand should be omitted") }
    tryIt := options["tryIt"].(map[string]any)
    if tryIt["enabled"] != true { t.Fatalf("tryIt.enabled = %#v", tryIt["enabled"]) }
    if len(tryIt) != 1 { t.Fatalf("unexpected Try It options: %#v", tryIt) }
}

func TestRendererOptionsSerializeExpandAndTryItSettings(t *testing.T) {
    cases := []struct { name string; expand any }{
        {"preset", "documentation"},
        {"sections", []string{"parameters", "tryIt"}},
    }
    for _, tc := range cases {
        t.Run(tc.name, func(t *testing.T) {
            h := HandlerWithAssets(Config{
                Path:"/reference", SpecURL:"/openapi.json", Title:"API", Theme:"dark", TryItEnabled:true,
                Expand:tc.expand, TryItDefaultServer:"https://gateway.example.test", TryItCredentials:"include", TryItAPIClientPersistenceKey:false,
            }, testAssets())
            rec := httptest.NewRecorder()
            h.ServeHTTP(rec, httptest.NewRequest("GET", "/reference", nil))
            options := optionsFromHTML(t, rec.Body.String())
            expectedExpand, _ := json.Marshal(tc.expand)
            actualExpand, _ := json.Marshal(options["expand"])
            if string(actualExpand) != string(expectedExpand) { t.Fatalf("expand = %s, want %s", actualExpand, expectedExpand) }
            tryIt := options["tryIt"].(map[string]any)
            if tryIt["enabled"] != true || tryIt["defaultServer"] != "https://gateway.example.test" || tryIt["credentials"] != "include" { t.Fatalf("Try It options = %#v", tryIt) }
            if value, ok := tryIt["apiClientPersistenceKey"].(bool); !ok || value { t.Fatalf("persistence key = %#v", tryIt["apiClientPersistenceKey"]) }
        })
    }
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
