# Prauga FlexDoc Python adapter

`prauga-flexdoc` is a self-contained, dependency-free ASGI app for mounting in FastAPI, Starlette, Django ASGI, Quart, or another ASGI host.

## FastAPI

FastAPI already generates OpenAPI from route decorators, type hints, Pydantic models, response metadata, and security dependencies. Mount FlexDoc against that generated document with one helper:

```python
from fastapi import FastAPI
from prauga_flexdoc import setup_fastapi_flexdoc

app = FastAPI(docs_url=None, redoc_url=None)
setup_fastapi_flexdoc(app, "/docs", title="My API")
```

FastAPI uses `/docs` for its built-in Swagger UI by default. If FlexDoc is mounted at `/docs`, disable the built-in route with `docs_url=None` as above (and usually `redoc_url=None` if ReDoc is not needed). The helper rejects a conflicting mount with a clear error instead of silently creating an unreachable FlexDoc route. You can alternatively mount FlexDoc at a different path such as `/reference` and leave FastAPI's built-in docs enabled.

The helper uses FastAPI's configured `openapi_url`, so custom OpenAPI paths continue to work and FastAPI remains an optional dependency.

## Generic ASGI

```python
from prauga_flexdoc import FlexDocASGI, FlexDocConfig

app.mount("/docs", FlexDocASGI(
    FlexDocConfig(path="/docs", spec_url="/openapi.json", title="My API")
))
```

The wheel packages the version-matched canonical renderer JS/CSS. Pass `assets_dir=` only when intentionally overriding those bundled assets.
