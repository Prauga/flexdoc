/** Stable event names emitted by FlexDoc API-host execution observability. */
export type FlexDocHostExecutionEventName = 'flexdoc.execute.start' | 'flexdoc.execute.complete';

/** High-level completion outcome without exposing response content or credentials. */
export type FlexDocHostExecutionOutcome = 'success' | 'rejected' | 'error';

/**
 * Stable low-cardinality category for a non-successful execution.
 *
 * Rejection messages interpolate request values such as origins, field names and
 * methods, so they are unbounded and cannot be aggregated or used as a metric
 * label. These categories can.
 */
export type FlexDocHostExecutionReason =
  | 'marker-missing'
  | 'execution-disabled'
  | 'admission-saturated'
  | 'destination-forbidden'
  | 'redirect-forbidden'
  | 'body-malformed'
  | 'body-too-large'
  | 'unsupported-media-type'
  | 'request-invalid'
  | 'auth-unsupported'
  | 'upstream-timeout'
  | 'upstream-unreachable'
  | 'upstream-error';

const REASONS: readonly FlexDocHostExecutionReason[] = [
  'marker-missing',
  'execution-disabled',
  'admission-saturated',
  'destination-forbidden',
  'redirect-forbidden',
  'body-malformed',
  'body-too-large',
  'unsupported-media-type',
  'request-invalid',
  'auth-unsupported',
  'upstream-timeout',
  'upstream-unreachable',
  'upstream-error',
];

/** Whether a value is one of the stable execution reason categories. */
export function isHostExecutionReason(value: unknown): value is FlexDocHostExecutionReason {
  return typeof value === 'string' && (REASONS as readonly string[]).includes(value);
}

/** The stable reason categories, ordered for deterministic reporting. */
export function hostExecutionReasons(): readonly FlexDocHostExecutionReason[] {
  return REASONS;
}

/** Shared safe fields present on every host-execution event. */
export interface FlexDocHostExecutionEventBase {
  /** Stable event name suitable for logs, metrics bridges, and future fleet collectors. */
  name: FlexDocHostExecutionEventName;
  /** Correlation id shared by start and completion events for one execution. */
  executionId: string;
  /** ISO-8601 event timestamp. */
  timestamp: string;
  /** Supported uppercase HTTP method, or UNKNOWN when unavailable/untrusted. */
  method: string;
}

/** Event emitted when an API-host execution begins. */
export interface FlexDocHostExecutionStartEvent extends FlexDocHostExecutionEventBase {
  name: 'flexdoc.execute.start';
}

/** Event emitted when an API-host execution completes or is rejected. */
export interface FlexDocHostExecutionCompleteEvent extends FlexDocHostExecutionEventBase {
  name: 'flexdoc.execute.complete';
  /** Total execution duration measured by the emitting host. */
  durationMs: number;
  /** Coarse result category. */
  outcome: FlexDocHostExecutionOutcome;
  /** HTTP status exposed by the FlexDoc execute route when available. */
  statusCode?: number;
  /** Stable category for a rejection or upstream failure; absent on success. */
  reason?: FlexDocHostExecutionReason;
}

/** Body-free, credential-free host-execution event contract. */
export type FlexDocHostExecutionEvent = FlexDocHostExecutionStartEvent | FlexDocHostExecutionCompleteEvent;

/** Optional sink shape used by future lifecycle hooks and metrics bridges. */
export type FlexDocHostExecutionEventSink = (event: FlexDocHostExecutionEvent) => void | Promise<void>;

/** Input for a body-free host-execution start event. */
export interface CreateHostExecutionStartEventInput {
  executionId: string;
  method?: string;
  timestamp?: string;
}

/** Input for a body-free host-execution completion event. */
export interface CreateHostExecutionCompleteEventInput extends CreateHostExecutionStartEventInput {
  durationMs: number;
  outcome: FlexDocHostExecutionOutcome;
  statusCode?: number;
  reason?: FlexDocHostExecutionReason;
}

function executionId(value: string): string {
  const normalized = String(value || '').trim();
  if (!normalized) throw new Error('Host execution observability requires a non-empty execution id.');
  return normalized;
}

function method(value: string | undefined): string {
  const normalized = String(value || '').trim().toUpperCase();
  switch (normalized) {
    case 'GET':
    case 'POST':
    case 'PUT':
    case 'PATCH':
    case 'DELETE':
    case 'HEAD':
    case 'OPTIONS':
      return normalized;
    default:
      return 'UNKNOWN';
  }
}

function timestamp(value: string | undefined): string {
  if (!value) return new Date().toISOString();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error('Host execution observability requires a valid timestamp.');
  return parsed.toISOString();
}

function duration(value: number): number {
  if (!Number.isFinite(value)) throw new Error('Host execution observability requires a finite duration.');
  return Math.max(0, value);
}

function statusCode(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isInteger(value) || value < 100 || value > 599) throw new Error('Host execution observability status code must be between 100 and 599.');
  return value;
}

/** Create the canonical start event without accepting URL, headers, body, cookies, or auth material. */
export function createHostExecutionStartEvent(input: CreateHostExecutionStartEventInput): FlexDocHostExecutionStartEvent {
  return {
    name: 'flexdoc.execute.start',
    executionId: executionId(input.executionId),
    timestamp: timestamp(input.timestamp),
    method: method(input.method),
  };
}

/** Create the canonical completion event without accepting URL, headers, body, cookies, or auth material. */
export function createHostExecutionCompleteEvent(input: CreateHostExecutionCompleteEventInput): FlexDocHostExecutionCompleteEvent {
  const normalizedStatus = statusCode(input.statusCode);
  if (input.reason !== undefined && !isHostExecutionReason(input.reason)) {
    throw new Error('Host execution observability requires a known reason category.');
  }
  return {
    name: 'flexdoc.execute.complete',
    executionId: executionId(input.executionId),
    timestamp: timestamp(input.timestamp),
    method: method(input.method),
    durationMs: duration(input.durationMs),
    outcome: input.outcome,
    ...(normalizedStatus === undefined ? {} : { statusCode: normalizedStatus }),
    ...(input.reason === undefined ? {} : { reason: input.reason }),
  };
}
