"""Self-hosted FlexDoc adapters for ASGI and WSGI Python applications.

The package exposes a framework-neutral :class:`~prauga_flexdoc.host.FlexDocHost`,
ASGI and WSGI transports, and helpers for FastAPI, Flask, and Django.
"""

from .host import FlexDocConfig, FlexDocHost, FlexDocResponse
from .asgi import FlexDocASGI
from .wsgi import FlexDocWSGI
from .integrations import django_urlpatterns, setup_fastapi_flexdoc, setup_flask_flexdoc

__all__ = [
    "FlexDocASGI",
    "FlexDocConfig",
    "FlexDocHost",
    "FlexDocResponse",
    "FlexDocWSGI",
    "django_urlpatterns",
    "setup_fastapi_flexdoc",
    "setup_flask_flexdoc",
]
