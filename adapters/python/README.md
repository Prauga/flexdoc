# FlexDoc Python adapter

A dependency-free ASGI app for mounting in FastAPI, Starlette, Django ASGI, Quart, or another ASGI host.

```python
from flexdoc_adapter import FlexDocASGI, FlexDocConfig

app.mount("/docs", FlexDocASGI(
    FlexDocConfig(path="/docs", spec_url="/openapi.json", title="My API"),
    assets_dir="./flexdoc-renderer",
))
```

The asset directory must contain the matching canonical `flexdoc.standalone.js` and `flexdoc.standalone.css` renderer bundle.
