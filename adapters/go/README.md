# Prauga FlexDoc Go adapter

Self-contained `net/http` integration for FlexDoc. It packages the canonical browser renderer; OpenAPI rendering is not reimplemented in Go.

```go
import flexdoc "github.com/prauga/flexdoc/adapters/go"

http.Handle("/docs", flexdoc.Handler(flexdoc.Config{
    Path: "/docs",
    SpecURL: "/openapi.json",
    Title: "My API",
    TryItEnabled: true,
}))
```

The module embeds its version-matched renderer JS/CSS. `HandlerWithAssets` is available when an application intentionally wants to override those assets.

For this monorepo submodule, release tags follow Go's submodule convention: `adapters/go/v<version>`.
