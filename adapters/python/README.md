# Prauga FlexDoc Python adapter

`prauga-flexdoc` is a self-contained, dependency-free ASGI app for mounting in FastAPI, Starlette, Django ASGI, Quart, or another ASGI host.

```python
from prauga_flexdoc import FlexDocASGI, FlexDocConfig

app.mount("/docs", FlexDocASGI(
    FlexDocConfig(path="/docs", spec_url="/openapi.json", title="My API")
))
```

The wheel packages the version-matched canonical renderer JS/CSS. Pass `assets_dir=` only when intentionally overriding those bundled assets.
