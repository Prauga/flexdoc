# Prauga FlexDoc for Ruby

`prauga-flexdoc` `0.4.4` provides one framework-neutral Ruby 3.2+ host for the canonical FlexDoc renderer, plus thin Rack and Rails integrations.

## Rack

```ruby
require "prauga/flexdoc"

host = Prauga::FlexDoc::Host.new(
  Prauga::FlexDoc::Config.new(
    path: "/docs",
    spec_url: "/openapi.json",
    title: "My API"
  )
)

run Prauga::FlexDoc::RackApp.new(host)
```

`Prauga::FlexDoc::Config` also accepts `expand`, `try_it_default_server`, `try_it_credentials`, and `try_it_api_client_persistence_key`; `expand` may be a preset string or section array, and persistence may be a string or `false`.

The Rack app reconstructs `SCRIPT_NAME + PATH_INFO`, so it also works correctly when mounted beneath another Rack application.

## Native host execution (3.3)

Ruby can execute Try It requests inside the API host using the same FlexDoc execute envelope used by Node, the Runner, and the other native adapters. Execution is opt-in and requires both `try_it_host_execution: true` and a real executor with a non-empty exact-origin allowlist:

```ruby
executor = Prauga::FlexDoc::HostExecution.new(
  allowed_origins: ["https://api.internal.example"]
)

host = Prauga::FlexDoc::Host.new(
  Prauga::FlexDoc::Config.new(
    path: "/docs",
    spec_url: "/openapi.json",
    try_it_host_execution: true
  ),
  host_execution: executor
)

run Prauga::FlexDoc::RackApp.new(host)
```

The Rack transport then owns `POST /docs/__flexdoc/execute`. Without a real executor, FlexDoc advertises `available: false` and the execute path remains a 404.

This first native slice supports the canonical JSON and multipart envelopes, Basic/Bearer/OAuth2-bearer and header/query API-key request auth, raw/JSON/binary/urlencoded/GraphQL/form-data bodies, same-origin redirect revalidation, unsafe-header stripping, a 32 MiB inbound envelope bound, a 10 MiB response bound, and a full-response deadline. Host-only cookies, client certificates, Digest/Hawk/NTLM/Kerberos, OAuth 1.0, AWS SigV4, host secrets, and runtime-derived environment are not advertised yet.

The Ruby executor blocks link-local/cloud-metadata targets and validates DNS results before connecting. It then pins `Net::HTTP` to one of the validated addresses with `ipaddr=` while retaining the original hostname for the HTTP `Host` header and TLS SNI/certificate verification. Environment proxy routing is disabled for native execution, so the validated destination cannot be bypassed through `http_proxy`/`HTTP_PROXY`. Private-network relaxation is not part of this slice.

## Rails

In `config/routes.rb`:

```ruby
host = Prauga::FlexDoc::Host.new(
  Prauga::FlexDoc::Config.new(
    path: "/docs",
    spec_url: "/openapi.json",
    title: "My API"
  )
)
Prauga::FlexDoc::Rails.mount(self, host: host, at: "/docs")
```

Rails already uses Rack, so the Rails helper intentionally mounts the same `RackApp` rather than introducing a Rails-specific renderer host. If `at:` is supplied, it must resolve to the same normalized path as `host.config.path`; the helper raises immediately on a mismatch so the HTML shell cannot point at renderer asset URLs that the mounted Rack app will reject. Native execution uses that same mounted Rack app, so Rails does not need a separate executor implementation.

## Packaging

The gem packages the exact canonical `flexdoc.standalone.js` and `.css`. CI tests the neutral host, Rack mounting, Rails routing, native host execution, gem contents, and byte-for-byte renderer parity.
