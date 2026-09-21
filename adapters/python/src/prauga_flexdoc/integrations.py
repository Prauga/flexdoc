from __future__ import annotations

import re
from collections.abc import Callable
from typing import Literal

import json

from .asgi import FlexDocASGI
from .host import FlexDocConfig, FlexDocHost, FlexDocResponse
from .host_execution import FlexDocHostExecution
from .host_execution_envelope import parse_execute_envelope, validate_declared_length
from .runtime_intelligence import build_django_runtime_snapshot, build_fastapi_runtime_snapshot, build_flask_runtime_snapshot
from .wsgi import LengthRequired, read_bounded_wsgi_body


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
    try_it_host_execution_metric_sink: Callable[[object], None] | None = None,
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
        try_it_host_execution_metric_sink: Optional operator metric sink receiving the same
            metric names, labels and reason categories the Node backend emits.

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
        host_execution = FlexDocHostExecution(
            try_it_host_execution_allowed_origins,
            metric_sink=try_it_host_execution_metric_sink,
        )

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
    runtime_intelligence_spec: dict | Callable[[], dict] | None = None,
    try_it_host_execution: bool = False,
    try_it_host_execution_allowed_origins: list[str] | tuple[str, ...] | None = None,
    try_it_host_execution_metric_sink: Callable[[object], None] | None = None,
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
        runtime_intelligence_spec: OpenAPI document (or callable returning one) to compare the
            live URL map against. Supplying it enables ``GET {path}/__flexdoc/runtime``. Flask
            does not generate a specification, so the application must provide the one it serves.
        try_it_host_execution: When ``True``, register the native API-host execution route.
        try_it_host_execution_allowed_origins: Required exact HTTP(S) origins for native
            execution. Wildcards and paths are not accepted.
        try_it_host_execution_metric_sink: Optional operator metric sink receiving the same
            metric names, labels and reason categories the Node backend emits.

    Returns:
        The :class:`~prauga_flexdoc.host.FlexDocHost` backing the registered routes.

    Note:
        Flask has no built-in CSRF protection. When the application uses cookie-based
        authentication, protect this route with the application's own CSRF model and mount it
        behind the same authentication boundary as other privileged developer surfaces.
    """
    host_execution = None
    if try_it_host_execution:
        if not try_it_host_execution_allowed_origins:
            raise ValueError("Flask host execution requires try_it_host_execution_allowed_origins with at least one exact origin.")
        host_execution = FlexDocHostExecution(
            try_it_host_execution_allowed_origins,
            metric_sink=try_it_host_execution_metric_sink,
        )

    host = FlexDocHost(FlexDocConfig(
        path=path,
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
        host_execution_available=host_execution is not None,
        host_execution_capabilities=host_execution.capabilities if host_execution is not None else (),
        runtime_intelligence_framework="flask" if runtime_intelligence_spec is not None else None,
    )
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

    if runtime_intelligence_spec is not None:
        def runtime_view():
            from flask import request

            snapshot = build_flask_runtime_snapshot(app, runtime_intelligence_spec, request.environ, normalized)
            return _to_flask_json(app, 200, snapshot)

        app.add_url_rule(
            normalized + "/__flexdoc/runtime",
            endpoint=f"{endpoint_prefix}_runtime",
            view_func=runtime_view,
            methods=["GET"],
        )

    if host_execution is not None:
        def execute_view():
            from flask import request

            marker = request.headers.get("X-FlexDoc-Execute")
            if marker != "1":
                result = host_execution.handle(marker, {})
                return _to_flask_json(app, result.status, result.body)
            try:
                chunks = read_bounded_wsgi_body(request.environ)
                envelope, files = parse_execute_envelope(request.content_type or "", chunks)
            except LengthRequired as error:
                return _to_flask_json(app, 411, {"error": str(error)})
            except ValueError as error:
                return _to_flask_json(app, 400, {"error": str(error)})
            result = host_execution.handle(marker, envelope, files)
            return _to_flask_json(app, result.status, result.body)

        app.add_url_rule(
            normalized + "/__flexdoc/execute",
            endpoint=f"{endpoint_prefix}_execute",
            view_func=execute_view,
            methods=["POST"],
        )

    return host


def _to_flask_json(app, status: int, payload: object):
    body = json.dumps(payload, separators=(",", ":")).encode()
    response = app.response_class(body, status=status, content_type="application/json; charset=utf-8")
    response.headers["Cache-Control"] = "no-store"
    return response


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
    try_it_host_execution: bool = False,
    try_it_host_execution_allowed_origins: list[str] | tuple[str, ...] | None = None,
    try_it_host_execution_metric_sink: Callable[[object], None] | None = None,
    try_it_host_execution_csrf_exempt: bool = False,
    runtime_intelligence_spec: dict | Callable[[], dict] | None = None,
    runtime_intelligence_urlconf: object | None = None,
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
        runtime_intelligence_spec: OpenAPI document (or callable returning one) to compare the
            live URLconf against. Supplying it enables ``GET {path}/__flexdoc/runtime``. Django
            does not generate a specification, so the application must provide the one it serves.
        runtime_intelligence_urlconf: URL patterns to walk instead of ``ROOT_URLCONF``.
        try_it_host_execution: When ``True``, add the native API-host execution route.
        try_it_host_execution_allowed_origins: Required exact HTTP(S) origins for native
            execution. Wildcards and paths are not accepted.
        try_it_host_execution_metric_sink: Optional operator metric sink receiving the same
            metric names, labels and reason categories the Node backend emits.
        try_it_host_execution_csrf_exempt: Opt out of Django's CSRF enforcement on the execute
            route. Defaults to ``False``, so ``CsrfViewMiddleware`` protects the route like any
            other POST view. Set this only for a deployment whose authentication is not
            cookie-based, because the ``X-FlexDoc-Execute`` marker is protocol friction and is
            neither authentication nor a CSRF token.

    Returns:
        A list of Django ``re_path`` patterns for the docs shell, renderer assets, and — when
        host execution is enabled — the execute route.
    """
    try:
        from django.http import HttpResponse, RawPostDataException
        from django.urls import re_path
        from django.views.decorators.csrf import csrf_exempt
    except ImportError as error:
        raise RuntimeError("Django is required to use django_urlpatterns(); install prauga-flexdoc[django]") from error

    host_execution = None
    if try_it_host_execution:
        if not try_it_host_execution_allowed_origins:
            raise ValueError("Django host execution requires try_it_host_execution_allowed_origins with at least one exact origin.")
        host_execution = FlexDocHostExecution(
            try_it_host_execution_allowed_origins,
            metric_sink=try_it_host_execution_metric_sink,
        )
    elif try_it_host_execution_csrf_exempt:
        raise ValueError("try_it_host_execution_csrf_exempt requires try_it_host_execution=True.")

    host = FlexDocHost(FlexDocConfig(
        path=path,
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
        host_execution_available=host_execution is not None,
        host_execution_capabilities=host_execution.capabilities if host_execution is not None else (),
        runtime_intelligence_framework="django" if runtime_intelligence_spec is not None else None,
    )
    route = host.path.strip("/")

    def to_django(request, request_path: str):
        response = host.route(request_path)
        result = HttpResponse(response.body, status=response.status, content_type=response.content_type)
        if response.cache_control:
            result["Cache-Control"] = response.cache_control
        return result

    def json_response(status: int, payload: object):
        result = HttpResponse(
            json.dumps(payload, separators=(",", ":")).encode(),
            status=status,
            content_type="application/json; charset=utf-8",
        )
        result["Cache-Control"] = "no-store"
        return result

    patterns = [
        re_path(rf"^{re.escape(route)}/?$", lambda request: to_django(request, host.path), name="flexdoc-index"),
        re_path(rf"^{re.escape(route)}/__flexdoc/renderer\.js$", lambda request: to_django(request, host.path + "/__flexdoc/renderer.js"), name="flexdoc-js"),
        re_path(rf"^{re.escape(route)}/__flexdoc/renderer\.css$", lambda request: to_django(request, host.path + "/__flexdoc/renderer.css"), name="flexdoc-css"),
    ]

    if runtime_intelligence_spec is not None:
        def runtime(request):
            if request.method != "GET":
                return json_response(405, {"error": "Method not allowed."})
            urlpatterns = runtime_intelligence_urlconf
            if urlpatterns is None:
                from django.urls import get_resolver

                urlpatterns = get_resolver().url_patterns
            snapshot = build_django_runtime_snapshot(urlpatterns, runtime_intelligence_spec, request.META, host.path)
            return json_response(200, snapshot)

        patterns.append(re_path(rf"^{re.escape(route)}/__flexdoc/runtime$", runtime, name="flexdoc-runtime"))

    if host_execution is None:
        return patterns

    def execute(request):
        if request.method != "POST":
            return json_response(405, {"error": "Method not allowed."})
        marker = request.headers.get("X-FlexDoc-Execute")
        if marker != "1":
            result = host_execution.handle(marker, {})
            return json_response(result.status, result.body)
        try:
            validate_declared_length(request.META.get("CONTENT_LENGTH"))
            envelope, files = parse_execute_envelope(request.META.get("CONTENT_TYPE", ""), [request.body])
        except RawPostDataException:
            # CsrfViewMiddleware falls back to reading the POST body for a form token, which
            # consumes a multipart execute envelope before the view can parse it. Send the CSRF
            # token in the header instead so the middleware never touches the body.
            return json_response(400, {"error": "Host execution body was already consumed; send the CSRF token as a header rather than a form field."})
        except ValueError as error:
            return json_response(400, {"error": str(error)})
        result = host_execution.handle(marker, envelope, files)
        return json_response(result.status, result.body)

    view = csrf_exempt(execute) if try_it_host_execution_csrf_exempt else execute
    patterns.append(re_path(rf"^{re.escape(route)}/__flexdoc/execute$", view, name="flexdoc-execute"))
    return patterns