import type {
  FlexDocHostExecutionDurationSummary,
  FlexDocHostExecutionObservationGap,
  FlexDocHostExecutionObservationReport,
  FlexDocHostExecutionOutcomeCounts,
} from './host-execution-observation';
import type { FlexDocHostExecutionReason } from './host-execution-observability';

/**
 * Evidence a fleet document cannot contain.
 *
 * `cross-instance-duration-percentiles` appears whenever more than one instance
 * contributed: a percentile cannot be recovered from other percentiles, so the
 * merge reports the spread it can prove instead of inventing a fleet p95.
 */
export type FlexDocHostExecutionFleetGap =
  | FlexDocHostExecutionObservationGap
  | 'cross-instance-duration-percentiles';

/** One instance's percentile summary, kept so the spread stays inspectable. */
export interface FlexDocHostExecutionFleetInstanceDurations {
  /** Zero-based position of the contributing report in the input order. */ instance: number;
  sampleCount: number;
  sampled: boolean;
  minMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  maxMs: number;
}

/** Duration evidence a fleet merge can and cannot establish. */
export interface FlexDocHostExecutionFleetDurations {
  /** Instances that reported at least one completion duration. */ reportingInstances: number;
  /** Total durations retained across the fleet. */ sampleCount: number;
  /** True when any contributing instance was sampling rather than retaining everything. */ sampled: boolean;
  /** Fastest retained execution anywhere in the fleet; exact. */ minMs: number;
  /** Slowest retained execution anywhere in the fleet; exact. */ maxMs: number;
  /**
   * Fleet percentiles, present only when a single instance contributed.
   *
   * With two or more instances this is null: percentiles are not additive and the
   * retained samples are not in the per-instance documents, so any fleet value
   * here would be a guess presented as evidence.
   */
  percentiles: { p50Ms: number; p95Ms: number; p99Ms: number } | null;
  /** Per-instance summaries, so an operator can see which instance is slow. */
  perInstance: readonly FlexDocHostExecutionFleetInstanceDurations[];
  /** Widest p95 gap between any two reporting instances, in milliseconds. */
  p95SpreadMs: number;
}

/** Counts that are exactly additive across instances. */
export interface FlexDocHostExecutionFleetTotals {
  startedExecutions: number;
  unmarkedRequests: number;
  completedExecutions: number;
  outcomes: FlexDocHostExecutionOutcomeCounts;
  rejectionsByReason: Partial<Record<FlexDocHostExecutionReason, number>>;
  errorsByReason: Partial<Record<FlexDocHostExecutionReason, number>>;
}

/** Concurrency across a fleet, where only bounds are provable. */
export interface FlexDocHostExecutionFleetConcurrency {
  /** Sum of each instance's in-flight count at the moment it was read. */ inFlightAtSnapshot: number;
  /**
   * Sum of per-instance peaks.
   *
   * This is an upper bound, not an observation: the peaks may never have been
   * simultaneous. It is named as a bound so it cannot be read as a measurement.
   */
  peakInFlightUpperBound: number;
  /** Highest peak any single instance reached; exact. */ peakInFlightSingleInstanceMax: number;
}

/** Fleet-wide operator export merged from per-instance observation documents. */
export interface FlexDocHostExecutionFleetReport {
  schema: 'flexdoc.host-execution.fleet-observation/1';
  generatedAt: string;
  /** Number of per-instance documents merged. */ instanceCount: number;
  /** Union of the contributing windows: earliest start, latest end. */
  window: { start: string | null; end: string | null };
  totals: FlexDocHostExecutionFleetTotals;
  concurrency: FlexDocHostExecutionFleetConcurrency;
  durations: FlexDocHostExecutionFleetDurations | null;
  gaps: readonly FlexDocHostExecutionFleetGap[];
}

/**
 * Merge per-instance host-execution observation documents into one fleet document.
 *
 * Behind a load balancer each instance holds only the executions it happened to
 * serve, so a single export describes a fraction of the fleet and there is no
 * safe way to tell which fraction. This merge produces the document a review
 * actually needs, and is explicit about which parts of it are exact.
 *
 * Counts are additive and stay exact. Concurrency is not: per-instance peaks may
 * never have coincided, so their sum is reported as an upper bound rather than as
 * a peak. Percentiles are not additive either, and the retained samples do not
 * travel in the per-instance documents, so a fleet percentile is only reported
 * when exactly one instance contributed; otherwise the merge reports the exact
 * minimum and maximum, every per-instance summary, and the p95 spread, and
 * declares the gap.
 *
 * Collecting the per-instance documents is the application's job, exactly as
 * with the session store and the metric sink; FlexDoc adds no transport here.
 * @param reports Per-instance export documents, one per instance.
 * @param generatedAt Optional ISO-8601 generation timestamp.
 * @returns Fleet export document.
 */
export function mergeHostExecutionObservationReports(
  reports: readonly FlexDocHostExecutionObservationReport[],
  generatedAt: string = new Date().toISOString(),
): FlexDocHostExecutionFleetReport {
  if (reports.length === 0) {
    // An empty merge would report a healthy fleet of nothing, which is the one
    // answer a review must never receive from a collection failure.
    throw new TypeError('FlexDoc host-execution fleet merge requires at least one instance report.');
  }

  const totals: FlexDocHostExecutionFleetTotals = {
    startedExecutions: 0,
    unmarkedRequests: 0,
    completedExecutions: 0,
    outcomes: { success: 0, rejected: 0, error: 0 },
    rejectionsByReason: {},
    errorsByReason: {},
  };
  const concurrency: FlexDocHostExecutionFleetConcurrency = {
    inFlightAtSnapshot: 0,
    peakInFlightUpperBound: 0,
    peakInFlightSingleInstanceMax: 0,
  };

  let windowStart: number | null = null;
  let windowEnd: number | null = null;
  const perInstance: FlexDocHostExecutionFleetInstanceDurations[] = [];

  reports.forEach((report, instance) => {
    const observation = report.observation;

    totals.startedExecutions += observation.startedExecutions;
    totals.unmarkedRequests += observation.unmarkedRequests;
    totals.completedExecutions += observation.completedExecutions;
    for (const outcome of ['success', 'rejected', 'error'] as const) {
      totals.outcomes[outcome] += observation.outcomes[outcome];
    }
    mergeReasonCounts(totals.rejectionsByReason, observation.rejectionsByReason);
    mergeReasonCounts(totals.errorsByReason, observation.errorsByReason);

    concurrency.inFlightAtSnapshot += observation.inFlight;
    concurrency.peakInFlightUpperBound += observation.peakInFlight;
    concurrency.peakInFlightSingleInstanceMax = Math.max(
      concurrency.peakInFlightSingleInstanceMax,
      observation.peakInFlight,
    );

    windowStart = earlier(windowStart, observation.windowStart);
    windowEnd = later(windowEnd, observation.windowEnd);

    if (observation.durations) perInstance.push({ instance, ...observation.durations });
  });

  return {
    schema: 'flexdoc.host-execution.fleet-observation/1',
    generatedAt,
    instanceCount: reports.length,
    window: {
      start: windowStart === null ? null : new Date(windowStart).toISOString(),
      end: windowEnd === null ? null : new Date(windowEnd).toISOString(),
    },
    totals,
    concurrency,
    durations: mergeDurations(perInstance),
    gaps: reports.length === 1
      ? ['browser-direct-transport-mix']
      : ['browser-direct-transport-mix', 'cross-instance-duration-percentiles'],
  };
}

function mergeDurations(
  perInstance: readonly FlexDocHostExecutionFleetInstanceDurations[],
): FlexDocHostExecutionFleetDurations | null {
  if (perInstance.length === 0) return null;

  const p95Values = perInstance.map((entry) => entry.p95Ms);
  return {
    reportingInstances: perInstance.length,
    sampleCount: perInstance.reduce((total, entry) => total + entry.sampleCount, 0),
    sampled: perInstance.some((entry) => entry.sampled),
    minMs: Math.min(...perInstance.map((entry) => entry.minMs)),
    maxMs: Math.max(...perInstance.map((entry) => entry.maxMs)),
    percentiles: perInstance.length === 1
      ? { p50Ms: perInstance[0].p50Ms, p95Ms: perInstance[0].p95Ms, p99Ms: perInstance[0].p99Ms }
      : null,
    perInstance,
    p95SpreadMs: Math.max(...p95Values) - Math.min(...p95Values),
  };
}

function mergeReasonCounts(
  target: Partial<Record<FlexDocHostExecutionReason, number>>,
  source: Partial<Record<FlexDocHostExecutionReason, number>>,
): void {
  for (const [reason, count] of Object.entries(source) as [FlexDocHostExecutionReason, number][]) {
    target[reason] = (target[reason] ?? 0) + count;
  }
}

function earlier(current: number | null, candidate: string | null): number | null {
  const parsed = parseInstant(candidate);
  if (parsed === null) return current;
  return current === null ? parsed : Math.min(current, parsed);
}

function later(current: number | null, candidate: string | null): number | null {
  const parsed = parseInstant(candidate);
  if (parsed === null) return current;
  return current === null ? parsed : Math.max(current, parsed);
}

function parseInstant(value: string | null): number | null {
  if (value === null) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Parse and merge host-execution observation documents collected as JSON.
 *
 * Instances usually hand their export over as text, and a fleet merge is only as
 * trustworthy as its inputs: a document from an unknown schema silently merged
 * would corrupt the totals without changing their shape. Unrecognized schemas are
 * rejected by name instead.
 * @param documents Parsed JSON values, one per instance.
 * @param generatedAt Optional ISO-8601 generation timestamp.
 * @returns Fleet export document.
 */
export function mergeHostExecutionObservationDocuments(
  documents: readonly unknown[],
  generatedAt?: string,
): FlexDocHostExecutionFleetReport {
  const reports = documents.map((document, index) => {
    if (!isObservationReport(document)) {
      const schema = typeof document === 'object' && document !== null && 'schema' in document
        ? String((document as { schema: unknown }).schema)
        : 'missing';
      throw new TypeError(`FlexDoc host-execution fleet merge rejected instance ${index}: expected schema flexdoc.host-execution.observation/1, saw ${schema}.`);
    }
    return document;
  });
  return mergeHostExecutionObservationReports(reports, generatedAt);
}

function isObservationReport(value: unknown): value is FlexDocHostExecutionObservationReport {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<FlexDocHostExecutionObservationReport>;
  return candidate.schema === 'flexdoc.host-execution.observation/1'
    && typeof candidate.observation === 'object'
    && candidate.observation !== null;
}
