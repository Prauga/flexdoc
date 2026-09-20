import type { ApiClientExecutionOutcome, ApiClientExecutionResponse, ApiClientExecutionResult } from './api-client-execution';

/** Transport that actually carried a request. */
export type ApiClientObservedTransport = 'browser' | 'api-host';

/** Stable category for an execution that never reached a transport. */
export type ApiClientUnexecutedReason = 'host-unavailable' | 'script-error' | 'request-invalid';

/** Coarse response-status grouping, kept low-cardinality on purpose. */
export type ApiClientStatusClass = '2xx' | '3xx' | '4xx' | '5xx' | 'other';

/** Observed duration distribution for one transport. */
export interface ApiClientDurationSummary {
  /** Number of durations retained for percentile estimation. */ sampleCount: number;
  /** True when observations exceeded capacity and durations are a uniform sample. */ sampled: boolean;
  minMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  maxMs: number;
}

/** Aggregate behaviour of one transport within an observation window. */
export interface ApiClientTransportSummary {
  /** Requests that reached this transport. */ attempts: number;
  /** Attempts that produced a response, at any status. */ responses: number;
  /** Attempts that failed before producing a response. */ failures: number;
  /** Failures classified as browser network/CORS failures. */ networkFailures: number;
  /** Response counts by status class. */ statusClasses: Record<ApiClientStatusClass, number>;
  /** Elapsed time as observed in the browser. */ totalDurations: ApiClientDurationSummary | null;
  /** Host-reported target duration; API-host only. */ targetDurations: ApiClientDurationSummary | null;
  /** Browser-to-host overhead, total minus target; API-host only. */ hostOverhead: ApiClientDurationSummary | null;
}

/** Aggregate transport observation for one window, free of request content. */
export interface ApiClientTransportObservation {
  /** ISO-8601 timestamp of the first recorded execution. */ windowStart: string | null;
  /** ISO-8601 timestamp of the most recent recorded execution. */ windowEnd: string | null;
  /** Executions recorded, including those that never reached a transport. */ executions: number;
  /** Per-transport aggregates; this is the transport mix. */ byTransport: Record<ApiClientObservedTransport, ApiClientTransportSummary>;
  /** Executions that never reached a transport, keyed by stable reason. */ unexecuted: Partial<Record<ApiClientUnexecutedReason, number>>;
}

/** Outcome fields the recorder reads. Nothing else is accepted, so content cannot leak in. */
export type ApiClientTransportObservationInput = Pick<ApiClientExecutionOutcome, 'failureKind' | 'scriptError'> & {
  result?: Pick<ApiClientExecutionResult, 'transport'>;
  response?: Pick<ApiClientExecutionResponse, 'transport' | 'status' | 'responseTime' | 'hostRoundTripTime'>;
};

/** Recorder that aggregates executions into an exportable observation. */
export interface ApiClientTransportRecorder {
  /** Record one completed execution outcome. */ record: (input: ApiClientTransportObservationInput) => void;
  /** Current aggregate; safe to call at any time. */ snapshot: () => ApiClientTransportObservation;
  /** Discard all counts and start a new window. */ reset: () => void;
}

/** Options controlling duration retention and the clock/entropy used for sampling. */
export interface CreateApiClientTransportRecorderOptions {
  /** Maximum retained durations per series; beyond this, durations are uniformly sampled. Defaults to 2048. */ durationSampleCapacity?: number;
  /** Clock used for window bounds. */ now?: () => number;
  /** Uniform [0, 1) source used for reservoir replacement. */ random?: () => number;
}

interface DurationSeries {
  observed: number;
  retained: number[];
}

const TRANSPORTS: readonly ApiClientObservedTransport[] = ['browser', 'api-host'];

function percentile(sorted: readonly number[], fraction: number): number {
  if (sorted.length === 1) return sorted[0];
  const rank = Math.ceil(fraction * sorted.length);
  return sorted[Math.min(Math.max(rank, 1), sorted.length) - 1];
}

function statusClass(status: number): ApiClientStatusClass {
  if (status >= 200 && status < 300) return '2xx';
  if (status >= 300 && status < 400) return '3xx';
  if (status >= 400 && status < 500) return '4xx';
  if (status >= 500 && status < 600) return '5xx';
  return 'other';
}

/**
 * Aggregate API Client executions into a transport observation.
 *
 * Only counters and durations are retained. No URL, method, header, body,
 * credential or per-request timestamp reaches this recorder, so the aggregate
 * cannot carry request content by construction.
 *
 * This is the browser half of the post-release execution evidence. An API host
 * cannot observe browser-direct executions at all, because they never reach it,
 * so transport mix can only be produced here.
 *
 * Durations are retained up to `durationSampleCapacity` per series and then
 * replaced by reservoir sampling, so a long-lived tab stays bounded while
 * percentiles still describe the whole window. Counts stay exact regardless.
 * @param options Retention capacity, clock and entropy source.
 * @returns Recorder exposing a record hook, a snapshot reader and a reset.
 */
export function createApiClientTransportRecorder(
  options: CreateApiClientTransportRecorderOptions = {},
): ApiClientTransportRecorder {
  const capacity = Math.max(1, Math.floor(options.durationSampleCapacity ?? 2048));
  const now = options.now ?? (() => Date.now());
  const random = options.random ?? Math.random;

  let windowStart: number | null = null;
  let windowEnd: number | null = null;
  let executions = 0;
  let unexecuted: Partial<Record<ApiClientUnexecutedReason, number>> = {};
  let counts: Record<ApiClientObservedTransport, {
    attempts: number;
    responses: number;
    failures: number;
    networkFailures: number;
    statusClasses: Record<ApiClientStatusClass, number>;
    total: DurationSeries;
    target: DurationSeries;
    overhead: DurationSeries;
  }>;

  const emptySeries = (): DurationSeries => ({ observed: 0, retained: [] });
  const emptyCounts = () => ({
    attempts: 0,
    responses: 0,
    failures: 0,
    networkFailures: 0,
    statusClasses: { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0, other: 0 } as Record<ApiClientStatusClass, number>,
    total: emptySeries(),
    target: emptySeries(),
    overhead: emptySeries(),
  });
  const clear = (): void => {
    counts = { browser: emptyCounts(), 'api-host': emptyCounts() };
  };
  clear();

  const observe = (series: DurationSeries, value: number | undefined): void => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return;
    const ms = Math.max(0, value);
    series.observed += 1;
    if (series.retained.length < capacity) {
      series.retained.push(ms);
      return;
    }
    const candidate = Math.floor(random() * series.observed);
    if (candidate < capacity) series.retained[candidate] = ms;
  };

  const summarize = (series: DurationSeries): ApiClientDurationSummary | null => {
    if (series.retained.length === 0) return null;
    const sorted = [...series.retained].sort((a, b) => a - b);
    return {
      sampleCount: sorted.length,
      sampled: series.observed > sorted.length,
      minMs: sorted[0],
      p50Ms: percentile(sorted, 0.5),
      p95Ms: percentile(sorted, 0.95),
      p99Ms: percentile(sorted, 0.99),
      maxMs: sorted[sorted.length - 1],
    };
  };

  const record = (input: ApiClientTransportObservationInput): void => {
    const timestamp = now();
    if (windowStart === null) windowStart = timestamp;
    windowEnd = timestamp;
    executions += 1;

    const transport = input.response?.transport ?? input.result?.transport;
    if (transport !== 'browser' && transport !== 'api-host') {
      // A result without a transport means host transport was required or chosen
      // and could not run; that is the only path producing one. Otherwise the
      // execution failed in a script or before the request was built.
      const reason: ApiClientUnexecutedReason = input.result ? 'host-unavailable' : input.scriptError ? 'script-error' : 'request-invalid';
      unexecuted[reason] = (unexecuted[reason] ?? 0) + 1;
      return;
    }

    const bucket = counts[transport];
    bucket.attempts += 1;
    const response = input.response;
    if (!response) {
      bucket.failures += 1;
      if (input.failureKind === 'browser-network') bucket.networkFailures += 1;
      return;
    }

    bucket.responses += 1;
    bucket.statusClasses[statusClass(response.status)] += 1;
    if (transport === 'browser') {
      observe(bucket.total, response.responseTime);
      return;
    }

    // For API-host execution `hostRoundTripTime` is browser-observed and
    // `responseTime` is the host's target measurement, so their difference is
    // the browser-to-host overhead. Keeping the three series separate is what
    // makes a slow host attributable to the hop or to the target.
    const total = response.hostRoundTripTime ?? response.responseTime;
    observe(bucket.total, total);
    observe(bucket.target, response.responseTime);
    if (typeof response.hostRoundTripTime === 'number' && typeof response.responseTime === 'number') {
      observe(bucket.overhead, Math.max(0, response.hostRoundTripTime - response.responseTime));
    }
  };

  const snapshot = (): ApiClientTransportObservation => ({
    windowStart: windowStart === null ? null : new Date(windowStart).toISOString(),
    windowEnd: windowEnd === null ? null : new Date(windowEnd).toISOString(),
    executions,
    byTransport: TRANSPORTS.reduce((result, transport) => {
      const bucket = counts[transport];
      result[transport] = {
        attempts: bucket.attempts,
        responses: bucket.responses,
        failures: bucket.failures,
        networkFailures: bucket.networkFailures,
        statusClasses: { ...bucket.statusClasses },
        totalDurations: summarize(bucket.total),
        targetDurations: summarize(bucket.target),
        hostOverhead: summarize(bucket.overhead),
      };
      return result;
    }, {} as Record<ApiClientObservedTransport, ApiClientTransportSummary>),
    unexecuted: { ...unexecuted },
  });

  const reset = (): void => {
    windowStart = null;
    windowEnd = null;
    executions = 0;
    unexecuted = {};
    clear();
  };

  return { record, snapshot, reset };
}

/** Evidence the browser cannot observe by itself. */
export type ApiClientTransportObservationGap = 'host-side-rejection-reasons';

/** Stable operator export document for the browser half of execution evidence. */
export interface ApiClientTransportObservationReport {
  schema: 'flexdoc.api-client.transport-observation/1';
  generatedAt: string;
  observation: ApiClientTransportObservation;
  /** Host-side document that answers what this one cannot. */ pairsWith: 'flexdoc.host-execution.observation/1';
  /** Evidence this document cannot contain, declared rather than silently omitted. */ gaps: readonly ApiClientTransportObservationGap[];
}

/**
 * Build the operator export document for a transport observation.
 *
 * The document is aggregate-only and is produced on operator action. FlexDoc
 * never transmits it. Rejection reasons live on the API host and are absent
 * here, so the gap is declared and the paired host schema is named rather than
 * letting a review mistake one half for complete evidence.
 * @param observation Aggregate produced by a transport recorder.
 * @param generatedAt Optional ISO-8601 generation timestamp.
 * @returns Serializable report document.
 */
export function createApiClientTransportReport(
  observation: ApiClientTransportObservation,
  generatedAt: string = new Date().toISOString(),
): ApiClientTransportObservationReport {
  return {
    schema: 'flexdoc.api-client.transport-observation/1',
    generatedAt,
    observation,
    pairsWith: 'flexdoc.host-execution.observation/1',
    gaps: ['host-side-rejection-reasons'],
  };
}

const shared = createApiClientTransportRecorder();

/** Record one execution into the shared in-memory observation. */
export function recordApiClientTransportOutcome(input: ApiClientTransportObservationInput): void {
  shared.record(input);
}

/** Read the shared in-memory observation. */
export function apiClientTransportObservation(): ApiClientTransportObservation {
  return shared.snapshot();
}

/** Discard the shared observation and start a new window. */
export function resetApiClientTransportObservation(): void {
  shared.reset();
}
