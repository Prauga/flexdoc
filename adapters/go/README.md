# Prauga FlexDoc Go adapter

Self-contained `net/http` integration for FlexDoc. It packages the canonical browser renderer; OpenAPI rendering is not reimplemented in Go.

With an existing OpenAPI endpoint:

```go
import flexdoc "github.com/prauga/flexdoc/adapters/go"

http.Handle("/docs", flexdoc.Handler(flexdoc.Config{
    Path: "/docs",
    SpecURL: "/openapi.json",
    Title: "My API",
    TryItEnabled: true,
}))
```

`Config` also accepts `Expand` (a preset string or `[]string`), `TryItDefaultServer`, `TryItCredentials`, and `TryItAPIClientPersistenceKey` (a string or `false`); unset values are omitted from `window.__FLEXDOC_OPTIONS__`.

For code-first generators such as Huma, pass the generated OpenAPI document directly:

```go
spec := api.OpenAPI()

docs, err := flexdoc.HandlerFromOpenAPI(flexdoc.Config{
    Path: "/docs",
    Title: "My API",
    TryItEnabled: true,
}, spec)
if err != nil { log.Fatal(err) }

http.Handle("/docs/", docs)
```

`HandlerFromOpenAPI` accepts any JSON-serializable OpenAPI 3.x value and exposes it beneath the FlexDoc route, so the application does not need a second spec endpoint.

The module embeds its version-matched renderer JS/CSS. `HandlerWithAssets` is available when an application intentionally wants to override those assets.

For this monorepo submodule, release tags follow Go's submodule convention: `adapters/go/v<version>`.
