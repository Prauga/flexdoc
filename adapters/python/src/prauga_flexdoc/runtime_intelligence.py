from __future__ import annotations

from importlib.metadata import PackageNotFoundError, version as package_version
import platform
import re
import sys

_HTTP_METHODS = {"GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD", "TRACE"}


def normalize_runtime_path(value: str) -> str:
    """Normalize a framework route path for Runtime Intelligence comparison.

    Args:
        value: Framework/OpenAPI path string, optionally containing converter syntax.

    Returns:
        Canonical leading-slash path with duplicate/trailing slashes removed and
        FastAPI-style ``{name:converter}`` parameters reduced to ``{name}``.
    """
    path = value.strip()
    if not path.startswith("/"):
        path = "/" + path
    path = re.sub(r"\{([A-Za-z0-9_]+):[^}]+\}", r"{\1}", path)
    path = re.sub(r"/{2,}", "/", path)
    if len(path) > 1 and path.endswith("/"):
        path = path[:-1]
    return path or "/"


def _route_key(route: dict[str, str]) -> str:
    return f'{route["method"]} {route["path"]}'


def _unique_sorted(routes: list[dict[str, str]]) -> list[dict[str, str]]:
    by_key = {_route_key(route): route for route in routes}
    return sorted(by_key.values(), key=lambda route: (route["path"], route["method"]))


def _without_implicit_head_routes(routes: list[dict[str, str]]) -> list[dict[str, str]]:
    keys = {_route_key(route) for route in routes}
    return [route for route in routes if route["method"] != "HEAD" or f'GET {route["path"]}' not in keys]


def _excluded(path: str, exclude_prefix: str | None, excluded_paths: set[str]) -> bool:
    if exclude_prefix:
        prefix = normalize_runtime_path(exclude_prefix)
        if path == prefix or path.startswith(prefix + "/"):
            return True
    return path in excluded_paths


def discover_fastapi_routes(app, exclude_prefix: str | None = None) -> dict:
    """Discover HTTP routes registered on a FastAPI/Starlette application.

    Args:
        app: FastAPI/Starlette application exposing a ``routes`` collection.
        exclude_prefix: Optional FlexDoc mount prefix to exclude from discovery.

    Returns:
        Discovery metadata containing framework/version, normalized route list,
        and a ``complete`` flag indicating whether every route shape was understood.
    """
    source = getattr(app, "routes", None)
    if not isinstance(source, (list, tuple)):
        return {"framework": "fastapi", **_framework_version(), "routes": [], "complete": False}

    excluded_paths = {
        normalize_runtime_path(value)
        for value in (
            getattr(app, "openapi_url", None),
            getattr(app, "docs_url", None),
            getattr(app, "redoc_url", None),
            getattr(app, "swagger_ui_oauth2_redirect_url", None),
        )
        if isinstance(value, str) and value
    }
    routes: list[dict[str, str]] = []
    complete = True

    def visit(items, prefix: str = "") -> None:
        nonlocal complete
        for route in items:
            raw_path = getattr(route, "path", None)
            if not isinstance(raw_path, str):
                complete = False
                continue
            full_path = normalize_runtime_path(prefix + raw_path)
            if _excluded(full_path, exclude_prefix, excluded_paths):
                continue

            methods = getattr(route, "methods", None)
            if methods:
                for method in methods:
                    normalized_method = str(method).upper()
                    if normalized_method in _HTTP_METHODS:
                        routes.append({"method": normalized_method, "path": full_path})
                    else:
                        complete = False
                continue

            nested = getattr(route, "routes", None)
            if nested:
                visit(nested, full_path)
                continue

            if type(route).__name__ == "WebSocketRoute":
                continue

            complete = False

    visit(source)
    return {
        "framework": "fastapi",
        **_framework_version(),
        "routes": _unique_sorted(_without_implicit_head_routes(routes)),
        "complete": complete,
    }


def documented_openapi_routes(spec) -> list[dict[str, str]]:
    """Extract normalized HTTP operations from an OpenAPI document.

    Args:
        spec: Parsed OpenAPI mapping.

    Returns:
        Unique sorted ``{"method", "path"}`` entries for recognized HTTP methods.
    """
    routes: list[dict[str, str]] = []
    paths = spec.get("paths", {}) if isinstance(spec, dict) else {}
    if not isinstance(paths, dict):
        return routes
    for path, path_item in paths.items():
        if not isinstance(path, str) or not isinstance(path_item, dict):
            continue
        for method in path_item:
            normalized_method = str(method).upper()
            if normalized_method in _HTTP_METHODS:
                routes.append({"method": normalized_method, "path": normalize_runtime_path(path)})
    return _unique_sorted(routes)


def python_runtime_metadata() -> dict[str, str]:
    """Return safe Python runtime metadata exposed by Runtime Intelligence.

    Returns:
        Runtime name/version plus platform and machine architecture identifiers.
    """
    return {
        "name": "python",
        "version": platform.python_version(),
        "platform": sys.platform,
        "arch": platform.machine() or "unknown",
    }


def server_origin_from_asgi_scope(scope) -> str | None:
    """Infer the current HTTP(S) server origin from an ASGI scope.

    Args:
        scope: ASGI HTTP scope containing scheme, headers, and/or server tuple.

    Returns:
        ``scheme://host[:port]`` or ``None`` when a valid origin cannot be inferred.
    """
    scheme = str(scope.get("scheme") or "http").lower()
    if scheme not in {"http", "https"}:
        return None

    host = None
    for name, value in scope.get("headers") or []:
        if bytes(name).lower() == b"host":
            host = bytes(value).decode("latin-1")
            break

    if not host:
        server = scope.get("server")
        if isinstance(server, (tuple, list)) and len(server) >= 2 and server[0]:
            hostname = str(server[0])
            if ":" in hostname and not hostname.startswith("["):
                hostname = f"[{hostname}]"
            port = server[1]
            default_port = 443 if scheme == "https" else 80
            host = hostname if port in (None, default_port) else f"{hostname}:{port}"

    return f"{scheme}://{host}" if host else None


def server_port_from_asgi_scope(scope) -> int | None:
    """Return a valid local listener port from an ASGI scope.

    Args:
        scope: ASGI HTTP scope containing the optional ``server`` tuple.

    Returns:
        Integer port in the range 1..65535, or ``None`` when unavailable/invalid.
    """
    server = scope.get("server")
    if not isinstance(server, (tuple, list)) or len(server) < 2:
        return None
    port = server[1]
    return port if isinstance(port, int) and 0 < port <= 65535 else None


def build_fastapi_runtime_snapshot(app, scope, exclude_prefix: str | None = None) -> dict:
    """Build a Runtime Intelligence route-presence snapshot for FastAPI.

    Args:
        app: FastAPI application whose generated OpenAPI document and live routes are compared.
        scope: Current ASGI HTTP scope used to infer server origin/listener metadata.
        exclude_prefix: Optional FlexDoc mount prefix excluded from runtime route discovery.

    Returns:
        Renderer-contract snapshot containing discovered/documented routes, drift sets,
        completeness metadata, runtime/server metadata, and summary counts.
    """
    spec = app.openapi()
    discovery = discover_fastapi_routes(app, exclude_prefix)
    documented = documented_openapi_routes(spec)
    runtime_routes = discovery["routes"]
    documented_keys = {_route_key(route) for route in documented}
    runtime_keys = {_route_key(route) for route in runtime_routes}
    runtime_only = [route for route in runtime_routes if _route_key(route) not in documented_keys]
    documented_only = [route for route in documented if _route_key(route) not in runtime_keys]
    matched = sum(1 for route in runtime_routes if _route_key(route) in documented_keys)
    origin = server_origin_from_asgi_scope(scope)
    local_port = server_port_from_asgi_scope(scope)

    return {
        "framework": discovery["framework"],
        **({"frameworkVersion": discovery["frameworkVersion"]} if discovery.get("frameworkVersion") else {}),
        "runtime": python_runtime_metadata(),
        **({"serverOrigin": origin} if origin else {}),
        **({"server": {"localPort": local_port}} if local_port else {}),
        "discoveryComplete": discovery["complete"],
        "routes": runtime_routes,
        "runtimeOnly": runtime_only,
        "documentedOnly": documented_only,
        "summary": {
            "documented": len(documented),
            "runtime": len(runtime_routes),
            "matched": matched,
            "runtimeOnly": len(runtime_only),
            "documentedOnly": len(documented_only),
        },
    }


def _framework_version(distribution: str = "fastapi") -> dict[str, str]:
    try:
        return {"frameworkVersion": package_version(distribution)}
    except PackageNotFoundError:
        return {}

_FLASK_CONVERTER = re.compile(r"<(?:[A-Za-z_][A-Za-z0-9_]*(?:\([^>]*\))?:)?([A-Za-z_][A-Za-z0-9_]*)>")
_DJANGO_CONVERTER = re.compile(r"<(?:[A-Za-z_][A-Za-z0-9_]*:)?([A-Za-z_][A-Za-z0-9_]*)>")


def normalize_flask_path(rule: str) -> str:
    """Convert a Flask rule into the normalized FlexDoc route path.

    Args:
        rule: Werkzeug rule string such as ``/pets/<int:pet_id>``.

    Returns:
        Normalized path with converters reduced to ``{name}``.
    """
    return normalize_runtime_path(_FLASK_CONVERTER.sub(r"{\1}", rule))


def discover_flask_routes(app, exclude_prefix: str | None = None) -> dict:
    """Discover HTTP routes registered on a Flask application.

    Werkzeug's URL map carries the methods each rule accepts, so Flask route
    presence is fully knowable rather than inferred.

    Args:
        app: Flask application exposing ``url_map``.
        exclude_prefix: Optional FlexDoc mount prefix to exclude from discovery.

    Returns:
        Discovery metadata with framework/version, normalized routes and a ``complete`` flag.
    """
    url_map = getattr(app, "url_map", None)
    rules = getattr(url_map, "iter_rules", None)
    if rules is None:
        return {"framework": "flask", **_framework_version("flask"), "routes": [], "complete": False}

    routes: list[dict[str, str]] = []
    complete = True
    for rule in rules():
        raw = getattr(rule, "rule", None)
        if not isinstance(raw, str):
            complete = False
            continue
        path = normalize_flask_path(raw)
        if _excluded(path, exclude_prefix, set()) or getattr(rule, "endpoint", None) == "static":
            continue
        methods = getattr(rule, "methods", None) or ()
        # Werkzeug adds OPTIONS itself unless the view asked for it, so reporting it
        # would show drift against a specification that never documents it.
        automatic = bool(getattr(rule, "provide_automatic_options", False))
        for method in methods:
            normalized = str(method).upper()
            if normalized == "OPTIONS" and automatic:
                continue
            if normalized in _HTTP_METHODS:
                routes.append({"method": normalized, "path": path})
            else:
                complete = False

    return {
        "framework": "flask",
        **_framework_version("flask"),
        "routes": _unique_sorted(_without_implicit_head_routes(routes)),
        "complete": complete,
    }


def _django_view_methods(callback) -> list[str] | None:
    """Return the HTTP methods a Django view declares, or None when undeclarable."""
    if callback is None:
        return None

    # Django REST Framework viewsets record their action map at bind time.
    actions = getattr(callback, "actions", None)
    if not isinstance(actions, dict):
        initkwargs = getattr(callback, "initkwargs", None)
        actions = initkwargs.get("actions") if isinstance(initkwargs, dict) else None
    if isinstance(actions, dict) and actions:
        declared = [method.upper() for method in actions if method.upper() in _HTTP_METHODS]
        if declared:
            return declared

    view_class = getattr(callback, "view_class", None) or getattr(callback, "cls", None)
    if view_class is None:
        return None

    allowed = getattr(view_class, "http_method_names", None)
    if not allowed:
        return None
    declared = [
        method.upper()
        for method in allowed
        if method.upper() in _HTTP_METHODS and callable(getattr(view_class, method.lower(), None))
    ]
    return declared or None


def discover_django_routes(urlpatterns, exclude_prefix: str | None = None) -> dict:
    """Discover HTTP routes from a Django URLconf.

    Django route methods are only knowable where a view declares them: class-based
    views expose ``http_method_names`` plus their implemented handlers, and DRF
    viewsets expose an action map. A plain function view accepts anything and
    decides internally, so its methods cannot be read without executing it. Those
    routes are reported as incomplete rather than guessed, because inventing a
    method would produce drift findings that are simply wrong.

    Args:
        urlpatterns: Iterable of Django URL patterns/resolvers.
        exclude_prefix: Optional FlexDoc mount prefix to exclude from discovery.

    Returns:
        Discovery metadata with framework/version, normalized routes and a ``complete`` flag.
    """
    routes: list[dict[str, str]] = []
    complete = True

    def visit(patterns, prefix: str) -> None:
        nonlocal complete
        for entry in patterns or ():
            pattern = getattr(entry, "pattern", None)
            route = getattr(pattern, "_route", None)
            nested = getattr(entry, "url_patterns", None)

            if route is None:
                # A re_path/RegexPattern has no readable route template.
                complete = False
                continue

            joined = prefix + str(route)
            if nested is not None:
                visit(nested, joined)
                continue

            path = normalize_runtime_path(_DJANGO_CONVERTER.sub(r"{\1}", joined))
            if _excluded(path, exclude_prefix, set()):
                continue

            methods = _django_view_methods(getattr(entry, "callback", None))
            if methods is None:
                complete = False
                continue
            for method in methods:
                routes.append({"method": method, "path": path})

    visit(urlpatterns, "")
    return {
        "framework": "django",
        **_framework_version("django"),
        "routes": _unique_sorted(_without_implicit_head_routes(routes)),
        "complete": complete,
    }


def server_origin_from_wsgi_environ(environ) -> str | None:
    """Infer the current HTTP(S) server origin from a WSGI environ.

    Args:
        environ: WSGI environment mapping.

    Returns:
        ``scheme://host[:port]`` or ``None`` when a valid origin cannot be inferred.
    """
    scheme = str(environ.get("wsgi.url_scheme") or "http").lower()
    if scheme not in {"http", "https"}:
        return None

    host = environ.get("HTTP_HOST")
    if not host:
        name = environ.get("SERVER_NAME")
        if not name:
            return None
        hostname = str(name)
        if ":" in hostname and not hostname.startswith("["):
            hostname = f"[{hostname}]"
        port = environ.get("SERVER_PORT")
        default_port = "443" if scheme == "https" else "80"
        host = hostname if str(port) in (default_port, "", "None") else f"{hostname}:{port}"

    return f"{scheme}://{host}"


def server_port_from_wsgi_environ(environ) -> int | None:
    """Return a valid local listener port from a WSGI environ.

    Args:
        environ: WSGI environment mapping.

    Returns:
        Integer port in the range 1..65535, or ``None`` when unavailable/invalid.
    """
    try:
        port = int(environ.get("SERVER_PORT"))
    except (TypeError, ValueError):
        return None
    return port if 0 < port <= 65535 else None


def build_wsgi_runtime_snapshot(discovery: dict, spec, environ) -> dict:
    """Assemble a route-presence snapshot from a completed discovery and a specification.

    Args:
        discovery: Result of a framework discovery function.
        spec: OpenAPI mapping the application documents, or a callable returning one.
        environ: WSGI environment used to infer server origin/listener metadata.

    Returns:
        Renderer-contract snapshot with drift sets, completeness and summary counts.
    """
    document = spec() if callable(spec) else spec
    documented = documented_openapi_routes(document)
    runtime_routes = discovery["routes"]
    documented_keys = {_route_key(route) for route in documented}
    runtime_keys = {_route_key(route) for route in runtime_routes}
    runtime_only = [route for route in runtime_routes if _route_key(route) not in documented_keys]
    documented_only = [route for route in documented if _route_key(route) not in runtime_keys]
    origin = server_origin_from_wsgi_environ(environ)
    local_port = server_port_from_wsgi_environ(environ)

    return {
        "framework": discovery["framework"],
        **({"frameworkVersion": discovery["frameworkVersion"]} if discovery.get("frameworkVersion") else {}),
        "runtime": python_runtime_metadata(),
        **({"serverOrigin": origin} if origin else {}),
        **({"server": {"localPort": local_port}} if local_port else {}),
        "discoveryComplete": discovery["complete"],
        "routes": runtime_routes,
        "runtimeOnly": runtime_only,
        "documentedOnly": documented_only,
        "summary": {
            "documented": len(documented),
            "runtime": len(runtime_routes),
            "matched": sum(1 for route in runtime_routes if _route_key(route) in documented_keys),
            "runtimeOnly": len(runtime_only),
            "documentedOnly": len(documented_only),
        },
    }


def build_flask_runtime_snapshot(app, spec, environ, exclude_prefix: str | None = None) -> dict:
    """Build a Runtime Intelligence snapshot for a Flask application.

    Args:
        app: Flask application whose URL map is compared against the specification.
        spec: OpenAPI mapping, or a callable returning one.
        environ: Current WSGI environment.
        exclude_prefix: Optional FlexDoc mount prefix excluded from discovery.

    Returns:
        Renderer-contract snapshot.
    """
    return build_wsgi_runtime_snapshot(discover_flask_routes(app, exclude_prefix), spec, environ)


def build_django_runtime_snapshot(urlpatterns, spec, environ, exclude_prefix: str | None = None) -> dict:
    """Build a Runtime Intelligence snapshot for a Django URLconf.

    Args:
        urlpatterns: Django URL patterns to walk.
        spec: OpenAPI mapping, or a callable returning one.
        environ: Current WSGI environment.
        exclude_prefix: Optional FlexDoc mount prefix excluded from discovery.

    Returns:
        Renderer-contract snapshot.
    """
    return build_wsgi_runtime_snapshot(discover_django_routes(urlpatterns, exclude_prefix), spec, environ)
