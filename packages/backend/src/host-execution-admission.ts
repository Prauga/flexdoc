/** Options for the reusable host-execution admission controller. */
export interface FlexDocHostExecutionAdmissionOptions {
  /** Maximum concurrently admitted host-execution requests. Defaults to 32. */
  maxInFlight?: number;
}

/** Bounded in-flight admission controller for privileged host execution. */
export interface FlexDocHostExecutionAdmission {
  /** Configured maximum number of concurrently admitted requests. */
  readonly maxInFlight: number;
  /** Current number of admitted requests that have not yet been released. */
  readonly inFlight: number;
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
}

/**
 * Create a process-local in-flight admission controller for FlexDoc host execution.
 *
 * This is a safety/admission primitive, not authentication or distributed rate
 * limiting. Deployments with more than one process/replica should also enforce
 * caller-aware rate limits at the application or gateway boundary.
 */
export function createHostExecutionAdmission(
  options: FlexDocHostExecutionAdmissionOptions = {},
): FlexDocHostExecutionAdmission {
  const maxInFlight = options.maxInFlight ?? 32;
  if (!Number.isSafeInteger(maxInFlight) || maxInFlight < 1) {
    throw new TypeError('FlexDoc host-execution maxInFlight must be a positive safe integer.');
  }

  let inFlight = 0;
  return {
    maxInFlight,
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
