from __future__ import annotations

from importlib.metadata import PackageNotFoundError, version as package_version
import platform
import re
import sys

_HTTP_METHODS = {"GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD", "TRACE"}


def normalize_runtime_path(value: str) -> str:
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
    return {
        "name": "python",
        "version": platform.python_version(),
        "platform": sys.platform,
        "arch": platform.machine() or "unknown",
    }


def server_origin_from_asgi_scope(scope) -> str | None:
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


def build_fastapi_runtime_snapshot(app, scope, exclude_prefix: str | None = None) -> dict:
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

    return {
        "framework": discovery["framework"],
        **({"frameworkVersion": discovery["frameworkVersion"]} if discovery.get("frameworkVersion") else {}),
        "runtime": python_runtime_metadata(),
        **({"serverOrigin": origin} if origin else {}),
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


def _framework_version() -> dict[str, str]:
    try:
        return {"frameworkVersion": package_version("fastapi")}
    except PackageNotFoundError:
        return {}
