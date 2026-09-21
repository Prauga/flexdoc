# Prauga FlexDoc Python adapter

`prauga-flexdoc` `0.8.0` packages one framework-neutral Python host plus ASGI and WSGI transports. The wheel is self-contained, includes the canonical renderer assets, and keeps FastAPI, Flask, and Django optional.

## FastAPI / ASGI

```python
from fastapi import FastAPI
from prauga_flexdoc import setup_fastapi_flexdoc

app = FastAPI(docs_url=None, redoc_url=None)
setup_fastapi_flexdoc(app, '/docs', title='My API')
```

FastAPI can opt into FlexDoc 3.0 Runtime Intelligence:

```python
setup_fastapi_flexdoc(
    app,
    '/docs',
    title='My API',
    runtime_intelligence=True,
)
```

When enabled, the helper inspects the live FastAPI/Starlette route tree and serves a no-store snapshot from `/docs/__flexdoc/runtime`. It compares runtime route presence with `app.openapi()`, reports Python/FastAPI runtime metadata and request-derived server origin, normalizes Starlette path converters, and marks opaque mounts partial rather than inventing routes. Flask and Django opt in by supplying the specification they serve, since neither framework generates one:

```python
setup_flask_flexdoc(app, "/docs", runtime_intelligence_spec=SPEC)

urlpatterns = [*django_urlpatterns(path="/docs", runtime_intelligence_spec=SPEC)]
```

Flask route presence is fully knowable: Werkzeug's URL map records the methods each rule accepts, and the automatic `OPTIONS`/`HEAD` rules are excluded so they do not read as drift.

Django is knowable only where a view declares its methods. Class-based views expose `http_method_names` and their implemented handlers, and DRF viewsets expose an action map. A plain function view accepts any method and decides internally, and a `re_path` has no readable route template; both are reported through `discoveryComplete: false` rather than guessed, because an invented method produces drift findings that are simply wrong. A generic WSGI host can pass its own `runtime_provider` to `FlexDocWSGI`.

Runtime snapshots may reveal endpoints intentionally omitted from OpenAPI. The Python adapter currently relies on application middleware or upstream access control rather than a FlexDoc-native docs-auth option, so protect the FlexDoc docs subtree before enabling Runtime Intelligence on non-private documentation.

### Native API-host execution (3.3)

FastAPI can also opt into the existing FlexDoc host-execution protocol:

```python
setup_fastapi_flexdoc(
    app,
    '/docs',
    title='My API',
    try_it_host_execution=True,
    try_it_host_execution_allowed_origins=[
        'https://api.example.internal',
    ],
)
```

When enabled, the ASGI transport owns `POST /docs/__flexdoc/execute` and the renderer advertises `hostExecution.available: true`. The allowlist is server-side and accepts exact HTTP(S) origins only; paths, queries, credentials, and wildcards are rejected. The execute route requires `X-FlexDoc-Execute: 1`, strips unsafe browser-controlled transport headers, revalidates same-origin redirects, blocks link-local/cloud-metadata targets and dangerous DNS answers, bounds request/response sizes, and consumes the same JSON/multipart envelope used by the Node host and FlexDoc Runner.

This first Python slice intentionally advertises an empty host-only capability list. Basic, Bearer, OAuth2 bearer-token, and header/query API-key request auth are supported because they are part of the canonical request draft; session cookie jars, client certificates, Digest, Hawk, NTLM/Negotiate, OAuth 1.0, and AWS Signature V4 remain unavailable until implemented natively.

For every outbound request and redirect hop, the Python standard-library transport resolves the original hostname, rejects link-local/cloud-metadata answers, and then connects only to that validated address set. The request still retains the original hostname for the HTTP `Host` header and, for HTTPS, TLS SNI and certificate verification. The executor uses `http.client` directly and does not route through environment/system HTTP proxies. DNS lookup itself uses the platform's synchronous resolver; the execution deadline is checked immediately after resolution and applies to connection, response headers, and the complete response body, but Python cannot forcibly interrupt a resolver call that is already blocked inside the operating system. Keep exact-origin allowlists narrow and use network egress policy as an additional defense in depth where appropriate.

Flask, Django, and generic WSGI hosts serve the same execute route from 0.8.0. The executor is framework-neutral and synchronous, so a WSGI worker runs it directly rather than dispatching to a thread; see the sections below for the per-framework opt-in and the CSRF requirements that come with it.

For a generic ASGI host that owns its execution policy explicitly:

```python
from prauga_flexdoc import FlexDocASGI, FlexDocConfig, FlexDocHostExecution

executor = FlexDocHostExecution(['https://api.example.internal'])
docs = FlexDocASGI(
    FlexDocConfig(
        path='/docs',
        spec_url='/openapi.json',
        title='My API',
        try_it_host_execution=True,
    ),
    host_execution=executor,
)
app.mount('/docs', docs)
```

For a generic ASGI host without native execution:

```python
from prauga_flexdoc import FlexDocASGI, FlexDocConfig

app.mount('/docs', FlexDocASGI(
    FlexDocConfig(path='/docs', spec_url='/openapi.json', title='My API')
))
```

`FlexDocConfig` and the FastAPI/Flask/Django helpers also accept `expand`, `try_it_default_server`, `try_it_credentials`, and `try_it_api_client_persistence_key`; the persistence key may be a string or `False`, and unset values are omitted from renderer options.

## Flask / WSGI

```python
from flask import Flask
from prauga_flexdoc import setup_flask_flexdoc

app = Flask(__name__)
setup_flask_flexdoc(app, '/docs', spec_url='/openapi.json', title='My API')
```

For another WSGI server or framework, use `FlexDocWSGI(FlexDocConfig(...))` directly.

### Native API-host execution (0.8.0)

```python
setup_flask_flexdoc(
    app,
    '/docs',
    spec_url='/openapi.json',
    try_it_host_execution=True,
    try_it_host_execution_allowed_origins=[
        'https://api.example.internal',
    ],
)
```

This registers `POST /docs/__flexdoc/execute` and advertises `hostExecution.available: true`. The same server-side allowlist, header stripping, redirect revalidation, address validation, and size/deadline bounds apply as on ASGI, because both transports call the same executor.

Flask has no built-in CSRF protection. If the application authenticates with cookies, apply its CSRF model to this route and mount the docs subtree behind the same authentication boundary as other privileged developer surfaces — the `X-FlexDoc-Execute: 1` marker is protocol friction, not authentication and not a CSRF token. When Flask-WTF's `CSRFProtect` is active, send the token in the configured header rather than as a form field: reading a form token consumes a `multipart/form-data` envelope before the execute view can parse it.

For a generic WSGI host that owns its execution policy explicitly:

```python
from prauga_flexdoc import FlexDocConfig, FlexDocHostExecution, FlexDocWSGI

docs = FlexDocWSGI(
    FlexDocConfig(path='/docs', spec_url='/openapi.json', try_it_host_execution=True),
    host_execution=FlexDocHostExecution(['https://api.example.internal']),
)
```

The WSGI transport reads at most `Content-Length` bytes, because a WSGI server is only obliged to provide readable input up to that point and an unbounded read can block. A request with no `Content-Length` is answered `411 Length Required` unless the server reports a terminated chunked stream via `wsgi.input_terminated`, and the shared 32 MiB execute ceiling applies to both paths.

## Django

```python
from django.urls import path
from prauga_flexdoc import django_urlpatterns

urlpatterns = [
    # your API/OpenAPI routes
    *django_urlpatterns('/docs', spec_url='/openapi.json', title='My API'),
]
```

Django ASGI applications can also mount/use `FlexDocASGI`; Django WSGI applications can use `FlexDocWSGI`. `django_urlpatterns()` is the first-class native URL-routing helper.

### Native API-host execution (0.8.0)

```python
urlpatterns = [
    *django_urlpatterns(
        '/docs',
        spec_url='/openapi.json',
        try_it_host_execution=True,
        try_it_host_execution_allowed_origins=['https://api.example.internal'],
    ),
]
```

The execute view is **CSRF-enforced by default**: it is an ordinary POST view, so `CsrfViewMiddleware` protects it and a request without a valid token is rejected with 403 before the view runs. Send the token in the CSRF header (`X-CSRFToken` unless `CSRF_HEADER_NAME` is customized) rather than as a form field, because the middleware's form fallback consumes a multipart body before the view can read it.

A deployment whose authentication is not cookie-based can opt out explicitly:

```python
django_urlpatterns(
    '/docs',
    try_it_host_execution=True,
    try_it_host_execution_allowed_origins=['https://api.example.internal'],
    try_it_host_execution_csrf_exempt=True,
)
```

There is no implicit exemption and no way to reach one by accident: the argument must be passed, it is rejected unless host execution is also enabled, and omitting it leaves Django's normal protection in place. Choose it only when a CSRF token is genuinely inapplicable — for example bearer-token or mTLS authentication — never as a way to make a cookie-authenticated deployment stop returning 403.

## Execution evidence

A host executor that reports nothing leaves an operator guessing whether a failing Try It is a policy rejection, a slow upstream or traffic that never carried an execute marker. `FlexDocHostExecution` accepts a metric sink and emits the same metric names, labels and reason vocabulary as the Node host, so one collector reads a mixed fleet:

```python
from prauga_flexdoc import (
    FlexDocHostExecution,
    FlexDocHostExecutionObservation,
    create_host_execution_observation_report,
)

observation = FlexDocHostExecutionObservation()
executor = FlexDocHostExecution(
    ['https://api.example.internal'],
    metric_sink=observation.record,
)

# Whenever an operator asks for evidence:
report = create_host_execution_observation_report(observation)
```

The sink receives `FlexDocHostExecutionMetric` values carrying a name, kind, value and labels, and nothing else: no URL, header, body or credential reaches it. Bridge it to Prometheus or OpenTelemetry where such a stack exists; where none does, `FlexDocHostExecutionObservation` folds the same updates into an in-process aggregate and `create_host_execution_observation_report` turns it into the shared `flexdoc.host-execution.observation/1` document that the Node exporter also produces.

Every non-successful execution carries one of the stable categories in `HOST_EXECUTION_REASONS`, which is why rejections and upstream failures are separable at all — the human-readable messages interpolate origins and field names, so they are unbounded and unusable as a metric label. Requests arriving without `X-FlexDoc-Execute` are counted by `flexdoc_execute_unmarked_total` and deliberately move no lifecycle metric, since they produced no validated envelope.

The report declares `browser-direct-transport-mix` in its `gaps`: a browser-direct execution never reaches this process, so the transport mix cannot be derived here. `@prauga/flexdoc-client` keeps the matching browser-side aggregate. See [host-execution observability](../../docs/host-execution-observability.md) for the full metric contract and both halves of the review. Metric delivery is best effort: a sink that raises cannot fail the execution.

## Architecture

`FlexDocHost` synchronously owns route matching, the HTML bootstrap, renderer fingerprinting, cache policy, and packaged JS/CSS. `FlexDocASGI` translates that neutral response to ASGI and can expose a framework-supplied live runtime snapshot or a real native execute route when one is explicitly attached. `FlexDocWSGI` translates that same response and, when they are explicitly attached, owns the native execute route and a framework-supplied live runtime snapshot. Framework helpers do not fork renderer behavior.

Pass `assets_dir=` to `FlexDocHost`, `FlexDocASGI`, or `FlexDocWSGI` only when intentionally overriding the bundled renderer assets during development.
