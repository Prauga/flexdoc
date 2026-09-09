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

Create a framework-neutral native executor with an explicit exact-origin allowlist, then attach it to the same Plug:

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
  host_execution: host_execution
```

When both `try_it_host_execution: true` and a real `PraugaFlexDoc.HostExecution` are configured, the Plug owns `POST /docs/__flexdoc/execute` and the renderer advertises `hostExecution.available: true`. Enabling the option without an executor keeps `available: false` and the execute path returns `404`.

The Elixir host consumes the existing FlexDoc JSON or canonical multipart execute envelope. It requires `X-FlexDoc-Execute: 1`, accepts only explicitly allowlisted HTTP(S) origins, strips unsafe transport headers, revalidates same-origin redirects, bounds incoming envelopes to 32 MiB and returned response bodies to 10 MiB, and applies a full-request deadline. Basic, Bearer, OAuth2 bearer-token, and header/query API-key auth are supported as canonical request-draft features.

This first Elixir slice intentionally advertises an empty host-only capability list. Session cookie jars, client certificates, Digest, Hawk, NTLM/Negotiate, OAuth 1.0, and AWS Signature V4 remain unavailable until they are implemented natively.

The OTP HTTP transport rejects link-local/cloud-metadata hosts and performs a DNS preflight before sending the request. Unlike the Go and ASP.NET Core transports, OTP `:httpc` does not expose a connection-time dial hook here, so the Elixir slice does **not** claim DNS pinning between preflight and connection.

## Phoenix

Phoenix routers can forward directly to the same Plug:

```elixir
forward "/docs", PraugaFlexDoc.Plug,
  path: "/docs",
  spec_url: "/openapi.json",
  title: "My API"
```

Because Phoenix is Plug-based, no Phoenix-specific renderer implementation is necessary. The same `try_it_host_execution` / `host_execution` options apply when using `forward`.

CI exercises the package through `Plug.Test` and byte-compares its packaged JS/CSS with the canonical renderer.
