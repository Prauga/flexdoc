"""Self-hosted FlexDoc adapters for ASGI and WSGI Python applications.

The package exposes a framework-neutral :class:`~prauga_flexdoc.host.FlexDocHost`,
ASGI and WSGI transports, native host execution, and helpers for FastAPI, Flask, and Django.
"""

from .host import FlexDocConfig, FlexDocHost, FlexDocResponse
from .host_execution import FlexDocHostExecution, FlexDocHostExecutionFile, FlexDocHostExecutionResult
from .asgi import FlexDocASGI
from .wsgi import FlexDocWSGI
from .integrations import django_urlpatterns, setup_fastapi_flexdoc, setup_flask_flexdoc

__all__ = [
    "FlexDocASGI",
    "FlexDocConfig",
    "FlexDocHost",
    "FlexDocHostExecution",
    "FlexDocHostExecutionFile",
    "FlexDocHostExecutionResult",
    "FlexDocResponse",
    "FlexDocWSGI",
    "django_urlpatterns",
    "setup_fastapi_flexdoc",
    "setup_flask_flexdoc",
]