"""Execution evidence for the Python host executor.

This mirrors the Node contract deliberately: the same reason vocabulary, the same
metric names and labels, and the same export schema. An operator running a mixed
fleet should be able to read one document shape regardless of which runtime served
the execute route, and a collector written for one runtime should not need a second
parser for another.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
import random as _random
import time
from typing import Callable, Literal, Mapping


Outcome = Literal["success", "rejected", "error"]

#: Stable low-cardinality categories for a non-successful execution.
#:
#: Rejection messages interpolate request values such as origins, field names and
#: methods, so they are unbounded and cannot be used as a metric label. These can.
HOST_EXECUTION_REASONS: tuple[str, ...] = (
    "marker-missing",
    "execution-disabled",
    "admission-saturated",
    "destination-forbidden",
    "redirect-forbidden",
    "body-malformed",
    "body-too-large",
    "unsupported-media-type",
    "request-invalid",
    "auth-unsupported",
    "upstream-timeout",
    "upstream-unreachable",
    "upstream-error",
)

OBSERVATION_SCHEMA = "flexdoc.host-execution.observation/1"

#: Evidence an API host cannot observe by itself, declared rather than omitted.
OBSERVATION_GAPS: tuple[str, ...] = ("browser-direct-transport-mix",)

_OUTCOMES: tuple[Outcome, ...] = ("success", "rejected", "error")


def is_host_execution_reason(value: object) -> bool:
    """Return whether a value is one of the stable reason categories.

    Args:
        value: Candidate reason.

    Returns:
        ``True`` when the value is a known category.
    """
    return isinstance(value, str) and value in HOST_EXECUTION_REASONS


@dataclass(frozen=True)
class FlexDocHostExecutionMetric:
    """One dependency-free metric update that can be bridged to Prometheus or OpenTelemetry."""

    name: str
    kind: Literal["counter", "gauge", "histogram"]
    value: float
    labels: Mapping[str, str] = field(default_factory=dict)


MetricSink = Callable[[FlexDocHostExecutionMetric], None]


def _iso(epoch_seconds: float) -> str:
    return datetime.fromtimestamp(epoch_seconds, timezone.utc).isoformat().replace("+00:00", "Z")


def _percentile(sorted_values: list[float], fraction: float) -> float:
    if len(sorted_values) == 1:
        return sorted_values[0]
    import math

    rank = math.ceil(fraction * len(sorted_values))
    return sorted_values[min(max(rank, 1), len(sorted_values)) - 1]


class FlexDocHostExecutionObservation:
    """Aggregate host-execution evidence for one window, free of request content.

    Only counters and durations are retained. No URL, header, body, credential or
    per-request timestamp reaches this recorder, so the aggregate cannot carry
    request content by construction.

    Durations are retained up to ``duration_sample_capacity`` and then replaced by
    reservoir sampling, so memory stays bounded for a host that runs indefinitely
    while percentiles stay representative of the whole window rather than only its
    opening. Counts stay exact regardless.
    """

    def __init__(
        self,
        *,
        duration_sample_capacity: int = 8192,
        now: Callable[[], float] = time.time,
        random: Callable[[], float] = _random.random,
    ):
        """Create a recorder.

        Args:
            duration_sample_capacity: Retained durations before uniform sampling begins.
            now: Clock used for window bounds.
            random: Uniform ``[0, 1)`` source used for reservoir replacement.
        """
        self._capacity = max(1, int(duration_sample_capacity))
        self._now = now
        self._random = random
        self.reset()

    def reset(self) -> None:
        """Discard all counts and start a new window."""
        self._window_start: float | None = None
        self._window_end: float | None = None
        self._started = 0
        self._unmarked = 0
        self._completed = 0
        self._in_flight = 0
        self._peak_in_flight = 0
        self._observed_durations = 0
        self._outcomes: dict[str, int] = {outcome: 0 for outcome in _OUTCOMES}
        self._rejections: dict[str, int] = {}
        self._errors: dict[str, int] = {}
        self._durations: list[float] = []

    def record(self, metric: FlexDocHostExecutionMetric) -> None:
        """Fold one metric update into the aggregate.

        Args:
            metric: Update emitted by the executor.
        """
        timestamp = self._now()
        if self._window_start is None:
            self._window_start = timestamp
        self._window_end = timestamp

        if metric.name == "flexdoc_execute_requests_total":
            self._started += 1
        elif metric.name == "flexdoc_execute_in_flight":
            self._in_flight = max(0, self._in_flight + int(metric.value))
            self._peak_in_flight = max(self._peak_in_flight, self._in_flight)
        elif metric.name == "flexdoc_execute_completions_total":
            self._completed += 1
            outcome = metric.labels.get("outcome")
            if outcome in self._outcomes:
                self._outcomes[outcome] += 1
        elif metric.name == "flexdoc_execute_rejections_total":
            self._tally(self._rejections, metric.labels.get("reason"))
        elif metric.name == "flexdoc_execute_unmarked_total":
            # Deliberately not folded into rejections: those describe validated
            # envelopes, and merging the two would double-count attempts.
            self._unmarked += 1
        elif metric.name == "flexdoc_execute_errors_total":
            self._tally(self._errors, metric.labels.get("reason"))
        elif metric.name == "flexdoc_execute_duration_seconds":
            self._record_duration(metric.value)

    def snapshot(self) -> dict:
        """Return the current aggregate; safe to call at any time.

        Returns:
            Serializable aggregate with counts, peak concurrency and duration percentiles.
        """
        ordered = sorted(self._durations)
        return {
            "windowStart": None if self._window_start is None else _iso(self._window_start),
            "windowEnd": None if self._window_end is None else _iso(self._window_end),
            "startedExecutions": self._started,
            "unmarkedRequests": self._unmarked,
            "completedExecutions": self._completed,
            "outcomes": dict(self._outcomes),
            "inFlight": self._in_flight,
            "peakInFlight": self._peak_in_flight,
            "rejectionsByReason": dict(self._rejections),
            "errorsByReason": dict(self._errors),
            "durations": None if not ordered else {
                "sampleCount": len(ordered),
                "sampled": self._observed_durations > len(ordered),
                "minMs": ordered[0],
                "p50Ms": _percentile(ordered, 0.5),
                "p95Ms": _percentile(ordered, 0.95),
                "p99Ms": _percentile(ordered, 0.99),
                "maxMs": ordered[-1],
            },
        }

    def _tally(self, counts: dict[str, int], reason: object) -> None:
        if is_host_execution_reason(reason):
            counts[str(reason)] = counts.get(str(reason), 0) + 1

    def _record_duration(self, seconds: float) -> None:
        milliseconds = max(0.0, float(seconds) * 1000)
        self._observed_durations += 1
        if len(self._durations) < self._capacity:
            self._durations.append(milliseconds)
            return
        candidate = int(self._random() * self._observed_durations)
        if candidate < self._capacity:
            self._durations[candidate] = milliseconds


def create_host_execution_observation_report(
    observation: FlexDocHostExecutionObservation,
    generated_at: str | None = None,
) -> dict:
    """Build the operator export document for a host-execution observation.

    The document is aggregate-only and is meant to be written to disk or handed to
    an operator; FlexDoc never transmits it. Browser-direct executions never reach
    an API host, so the transport mix cannot be derived here, and that gap is
    declared so a review cannot mistake this document for complete evidence.

    Args:
        observation: Recorder whose current aggregate should be exported.
        generated_at: Optional ISO-8601 generation timestamp.

    Returns:
        Serializable report document sharing the Node export schema.
    """
    return {
        "schema": OBSERVATION_SCHEMA,
        "generatedAt": generated_at or _iso(time.time()),
        "runtime": "python",
        "observation": observation.snapshot(),
        "gaps": list(OBSERVATION_GAPS),
    }
