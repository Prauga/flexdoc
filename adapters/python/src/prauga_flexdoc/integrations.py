from __future__ import annotations

import re
from typing import Literal

from .asgi import FlexDocASGI
from .host import FlexDocConfig, FlexDocHost, FlexDocResponse
from .host_execution import FlexDocHostExecution
from .runtime_intelligence import build_fastapi_runtime_snapshot


def _normalized_path(path: str) -> str:
    return "/" + path.strip("/")


def _config_options(
    *,
    expand: str | list[str] | None,
    try_it_default_server: str | None,
    try_it_credentials: Literal["omit", "same-origin", "include"] | None,
    try_it_api_client_persistence_key: str | Literal[False] | None,
) -> dict:
    return {
        "expand": expand,
        "try_it_default_server": try_it_default_server,
        "try_it_credentials": try_it_credentials,
        "try_it_api_client_persistence_key": try_it_api_client_persistence_key,
    }


def setup_fastapi_flexdoc(
    app,
    path: str = "/docs",
    *,
    title: str = "API Reference",
    theme: str = "system",
    try_it_enabled: bool = True,
    expand: str | list[str] | None = None,
    try_it_default_server: str | None = None,
    try_it_credentials: Literal["omit", "same-origin", "include"] | None = None,
    try_it_api_client_persistence_key: str | Literal[False] | None = None,
    runtime_intelligence: bool = False,
    try_it_host_execution: bool = False,
    try_it_host_execution_allowed_origins: list[str] | tuple[str, ...] | None = None,
) -> FlexDocASGI:
    """Mount FlexDoc on FastAPI using the application's generated OpenAPI endpoint.

    Args:
        app: FastAPI application with OpenAPI generation enabled.
        path: Docs mount path. Must not conflict with built-in Swagger UI or ReDoc routes.
        title: Page and renderer title.
        theme: Renderer theme preset.
        try_it_enabled: Whether the Try It client is enabled.
        expand: Optional expansion preset or section list.
        try_it_default_server: Optional default server URL for Try It requests.
        try_it_credentials: Optional fetch credentials mode for Try It requests.
        try_it_api_client_persistence_key: Optional persistence key, or ``False``.
        runtime_intelligence: When ``True``, expose a live runtime snapshot endpoint.
        try_it_host_execution: When ``True``, mount the native API-host execution route.
        try_it_host_execution_allowed_origins: Required exact HTTP(S) origins for native
            execution. Wildcards and paths are not accepted.

    Returns:
        The mounted :class:`~prauga_flexdoc.asgi.FlexDocASGI` application.
    """
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

    runtime_provider = None
    runtime_framework = None
    if runtime_intelligence:
        runtime_provider = lambda scope: build_fastapi_runtime_snapshot(app, scope, normalized_path)
        runtime_framework = "fastapi"

    host_execution = None
    if try_it_host_execution:
        if not try_it_host_execution_allowed_origins:
            raise ValueError("FastAPI host execution requires try_it_host_execution_allowed_origins with at least one exact origin.")
        host_execution = FlexDocHostExecution(try_it_host_execution_allowed_origins)

    docs = FlexDocASGI(
        FlexDocConfig(
            path=normalized_path,
            spec_url=spec_url,
            title=title,
            theme=theme,
            try_it_enabled=try_it_enabled,
            try_it_host_execution=try_it_host_execution,
            **_config_options(
                expand=expand,
                try_it_default_server=try_it_default_server,
                try_it_credentials=try_it_credentials,
                try_it_api_client_persistence_key=try_it_api_client_persistence_key,
            ),
        ),
        runtime_provider=runtime_provider,
        runtime_framework=runtime_framework,
        host_execution=host_execution,
    )
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
    expand: str | list[str] | None = None,
    try_it_default_server: str | None = None,
    try_it_credentials: Literal["omit", "same-origin", "include"] | None = None,
    try_it_api_client_persistence_key: str | Literal[False] | None = None,
) -> FlexDocHost:
    """Register FlexDoc routes on a Flask application without making Flask a hard dependency.

    Args:
        app: Flask application used to register URL rules.
        path: Docs mount path.
        spec_url: OpenAPI document URL resolved by the browser bootstrap page.
        title: Page and renderer title.
        theme: Renderer theme preset.
        try_it_enabled: Whether the Try It client is enabled.
        expand: Optional expansion preset or section list.
        try_it_default_server: Optional default server URL for Try It requests.
        try_it_credentials: Optional fetch credentials mode for Try It requests.
        try_it_api_client_persistence_key: Optional persistence key, or ``False``.

    Returns:
        The :class:`~prauga_flexdoc.host.FlexDocHost` backing the registered routes.
    """
    host = FlexDocHost(FlexDocConfig(
        path=path,
        spec_url=spec_url,
        title=title,
        theme=theme,
        try_it_enabled=try_it_enabled,
        **_config_options(
            expand=expand,
            try_it_default_server=try_it_default_server,
            try_it_credentials=try_it_credentials,
            try_it_api_client_persistence_key=try_it_api_client_persistence_key,
        ),
    ))
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
    expand: str | list[str] | None = None,
    try_it_default_server: str | None = None,
    try_it_credentials: Literal["omit", "same-origin", "include"] | None = None,
    try_it_api_client_persistence_key: str | Literal[False] | None = None,
):
    """Return Django URL patterns for FlexDoc. Django is imported lazily and remains optional.

    Args:
        path: Docs mount path.
        spec_url: OpenAPI document URL resolved by the browser bootstrap page.
        title: Page and renderer title.
        theme: Renderer theme preset.
        try_it_enabled: Whether the Try It client is enabled.
        expand: Optional expansion preset or section list.
        try_it_default_server: Optional default server URL for Try It requests.
        try_it_credentials: Optional fetch credentials mode for Try It requests.
        try_it_api_client_persistence_key: Optional persistence key, or ``False``.

    Returns:
        A list of Django ``re_path`` patterns for the docs shell and renderer assets.
    """
    try:
        from django.http import HttpResponse
        from django.urls import re_path
    except ImportError as error:
        raise RuntimeError("Django is required to use django_urlpatterns(); install prauga-flexdoc[django]") from error

    host = FlexDocHost(FlexDocConfig(
        path=path,
        spec_url=spec_url,
        title=title,
        theme=theme,
        try_it_enabled=try_it_enabled,
        **_config_options(
            expand=expand,
            try_it_default_server=try_it_default_server,
            try_it_credentials=try_it_credentials,
            try_it_api_client_persistence_key=try_it_api_client_persistence_key,
        ),
    ))
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