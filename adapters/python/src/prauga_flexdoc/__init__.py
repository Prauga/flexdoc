"""Self-hosted FlexDoc adapters for ASGI and WSGI Python applications.

The package exposes a framework-neutral :class:`~prauga_flexdoc.host.FlexDocHost`,
ASGI and WSGI transports, native host execution, and helpers for FastAPI, Flask, and Django.
"""

from .host import FlexDocConfig, FlexDocHost, FlexDocResponse
from .host_execution import FlexDocHostExecution, FlexDocHostExecutionFile, FlexDocHostExecutionResult
from .host_execution_observability import (
    HOST_EXECUTION_REASONS,
    FlexDocHostExecutionMetric,
    FlexDocHostExecutionObservation,
    create_host_execution_observation_report,
    is_host_execution_reason,
)
from .asgi import FlexDocASGI
from .wsgi import FlexDocWSGI
from .integrations import django_urlpatterns, setup_fastapi_flexdoc, setup_flask_flexdoc

__all__ = [
    "HOST_EXECUTION_REASONS",
    "FlexDocASGI",
    "FlexDocConfig",
    "FlexDocHost",
    "FlexDocHostExecution",
    "FlexDocHostExecutionFile",
    "FlexDocHostExecutionMetric",
    "FlexDocHostExecutionObservation",
    "FlexDocHostExecutionResult",
    "FlexDocResponse",
    "FlexDocWSGI",
    "create_host_execution_observation_report",
    "django_urlpatterns",
    "is_host_execution_reason",
    "setup_fastapi_flexdoc",
    "setup_flask_flexdoc",
]