# Prauga FlexDoc for Ruby

`prauga-flexdoc` `0.4.5` provides one framework-neutral Ruby 3.2+ host for the canonical FlexDoc renderer, plus thin Rack and Rails integrations.

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

# Configure application authentication/authorization middleware around the
# FlexDoc subtree first, then acknowledge that boundary explicitly.
run Prauga::FlexDoc::RackApp.new(host, host_execution_protected: true)
```

The Rack transport then owns `POST /docs/__flexdoc/execute`. Without a real executor, FlexDoc advertises `available: false` and the execute path remains a 404.

**Fail-closed rule:** when host execution is available, `RackApp.new` raises `ArgumentError` unless `host_execution_protected: true` is supplied. The flag does not authenticate requests; it is an explicit assertion that the surrounding Rack/Rails stack already protects the documentation and execute surface. The outbound origin allowlist is not user authentication.

This first native slice supports the canonical JSON and multipart envelopes, Basic/Bearer/OAuth2-bearer and header/query API-key request auth, raw/JSON/binary/urlencoded/GraphQL/form-data bodies, same-origin redirect revalidation, unsafe-header stripping, a 32 MiB inbound envelope bound, a 10 MiB response bound, and a full-response deadline. Host-only cookies, client certificates, Digest/Hawk/NTLM/Kerberos, OAuth 1.0, AWS SigV4, host secrets, and runtime-derived environment are not advertised yet.

The Ruby executor blocks link-local/cloud-metadata targets and validates DNS results before connecting. It then pins `Net::HTTP` to one of the validated addresses with `ipaddr=` while retaining the original hostname for the HTTP `Host` header and TLS SNI/certificate verification. Environment proxy routing is disabled for native execution, so the validated destination cannot be bypassed through `http_proxy`/`HTTP_PROXY`. Private-network relaxation is not part of this slice.

### Execution evidence

An executor that reports nothing leaves an operator guessing whether a failing Try It is a policy rejection, a slow upstream or traffic that never carried an execute marker. Pass a metric sink to emit the same metric names, labels and reason vocabulary as the Node, Python, Go and Rust hosts, so one collector reads a mixed fleet:

```ruby
observation = Prauga::FlexDoc::HostExecutionObservation.new

executor = Prauga::FlexDoc::HostExecution.new(
  allowed_origins: ["https://api.example.internal"],
  metric_sink: observation.sink
)

# Whenever an operator asks for evidence:
report = Prauga::FlexDoc.host_execution_observation_report(observation)
```

The sink receives `HostExecutionMetric` values carrying a name, kind, value and labels, and nothing else: no URL, header, body or credential reaches it. Bridge it to Prometheus or OpenTelemetry where such a stack exists; where none does, `HostExecutionObservation` folds the same updates into a mutex-guarded aggregate safe to share across threaded or forked-with-threads servers, and `host_execution_observation_report` produces the shared `flexdoc.host-execution.observation/1` document every other runtime also emits. Under a forking server each worker keeps its own window, so treat the export as per-process evidence.

Every non-successful execution carries one of the stable categories in `HostExecutionObservability::HOST_EXECUTION_REASONS`, which is why rejections and upstream failures are separable at all — the human-readable messages interpolate origins and field names, so they are unbounded and unusable as a metric label. Requests arriving without `X-FlexDoc-Execute` are counted by `flexdoc_execute_unmarked_total` and deliberately move no lifecycle metric, since they produced no validated envelope.

The report declares `browser-direct-transport-mix` in its gaps: a browser-direct execution never reaches this process, so the transport mix cannot be derived here. See [host-execution observability](../../docs/host-execution-observability.md) for the full metric contract and the browser half of a review. Metric delivery is best effort: a sink that raises cannot fail an execution.

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

When the host has native execution available, protect the `/docs` mount with the application's authentication/authorization stack and pass `host_execution_protected: true` to `Prauga::FlexDoc::Rails.mount(...)`. The Rails helper forwards that acknowledgement into `RackApp`; omitting it keeps native execution fail closed.

## Packaging

The gem packages the exact canonical `flexdoc.standalone.js` and `.css`. CI tests the neutral host, Rack mounting, Rails routing, native host execution, gem contents, and byte-for-byte renderer parity.
