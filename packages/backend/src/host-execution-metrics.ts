import type { FlexDocHostExecutionCompleteEvent, FlexDocHostExecutionOutcome, FlexDocHostExecutionReason } from './host-execution-observability';

/** Stable Prometheus-style metric names emitted for validated API-host executions. */
export type FlexDocHostExecutionMetricName =
  | 'flexdoc_execute_requests_total'
  | 'flexdoc_execute_in_flight'
  | 'flexdoc_execute_completions_total'
  | 'flexdoc_execute_rejections_total'
  | 'flexdoc_execute_unmarked_total'
  | 'flexdoc_execute_errors_total'
  | 'flexdoc_execute_duration_seconds';

/** Metric instrument kinds used by the dependency-free operator contract. */
export type FlexDocHostExecutionMetricKind = 'counter' | 'gauge' | 'histogram';

/** Low-cardinality source for an execution rejection. */
export type FlexDocHostExecutionRejectionSource = 'route' | 'admission';

/** One dependency-free metric update that can be bridged to Prometheus/OpenTelemetry. */
export type FlexDocHostExecutionMetricUpdate =
  | {
      name: 'flexdoc_execute_requests_total';
      kind: 'counter';
      value: 1;
    }
  | {
      name: 'flexdoc_execute_in_flight';
      kind: 'gauge';
      operation: 'add';
      value: 1 | -1;
    }
  | {
      name: 'flexdoc_execute_completions_total';
      kind: 'counter';
      value: 1;
      labels: { outcome: FlexDocHostExecutionOutcome };
    }
  | {
      name: 'flexdoc_execute_rejections_total';
      kind: 'counter';
      value: 1;
      labels: { source: FlexDocHostExecutionRejectionSource; statusCode: 400 | 403 | 429; reason: FlexDocHostExecutionReason };
    }
  | {
      name: 'flexdoc_execute_unmarked_total';
      kind: 'counter';
      value: 1;
      labels: { reason: 'marker-missing' };
    }
  | {
      name: 'flexdoc_execute_errors_total';
      kind: 'counter';
      value: 1;
      labels: { reason: FlexDocHostExecutionReason };
    }
  | {
      name: 'flexdoc_execute_duration_seconds';
      kind: 'histogram';
      value: number;
      labels: { outcome: FlexDocHostExecutionOutcome };
    };

/** Best-effort sink for host-execution operator metric updates. */
export type FlexDocHostExecutionMetricSink = (update: FlexDocHostExecutionMetricUpdate) => void | Promise<void>;

/** Metric updates emitted when a validated host execution starts. */
export function createHostExecutionStartMetricUpdates(): FlexDocHostExecutionMetricUpdate[] {
  return [
    { name: 'flexdoc_execute_requests_total', kind: 'counter', value: 1 },
    { name: 'flexdoc_execute_in_flight', kind: 'gauge', operation: 'add', value: 1 },
  ];
}

/** Metric updates emitted when a validated host execution completes. */
export function createHostExecutionCompleteMetricUpdates(
  event: FlexDocHostExecutionCompleteEvent,
): FlexDocHostExecutionMetricUpdate[] {
  const updates: FlexDocHostExecutionMetricUpdate[] = [
    { name: 'flexdoc_execute_in_flight', kind: 'gauge', operation: 'add', value: -1 },
    {
      name: 'flexdoc_execute_completions_total',
      kind: 'counter',
      value: 1,
      labels: { outcome: event.outcome },
    },
    {
      name: 'flexdoc_execute_duration_seconds',
      kind: 'histogram',
      value: event.durationMs / 1000,
      labels: { outcome: event.outcome },
    },
  ];

  if (event.outcome === 'rejected' && (event.statusCode === 400 || event.statusCode === 403)) {
    updates.push({
      name: 'flexdoc_execute_rejections_total',
      kind: 'counter',
      value: 1,
      labels: { source: 'route', statusCode: event.statusCode, reason: event.reason ?? 'request-invalid' },
    });
  }
  if (event.outcome === 'error') {
    updates.push({
      name: 'flexdoc_execute_errors_total',
      kind: 'counter',
      value: 1,
      labels: { reason: event.reason ?? 'upstream-error' },
    });
  }
  return updates;
}

/**
 * Metric update emitted when a request to the execute route omits the marker header.
 *
 * This is deliberately not part of the execution lifecycle: the request never
 * produced a validated envelope, so it must not appear in request/in-flight
 * totals or emit a correlated start/completion pair. Operators still need the
 * count, because a missing marker is the most common way an execute attempt is
 * turned away.
 */
export function createHostExecutionUnmarkedMetricUpdate(): FlexDocHostExecutionMetricUpdate {
  return {
    name: 'flexdoc_execute_unmarked_total',
    kind: 'counter',
    value: 1,
    labels: { reason: 'marker-missing' },
  };
}

/** Metric update emitted when HTTP admission rejects host execution before lifecycle start. */
export function createHostExecutionAdmissionRejectionMetricUpdate(): FlexDocHostExecutionMetricUpdate {
  return {
    name: 'flexdoc_execute_rejections_total',
    kind: 'counter',
    value: 1,
    labels: { source: 'admission', statusCode: 429, reason: 'admission-saturated' },
  };
}

/** Deliver metric updates without allowing telemetry failures to alter host execution. */
export function emitHostExecutionMetricUpdates(
  sink: FlexDocHostExecutionMetricSink | undefined,
  updates: readonly FlexDocHostExecutionMetricUpdate[],
): void {
  if (!sink) return;
  for (const update of updates) {
    try {
      void Promise.resolve(sink(update)).catch(() => undefined);
    } catch {
      // Operator metrics are best-effort and must never alter request execution.
    }
  }
}
