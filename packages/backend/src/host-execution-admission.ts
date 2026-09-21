import {
  createHostExecutionAdmissionRejectionMetricUpdate,
  emitHostExecutionMetricUpdates,
  type FlexDocHostExecutionMetricSink,
} from './host-execution-metrics';

/** Options for the reusable host-execution admission controller. */
export interface FlexDocHostExecutionAdmissionOptions {
  /** Maximum concurrently admitted host-execution requests for this instance. Defaults to 32. */
  maxInFlight?: number;
  /**
   * Maximum concurrent host-execution requests for the whole fleet, divided
   * evenly across `instances`.
   *
   * Use this instead of `maxInFlight` when the number you actually care about is
   * the load the fleet can put on an API host, which is the number an operator
   * sizes against. Requires `instances`, and cannot be combined with
   * `maxInFlight` because the two express the same limit at different scopes.
   */
  fleetMaxInFlight?: number;
  /** How many instances share `fleetMaxInFlight`. Required with it, ignored without it. */
  instances?: number;
}

/** How an admission budget was derived, for operator export and startup logs. */
export interface FlexDocHostExecutionAdmissionBudget {
  /** Whether the configured number described one instance or the whole fleet. */
  readonly scope: 'instance' | 'fleet';
  /** Concurrent executions this instance will admit. */
  readonly perInstanceMaxInFlight: number;
  /** Concurrent executions the fleet will admit, which is what reaches an API host. */
  readonly fleetMaxInFlight: number;
  /** Instances sharing the budget; 1 unless a fleet budget was declared. */
  readonly instances: number;
  /** Capacity lost to integer division, held by no instance. */
  readonly unallocated: number;
}

/** Bounded in-flight admission controller for privileged host execution. */
export interface FlexDocHostExecutionAdmission {
  /** Configured maximum number of concurrently admitted requests. */
  readonly maxInFlight: number;
  /** Current number of admitted requests that have not yet been released. */
  readonly inFlight: number;
  /** How this instance's share was derived from the configured budget. */
  readonly budget: FlexDocHostExecutionAdmissionBudget;
  /** Attempt to reserve one in-flight slot. Returns false immediately when saturated. */
  tryAcquire(): boolean;
  /** Release one previously acquired slot. Extra releases are ignored. */
  release(): void;
}

/** Minimal Node/Express-style response surface used by the middleware adapter. */
export interface FlexDocHostExecutionAdmissionResponse {
  statusCode: number;
  setHeader(name: string, value: string): unknown;
  end(body?: string): unknown;
  once?(event: 'finish' | 'close', listener: () => void): unknown;
}

/** Options for the Express/Nest-compatible admission middleware adapter. */
export interface FlexDocHostExecutionAdmissionMiddlewareOptions {
  /** Retry-After value returned with a saturated 429 response. Defaults to 1 second. */
  retryAfterSeconds?: number;
  /** Best-effort OBS-04 metric sink used to count admission-layer 429 rejections. */
  onHostExecutionMetric?: FlexDocHostExecutionMetricSink;
}

/**
 * Create an in-flight admission controller for FlexDoc host execution.
 *
 * This is a safety/admission primitive, not authentication or distributed rate
 * limiting. Deployments with more than one process/replica should also enforce
 * caller-aware rate limits at the application or gateway boundary.
 *
 * The counter is always process-local. A fleet budget is partitioned statically
 * rather than coordinated through a shared counter, because a coordinated
 * decision puts a network dependency in front of a privileged endpoint: when the
 * coordinator is unreachable, every request has to either fail open, which
 * abandons the bound that justified the controller, or fail closed, which turns a
 * coordinator outage into a FlexDoc outage. Static partitioning has neither
 * failure mode and needs no round-trip. What it gives up is borrowing: a busy
 * instance cannot use an idle instance's share.
 */
export function createHostExecutionAdmission(
  options: FlexDocHostExecutionAdmissionOptions = {},
): FlexDocHostExecutionAdmission {
  const budget = resolveAdmissionBudget(options);
  const maxInFlight = budget.perInstanceMaxInFlight;

  let inFlight = 0;
  return {
    maxInFlight,
    budget,
    get inFlight() { return inFlight; },
    tryAcquire() {
      if (inFlight >= maxInFlight) return false;
      inFlight += 1;
      return true;
    },
    release() {
      if (inFlight > 0) inFlight -= 1;
    },
  };
}

function resolveAdmissionBudget(
  options: FlexDocHostExecutionAdmissionOptions,
): FlexDocHostExecutionAdmissionBudget {
  const { maxInFlight, fleetMaxInFlight, instances } = options;

  if (fleetMaxInFlight === undefined) {
    if (instances !== undefined) {
      // Silently ignoring it would leave an operator believing a fleet budget is
      // in force while each instance actually admits the full per-instance cap.
      throw new TypeError('FlexDoc host-execution instances requires fleetMaxInFlight; a per-instance cap is not divided.');
    }
    const perInstance = maxInFlight ?? 32;
    assertPositiveInteger(perInstance, 'maxInFlight');
    return { scope: 'instance', perInstanceMaxInFlight: perInstance, fleetMaxInFlight: perInstance, instances: 1, unallocated: 0 };
  }

  if (maxInFlight !== undefined) {
    throw new TypeError('FlexDoc host-execution maxInFlight and fleetMaxInFlight cannot both be set; they are the same limit at different scopes.');
  }
  assertPositiveInteger(fleetMaxInFlight, 'fleetMaxInFlight');
  if (instances === undefined) {
    throw new TypeError('FlexDoc host-execution fleetMaxInFlight requires instances so the budget can be divided.');
  }
  assertPositiveInteger(instances, 'instances');
  if (fleetMaxInFlight < instances) {
    // Rounding up would silently exceed the fleet budget an operator asked for;
    // rounding down to zero would admit nothing. Neither is a usable default.
    throw new TypeError(`FlexDoc host-execution fleetMaxInFlight ${fleetMaxInFlight} is below instances ${instances}; each instance needs at least one slot.`);
  }

  const perInstanceMaxInFlight = Math.floor(fleetMaxInFlight / instances);
  return {
    scope: 'fleet',
    perInstanceMaxInFlight,
    fleetMaxInFlight,
    instances,
    unallocated: fleetMaxInFlight - perInstanceMaxInFlight * instances,
  };
}

function assertPositiveInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new TypeError(`FlexDoc host-execution ${name} must be a positive safe integer.`);
  }
}

/**
 * Adapt an admission controller to Express/Nest-style `(req, res, next)` middleware.
 * Mount this specifically on the FlexDoc execute endpoint, before the FlexDoc route.
 * Saturated requests fail immediately with HTTP 429 and `Retry-After`.
 */
export function createHostExecutionAdmissionMiddleware(
  admission: FlexDocHostExecutionAdmission,
  options: FlexDocHostExecutionAdmissionMiddlewareOptions = {},
): (_request: unknown, response: FlexDocHostExecutionAdmissionResponse, next: () => unknown) => void {
  const retryAfterSeconds = options.retryAfterSeconds ?? 1;
  if (!Number.isSafeInteger(retryAfterSeconds) || retryAfterSeconds < 1) {
    throw new TypeError('FlexDoc host-execution retryAfterSeconds must be a positive safe integer.');
  }

  return (_request, response, next) => {
    if (!admission.tryAcquire()) {
      emitHostExecutionMetricUpdates(options.onHostExecutionMetric, [createHostExecutionAdmissionRejectionMetricUpdate()]);
      response.statusCode = 429;
      response.setHeader('Retry-After', String(retryAfterSeconds));
      response.setHeader('Content-Type', 'application/json; charset=utf-8');
      response.setHeader('Cache-Control', 'no-store');
      response.end('{"error":"FlexDoc host execution capacity exceeded."}');
      return;
    }

    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      admission.release();
    };

    response.once?.('finish', release);
    response.once?.('close', release);
    try {
      next();
    } catch (error) {
      release();
      throw error;
    }
  };
}
