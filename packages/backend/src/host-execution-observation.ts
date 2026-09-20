import type { FlexDocHostExecutionMetricSink, FlexDocHostExecutionMetricUpdate } from './host-execution-metrics';
import type { FlexDocHostExecutionOutcome, FlexDocHostExecutionReason } from './host-execution-observability';

/** Counts of completed executions by coarse outcome. */
export type FlexDocHostExecutionOutcomeCounts = Record<FlexDocHostExecutionOutcome, number>;

/** Observed duration distribution for completed executions. */
export interface FlexDocHostExecutionDurationSummary {
  /** Number of durations retained for percentile estimation. */ sampleCount: number;
  /** True when completions exceeded the retention capacity and durations are a uniform sample. */ sampled: boolean;
  minMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  maxMs: number;
}

/** Aggregate host-execution observation for one window, free of request content. */
export interface FlexDocHostExecutionObservation {
  /** ISO-8601 timestamp of the first recorded update. */ windowStart: string | null;
  /** ISO-8601 timestamp of the most recent recorded update. */ windowEnd: string | null;
  /** Executions that produced a validated envelope and entered the lifecycle. */ startedExecutions: number;
  /** Requests turned away for a missing marker header, which never became executions. */ unmarkedRequests: number;
  /** Executions that reported a completion. */ completedExecutions: number;
  /** Completions by outcome. */ outcomes: FlexDocHostExecutionOutcomeCounts;
  /** Executions currently in flight. */ inFlight: number;
  /** Highest concurrent in-flight count seen in the window. */ peakInFlight: number;
  /** Rejection counts keyed by stable reason; only observed reasons appear. */ rejectionsByReason: Partial<Record<FlexDocHostExecutionReason, number>>;
  /** Upstream failure counts keyed by stable reason; only observed reasons appear. */ errorsByReason: Partial<Record<FlexDocHostExecutionReason, number>>;
  /** Duration distribution, or null before the first completion. */ durations: FlexDocHostExecutionDurationSummary | null;
}

/** Recorder that aggregates operator metric updates into an exportable observation. */
export interface FlexDocHostExecutionObservationRecorder {
  /** Metric sink to pass as `onHostExecutionMetric`. */ sink: FlexDocHostExecutionMetricSink;
  /** Current aggregate; safe to call at any time. */ snapshot: () => FlexDocHostExecutionObservation;
  /** Discard all counts and start a new window. */ reset: () => void;
}

/** Options controlling duration retention and the clock/entropy used for sampling. */
export interface CreateHostExecutionObservationRecorderOptions {
  /** Maximum retained durations; beyond this, durations are uniformly sampled. Defaults to 8192. */ durationSampleCapacity?: number;
  /** Clock used for window bounds. */ now?: () => number;
  /** Uniform [0, 1) source used for reservoir replacement. */ random?: () => number;
}

function percentile(sorted: readonly number[], fraction: number): number {
  if (sorted.length === 1) return sorted[0];
  const rank = Math.ceil(fraction * sorted.length);
  return sorted[Math.min(Math.max(rank, 1), sorted.length) - 1];
}

/**
 * Aggregate host-execution metric updates into an operator-exportable observation.
 *
 * Only counters and durations are retained. No URL, header, body, credential,
 * execution id or per-request timestamp reaches this recorder, so the aggregate
 * cannot carry request content by construction.
 *
 * Durations are retained up to `durationSampleCapacity` and then replaced by
 * reservoir sampling, so memory stays bounded for an indefinitely running host
 * while percentiles remain representative of the whole window rather than only
 * its opening. Counts stay exact regardless.
 * @param options Retention capacity, clock and entropy source.
 * @returns Recorder exposing a metric sink, a snapshot reader and a reset.
 */
export function createHostExecutionObservationRecorder(
  options: CreateHostExecutionObservationRecorderOptions = {},
): FlexDocHostExecutionObservationRecorder {
  const capacity = Math.max(1, Math.floor(options.durationSampleCapacity ?? 8192));
  const now = options.now ?? (() => Date.now());
  const random = options.random ?? Math.random;

  let windowStart: number | null = null;
  let windowEnd: number | null = null;
  let startedExecutions = 0;
  let unmarkedRequests = 0;
  let completedExecutions = 0;
  let inFlight = 0;
  let peakInFlight = 0;
  let observedDurations = 0;
  let outcomes: FlexDocHostExecutionOutcomeCounts = { success: 0, rejected: 0, error: 0 };
  let rejectionsByReason: Partial<Record<FlexDocHostExecutionReason, number>> = {};
  let errorsByReason: Partial<Record<FlexDocHostExecutionReason, number>> = {};
  let durations: number[] = [];

  const increment = (
    counts: Partial<Record<FlexDocHostExecutionReason, number>>,
    reason: FlexDocHostExecutionReason,
  ): void => {
    counts[reason] = (counts[reason] ?? 0) + 1;
  };

  const recordDuration = (seconds: number): void => {
    const ms = Math.max(0, seconds * 1000);
    observedDurations += 1;
    if (durations.length < capacity) {
      durations.push(ms);
      return;
    }
    const candidate = Math.floor(random() * observedDurations);
    if (candidate < capacity) durations[candidate] = ms;
  };

  const sink: FlexDocHostExecutionMetricSink = (update: FlexDocHostExecutionMetricUpdate): void => {
    const timestamp = now();
    if (windowStart === null) windowStart = timestamp;
    windowEnd = timestamp;

    switch (update.name) {
      case 'flexdoc_execute_requests_total':
        startedExecutions += 1;
        break;
      case 'flexdoc_execute_in_flight':
        inFlight = Math.max(0, inFlight + update.value);
        peakInFlight = Math.max(peakInFlight, inFlight);
        break;
      case 'flexdoc_execute_completions_total':
        completedExecutions += 1;
        outcomes[update.labels.outcome] += 1;
        break;
      case 'flexdoc_execute_rejections_total':
        increment(rejectionsByReason, update.labels.reason);
        break;
      case 'flexdoc_execute_unmarked_total':
        // Deliberately not folded into rejectionsByReason: those describe
        // validated envelopes, and merging the two would double-count attempts.
        unmarkedRequests += 1;
        break;
      case 'flexdoc_execute_errors_total':
        increment(errorsByReason, update.labels.reason);
        break;
      case 'flexdoc_execute_duration_seconds':
        recordDuration(update.value);
        break;
    }
  };

  const snapshot = (): FlexDocHostExecutionObservation => {
    const sorted = [...durations].sort((a, b) => a - b);
    return {
      windowStart: windowStart === null ? null : new Date(windowStart).toISOString(),
      windowEnd: windowEnd === null ? null : new Date(windowEnd).toISOString(),
      startedExecutions,
      unmarkedRequests,
      completedExecutions,
      outcomes: { ...outcomes },
      inFlight,
      peakInFlight,
      rejectionsByReason: { ...rejectionsByReason },
      errorsByReason: { ...errorsByReason },
      durations: sorted.length === 0
        ? null
        : {
            sampleCount: sorted.length,
            sampled: observedDurations > sorted.length,
            minMs: sorted[0],
            p50Ms: percentile(sorted, 0.5),
            p95Ms: percentile(sorted, 0.95),
            p99Ms: percentile(sorted, 0.99),
            maxMs: sorted[sorted.length - 1],
          },
    };
  };

  const reset = (): void => {
    windowStart = null;
    windowEnd = null;
    startedExecutions = 0;
    unmarkedRequests = 0;
    completedExecutions = 0;
    inFlight = 0;
    peakInFlight = 0;
    observedDurations = 0;
    outcomes = { success: 0, rejected: 0, error: 0 };
    rejectionsByReason = {};
    errorsByReason = {};
    durations = [];
  };

  return { sink, snapshot, reset };
}

/** Evidence R33-07 requires that an API host cannot observe by itself. */
export type FlexDocHostExecutionObservationGap = 'browser-direct-transport-mix';

/** Stable operator export document for post-release host-execution review. */
export interface FlexDocHostExecutionObservationReport {
  schema: 'flexdoc.host-execution.observation/1';
  generatedAt: string;
  observation: FlexDocHostExecutionObservation;
  /** Evidence this document cannot contain, declared rather than silently omitted. */
  gaps: readonly FlexDocHostExecutionObservationGap[];
}

/**
 * Build the operator export document for a host-execution observation.
 *
 * The document is aggregate-only and is intended to be written to disk or
 * handed to an operator, not transmitted by FlexDoc. Browser-direct executions
 * never reach an API host, so the browser/API-host/host-required transport mix
 * cannot be derived here; the gap is declared so a review cannot mistake this
 * document for complete transport evidence.
 * @param observation Aggregate produced by an observation recorder.
 * @param generatedAt Optional ISO-8601 generation timestamp.
 * @returns Serializable report document.
 */
export function createHostExecutionObservationReport(
  observation: FlexDocHostExecutionObservation,
  generatedAt: string = new Date().toISOString(),
): FlexDocHostExecutionObservationReport {
  return {
    schema: 'flexdoc.host-execution.observation/1',
    generatedAt,
    observation,
    gaps: ['browser-direct-transport-mix'],
  };
}
