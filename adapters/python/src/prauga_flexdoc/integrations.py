from __future__ import annotations

import re

from .asgi import FlexDocASGI
from .host import FlexDocConfig, FlexDocHost, FlexDocResponse


def _normalized_path(path: str) -> str:
    return "/" + path.strip("/")


def setup_fastapi_flexdoc(
    app,
    path: str = "/docs",
    *,
    title: str = "API Reference",
    theme: str = "system",
    try_it_enabled: bool = True,
) -> FlexDocASGI:
    """Mount FlexDoc on FastAPI using the application's generated OpenAPI endpoint."""
    spec_url = getattr(app, "openapi_url", None)
    if not spec_url:
        raise ValueError("FastAPI OpenAPI generation is disabled; set openapi_url or mount FlexDoc with an explicit spec_url")

    normalized_path = _normalized_path(path)
    for builtin_name, builtin_path in (("Swagger UI", getattr(app, "docs_url", None)), ("ReDoc", getattr(app, "redoc_url", None))):
        if builtin_path and normalized_path == _normalized_path(str(builtin_path)):
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


def setup_flask_flexdoc(
    app,
    path: str = "/docs",
    *,
    spec_url: str = "/openapi.json",
    title: str = "API Reference",
    theme: str = "system",
    try_it_enabled: bool = True,
) -> FlexDocHost:
    """Register FlexDoc routes on a Flask application without making Flask a hard dependency."""
    host = FlexDocHost(FlexDocConfig(path, spec_url, title, theme, try_it_enabled))
    normalized = host.path
    endpoint_prefix = "flexdoc_" + re.sub(r"[^a-zA-Z0-9_]", "_", normalized).strip("_")

    def to_flask(response: FlexDocResponse):
        result = app.response_class(response.body, status=response.status, content_type=response.content_type)
        if response.cache_control:
            result.headers["Cache-Control"] = response.cache_control
        return result

    app.add_url_rule(normalized, endpoint=f"{endpoint_prefix}_index", view_func=lambda: to_flask(host.route(normalized)), strict_slashes=False)
    app.add_url_rule(normalized + "/__flexdoc/renderer.js", endpoint=f"{endpoint_prefix}_js", view_func=lambda: to_flask(host.route(normalized + "/__flexdoc/renderer.js")))
    app.add_url_rule(normalized + "/__flexdoc/renderer.css", endpoint=f"{endpoint_prefix}_css", view_func=lambda: to_flask(host.route(normalized + "/__flexdoc/renderer.css")))
    return host


def django_urlpatterns(
    path: str = "/docs",
    *,
    spec_url: str = "/openapi.json",
    title: str = "API Reference",
    theme: str = "system",
    try_it_enabled: bool = True,
):
    """Return Django URL patterns for FlexDoc. Django is imported lazily and remains optional."""
    try:
        from django.http import HttpResponse
        from django.urls import re_path
    except ImportError as error:
        raise RuntimeError("Django is required to use django_urlpatterns(); install prauga-flexdoc[django]") from error

    host = FlexDocHost(FlexDocConfig(path, spec_url, title, theme, try_it_enabled))
    route = host.path.strip("/")

    def to_django(request, request_path: str):
        response = host.route(request_path)
        result = HttpResponse(response.body, status=response.status, content_type=response.content_type)
        if response.cache_control:
            result["Cache-Control"] = response.cache_control
        return result

    return [
        re_path(rf"^{re.escape(route)}/?$", lambda request: to_django(request, host.path), name="flexdoc-index"),
        re_path(rf"^{re.escape(route)}/__flexdoc/renderer\.js$", lambda request: to_django(request, host.path + "/__flexdoc/renderer.js"), name="flexdoc-js"),
        re_path(rf"^{re.escape(route)}/__flexdoc/renderer\.css$", lambda request: to_django(request, host.path + "/__flexdoc/renderer.css"), name="flexdoc-css"),
    ]
