# Prauga FlexDoc for Actix Web

`prauga-flexdoc-actix` `0.4.4` exposes an Actix `Scope` backed by the same canonical FlexDoc renderer shipped by the Axum adapter.

```rust
use actix_web::{App, HttpServer};
use prauga_flexdoc_actix::{scope, Config};

HttpServer::new(|| App::new().service(scope(Config {
    path: "/docs".into(),
    spec_url: "/openapi.json".into(),
    title: "My API".into(),
    ..Default::default()
})))
```

`Config` also accepts `expand`, `try_it_default_server`, `try_it_credentials`, and `try_it_api_client_persistence_key`. Flexible renderer values use `serde_json::Value`, so expansion can be a preset string or section array and persistence can be a string or JSON `false`.

## Native API-host execution (3.3)

Create a native executor with a non-empty exact-origin allowlist and attach it to the same Actix scope:

```rust
use std::sync::Arc;
use prauga_flexdoc_actix::{scope, Config, HostExecution};

let executor = Arc::new(HostExecution::new([
    "https://api.example.internal",
])?);

let docs = scope(Config {
    path: "/docs".into(),
    spec_url: "/openapi.json".into(),
    try_it_host_execution: true,
    host_execution: Some(executor),
    ..Default::default()
});
```

FlexDoc registers `POST /docs/__flexdoc/execute` only when both `try_it_host_execution` and a real `host_execution` are present. Setting the protocol flag without an executor keeps `hostExecution.available` false and leaves the execute route unregistered (`404`).

The Actix host consumes the same JSON or canonical multipart envelope as the other FlexDoc hosts and Runner. It requires `X-FlexDoc-Execute: 1`, strips unsafe transport headers, rejects cross-origin redirects, revalidates same-origin redirects, bounds incoming execute envelopes to 32 MiB and target responses to 10 MiB, and applies one deadline across the complete response transfer. Basic, Bearer, OAuth2 bearer-token, and header/query API-key request auth are supported as canonical request-draft features.

This first Actix slice intentionally advertises an empty host-only capability list. Session cookie jars, client certificates, Digest, Hawk, NTLM/Negotiate, OAuth 1.0 and AWS Signature V4 remain unavailable until implemented natively.

The standalone Axum and Actix crates carry a byte-identical Rust executor implementation so neither published adapter depends on the other web framework. The executor rejects known cloud-metadata/link-local hostnames and preflights DNS resolutions before outbound requests. As with the Axum package, `reqwest` does not provide connection-time DNS pinning in this implementation, so the documented Java/Python/Rust preflight gap remains; Go and .NET provide stronger connection-time pinning. RFC1918/VPC addresses are not blanket-blocked and still require an explicit exact-origin allowlist.

The crate packages renderer JS/CSS locally and serves fingerprinted immutable asset URLs. No CDN or Actix-specific renderer implementation is used.
