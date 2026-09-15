# Prauga FlexDoc for Plug and Phoenix

`prauga_flexdoc` `0.4.4` is a self-contained Plug that packages the canonical FlexDoc renderer.

## Plug

```elixir
plug PraugaFlexDoc.Plug,
  path: "/docs",
  spec_url: "/openapi.json",
  title: "My API"
```

The Plug config also accepts `expand`, `try_it_default_server`, `try_it_credentials`, and `try_it_api_client_persistence_key`; expansion may be a preset string or section list, and persistence may be a string or `false`.

## Native API-host execution (3.3)

Create a framework-neutral native executor with an explicit exact-origin allowlist, protect the docs/execute subtree with application authentication/authorization plugs, then acknowledge that boundary explicitly:

```elixir
host_execution =
  PraugaFlexDoc.HostExecution.new!([
    "https://api.example.internal"
  ])

plug PraugaFlexDoc.Plug,
  path: "/docs",
  spec_url: "/openapi.json",
  title: "My API",
  try_it_enabled: true,
  try_it_host_execution: true,
  host_execution_protected: true,
  host_execution: host_execution
```

When both `try_it_host_execution: true` and a real `PraugaFlexDoc.HostExecution` are configured, the Plug owns `POST /docs/__flexdoc/execute` and the renderer advertises `hostExecution.available: true`. Enabling the option without an executor keeps `available: false` and the execute path returns `404`.

**Fail-closed rule:** Plug initialization raises `ArgumentError` when host execution is available but `host_execution_protected: true` is absent. The option is only an explicit assertion that the surrounding Plug/Phoenix pipeline already authenticates and authorizes the documentation/execute surface; it does not install authentication itself. The outbound origin allowlist is not user authentication.

The Elixir host consumes the existing FlexDoc JSON or canonical multipart execute envelope. It requires `X-FlexDoc-Execute: 1`, accepts only explicitly allowlisted HTTP(S) origins, strips unsafe transport headers, revalidates same-origin redirects, bounds incoming envelopes to 32 MiB and returned response bodies to 10 MiB, and applies a full-request deadline. Basic, Bearer, OAuth2 bearer-token, and header/query API-key auth are supported as canonical request-draft features.

This first Elixir slice intentionally advertises an empty host-only capability list. Session cookie jars, client certificates, Digest, Hawk, NTLM/Negotiate, OAuth 1.0, and AWS Signature V4 remain unavailable until they are implemented natively.

The Elixir executor resolves and validates the target before each request or redirect, rejects link-local/cloud-metadata addresses, and uses Mint to connect directly to one of the validated IP addresses. The original hostname remains the HTTP Host and TLS server name/certificate identity, so the socket cannot silently re-resolve to a different address between validation and connection.

## Phoenix

Phoenix routers can forward directly to the same Plug. Place the application's authentication/authorization plugs before the forward, then use the same explicit protection acknowledgement when host execution is enabled:

```elixir
forward "/docs", PraugaFlexDoc.Plug,
  path: "/docs",
  spec_url: "/openapi.json",
  title: "My API"
```

Because Phoenix is Plug-based, no Phoenix-specific renderer implementation is necessary. The same `try_it_host_execution` / `host_execution_protected` / `host_execution` options apply when using `forward`.

CI exercises the package through `Plug.Test` and byte-compares its packaged JS/CSS with the canonical renderer.
