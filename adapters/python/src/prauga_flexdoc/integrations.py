from __future__ import annotations

from .asgi import FlexDocASGI, FlexDocConfig


def setup_fastapi_flexdoc(
    app,
    path: str = "/docs",
    *,
    title: str = "API Reference",
    theme: str = "system",
    try_it_enabled: bool = True,
) -> FlexDocASGI:
    """Mount FlexDoc on a FastAPI-compatible application using its generated OpenAPI endpoint.

    FastAPI is intentionally not a hard dependency. The application only needs `mount()` and
    `openapi_url`, which keeps the core ASGI adapter dependency-free.
    """
    spec_url = getattr(app, "openapi_url", None)
    if not spec_url:
        raise ValueError("FastAPI OpenAPI generation is disabled; set openapi_url or mount FlexDoc with an explicit spec_url")

    normalized_path = "/" + path.strip("/")
    for builtin_name, builtin_path in (("Swagger UI", getattr(app, "docs_url", None)), ("ReDoc", getattr(app, "redoc_url", None))):
        if builtin_path and normalized_path == "/" + str(builtin_path).strip("/"):
            raise ValueError(
                f"FlexDoc path {normalized_path} conflicts with FastAPI's built-in {builtin_name} route. "
                f"Disable it when creating FastAPI (for example docs_url=None) or choose a different FlexDoc path."
            )

    docs = FlexDocASGI(FlexDocConfig(
        path=normalized_path,
        spec_url=spec_url,
        title=title,
        theme=theme,
        try_it_enabled=try_it_enabled,
    ))
    app.mount(normalized_path, docs)
    return docs
