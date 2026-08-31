# FlexDoc Go adapter

Thin `net/http` integration for FlexDoc. It does not parse or render OpenAPI in Go; it hosts the canonical browser renderer.

```go
assets := os.DirFS("./flexdoc-renderer")
http.Handle("/docs", flexdoc.Handler(flexdoc.Config{
    Path: "/docs",
    SpecURL: "/openapi.json",
    Title: "My API",
    TryItEnabled: true,
}, assets))
```

The asset directory must contain `flexdoc.standalone.js` and `flexdoc.standalone.css` from the matching FlexDoc renderer bundle.
