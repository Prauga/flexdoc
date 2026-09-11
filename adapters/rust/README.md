# Prauga FlexDoc Rust / Axum adapter

`prauga-flexdoc-axum` `0.5.4` provides self-contained Axum routes for FlexDoc. The crate embeds the canonical browser renderer instead of implementing OpenAPI UI behavior in Rust.

With an existing OpenAPI endpoint:

```rust
let app = prauga_flexdoc_axum::router(prauga_flexdoc_axum::Config {
    path: "/docs".into(),
    spec_url: "/openapi.json".into(),
    ..Default::default()
});
```

`Config` also accepts `expand`, `try_it_default_server`, `try_it_credentials`, and `try_it_api_client_persistence_key`. The flexible renderer values use `serde_json::Value`, so `expand` can be a preset string or section array and persistence can be a string or JSON `false`.

## Native API-host execution (3.3)

Create a native executor with a non-empty exact-origin allowlist and attach it to the Axum docs router:

```rust
use std::sync::Arc;
use prauga_flexdoc_axum::{Config, HostExecution};

let executor = Arc::new(HostExecution::new([
    "https://api.example.internal",
])?);

let docs = prauga_flexdoc_axum::router(Config {
    path: "/docs".into(),
    spec_url: "/openapi.json".into(),
    try_it_host_execution: true,
    host_execution: Some(executor),
    ..Default::default()
});
```

FlexDoc registers `POST /docs/__flexdoc/execute` only when both `try_it_host_execution` and a real `host_execution` are present. Enabling the protocol flag without an executor keeps `hostExecution.available` false and leaves the execute route unregistered (`404`), so the renderer never advertises a fake native transport.

The Rust host consumes the same JSON or canonical multipart envelope as Node, JVM, Python, Go, .NET and FlexDoc Runner. It requires `X-FlexDoc-Execute: 1`, strips unsafe transport headers, rejects cross-origin redirects, revalidates each same-origin redirect, bounds incoming execute envelopes to 32 MiB and target responses to 10 MiB, and applies one deadline across the complete response transfer. Basic, Bearer, OAuth2 bearer-token, and header/query API-key request auth are supported as canonical request-draft features.

This first Rust slice intentionally advertises an empty host-only capability list. Session cookie jars, client certificates, Digest, Hawk, NTLM/Negotiate, OAuth 1.0 and AWS Signature V4 remain unavailable until implemented natively.

The executor rejects known cloud-metadata/link-local hostnames and resolves every outbound hop before connection. Every resolved address is validated; reqwest system proxies are disabled; and hostname resolution for the actual request is overridden with the validated address set, while the original URL hostname remains intact for HTTP and TLS verification. This closes the DNS-preflight/connection-time resolution gap without weakening normal hostname semantics. Ordinary RFC1918/VPC addresses are not denied generically and remain governed by the explicit exact-origin allowlist.

For code-first APIs using `utoipa`, pass the generated document directly:

```rust
use utoipa::OpenApi;

let docs = prauga_flexdoc_axum::router_with_openapi(
    prauga_flexdoc_axum::Config::default(),
    &ApiDoc::openapi(),
)?;
```

`router_with_openapi` accepts any `serde::Serialize` OpenAPI value, serves it beneath the FlexDoc route, and requires no separate application-owned spec endpoint. Native host execution can be configured on the same `Config` value.

The published crate includes the version-matched renderer JS/CSS under `assets/`.
