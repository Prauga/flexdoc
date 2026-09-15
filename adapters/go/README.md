# Prauga FlexDoc Go adapter

`github.com/prauga/flexdoc/adapters/go` `0.5.5` provides a self-contained `net/http` integration for FlexDoc. It packages the canonical browser renderer; OpenAPI rendering is not reimplemented in Go.

With an existing OpenAPI endpoint:

```go
import flexdoc "github.com/prauga/flexdoc/adapters/go"

docs := flexdoc.Handler(flexdoc.Config{
    Path: "/docs",
    SpecURL: "/openapi.json",
    Title: "My API",
    TryItEnabled: true,
})
http.Handle("/docs/", docs)
```

`Config` also accepts `Expand` (a preset string or `[]string`), `TryItDefaultServer`, `TryItCredentials`, and `TryItAPIClientPersistenceKey` (a string or `false`); unset values are omitted from `window.__FLEXDOC_OPTIONS__`.

## Native API-host execution (3.3)

Create a native executor with an explicit exact-origin allowlist and attach it to the same `net/http` handler. Protect the docs/execute subtree with application authentication/authorization middleware first, then set `HostExecutionProtected: true` to acknowledge that boundary:

```go
executor, err := flexdoc.NewHostExecution([]string{
    "https://api.example.internal",
})
if err != nil { log.Fatal(err) }

docs := flexdoc.Handler(flexdoc.Config{
    Path: "/docs",
    SpecURL: "/openapi.json",
    Title: "My API",
    TryItEnabled: true,
    TryItHostExecution: true,
    HostExecutionProtected: true,
    HostExecution: executor,
})
http.Handle("/docs/", docs)
```

When both `TryItHostExecution` and a real `HostExecution` are present, the handler owns `POST /docs/__flexdoc/execute` and the renderer truthfully advertises `hostExecution.available: true`. Setting `TryItHostExecution: true` without an executor continues to advertise `available: false` and the execute path remains unregistered (`404`).

**Fail-closed rule:** an available native executor with `TryItHostExecution: true` causes handler construction to panic unless `HostExecutionProtected: true` is present. That field is only an explicit assertion that the surrounding application has installed an authentication/authorization boundary; it does not authenticate requests itself. The outbound origin allowlist is not user authentication.

The Go host consumes the same JSON or canonical multipart envelope used by the Node/JVM/Python hosts and FlexDoc Runner. It requires `X-FlexDoc-Execute: 1`, accepts only explicitly allowlisted HTTP(S) origins, strips unsafe transport headers, revalidates same-origin redirects, bounds incoming envelopes to 32 MiB and responses to 10 MiB, and applies a full-response deadline. Basic, Bearer, OAuth2 bearer-token, and header/query API-key request auth are supported as canonical request-draft features.

This first Go slice intentionally advertises an empty host-only capability list. Session cookie jars, client certificates, Digest, Hawk, NTLM/Negotiate, OAuth 1.0, and AWS Signature V4 remain unavailable until implemented natively.

The Go executor resolves and validates the target inside its custom `DialContext`, then connects directly to one of the validated IP addresses. Link-local/cloud-metadata hostnames and resolved link-local addresses are rejected before connection, while the original request hostname is preserved for HTTP Host and TLS identity semantics.

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

`HandlerFromOpenAPI` accepts any JSON-serializable OpenAPI 3.x value and exposes it beneath the FlexDoc route, so the application does not need a second spec endpoint. It accepts the same `TryItHostExecution` / `HostExecutionProtected` / `HostExecution` configuration when native execution is required.

The module embeds its version-matched renderer JS/CSS. `HandlerWithAssets` is available when an application intentionally wants to override those assets.

For this monorepo submodule, release tags follow Go's submodule convention: `adapters/go/v<version>`.
