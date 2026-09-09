# Prauga FlexDoc Python adapter

`prauga-flexdoc` `0.7.2` packages one framework-neutral Python host plus ASGI and WSGI transports. The wheel is self-contained, includes the canonical renderer assets, and keeps FastAPI, Flask, and Django optional.

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

When enabled, the helper inspects the live FastAPI/Starlette route tree and serves a no-store snapshot from `/docs/__flexdoc/runtime`. It compares runtime route presence with `app.openapi()`, reports Python/FastAPI runtime metadata and request-derived server origin, normalizes Starlette path converters, and marks opaque mounts partial rather than inventing routes. Runtime Intelligence is FastAPI-only in this adapter release; generic ASGI, Flask, Django, and WSGI hosts do not advertise it yet.

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

When enabled, the ASGI transport owns `POST /docs/__flexdoc/execute` and the renderer advertises `hostExecution.available: true`. The allowlist is server-side and accepts exact HTTP(S) origins only; paths, queries, credentials, and wildcards are rejected. The execute route requires `X-FlexDoc-Execute: 1`, strips unsafe browser-controlled transport headers, revalidates same-origin redirects, blocks link-local/cloud-metadata targets and link-local DNS answers, bounds request/response sizes, and consumes the same JSON/multipart envelope used by the Node host and FlexDoc Runner.

This first Python slice intentionally advertises an empty host-only capability list. Basic, Bearer, OAuth2 bearer-token, and header/query API-key request auth are supported because they are part of the canonical request draft; session cookie jars, client certificates, Digest, Hawk, NTLM/Negotiate, OAuth 1.0, and AWS Signature V4 remain unavailable until implemented natively.

The Python standard-library HTTP transport performs DNS safety preflight before connecting, but it does not pin that validated address through connection establishment. Deployments with attacker-controlled DNS should enforce equivalent egress policy at the network layer as well. Flask, Django URL-pattern, and generic WSGI helpers continue to advertise no native execute route in this slice.

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

## Architecture

`FlexDocHost` synchronously owns route matching, the HTML bootstrap, renderer fingerprinting, cache policy, and packaged JS/CSS. `FlexDocASGI` translates that neutral response to ASGI and can expose a framework-supplied live runtime snapshot or a real native execute route when one is explicitly attached. `FlexDocWSGI` only translates the neutral host response. Framework helpers do not fork renderer behavior.

Pass `assets_dir=` to `FlexDocHost`, `FlexDocASGI`, or `FlexDocWSGI` only when intentionally overriding the bundled renderer assets during development.
