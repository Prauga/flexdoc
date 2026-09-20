import {
  createHostExecutionAdmission,
  createHostExecutionAdmissionMiddleware,
  type FlexDocHostExecutionAdmissionResponse,
} from './host-execution-admission';
import type { FlexDocHostExecutionMetricUpdate } from './host-execution-metrics';

class FakeResponse implements FlexDocHostExecutionAdmissionResponse {
  statusCode = 200;
  headers = new Map<string, string>();
  body = '';
  listeners = new Map<'finish' | 'close', Array<() => void>>();

  setHeader(name: string, value: string): void { this.headers.set(name.toLowerCase(), value); }
  end(body = ''): void { this.body = body; }
  once(event: 'finish' | 'close', listener: () => void): void {
    const listeners = this.listeners.get(event) || [];
    listeners.push(listener);
    this.listeners.set(event, listeners);
  }
  emit(event: 'finish' | 'close'): void {
    const listeners = this.listeners.get(event) || [];
    this.listeners.delete(event);
    for (const listener of listeners) listener();
  }
}

describe('host-execution admission', () => {
  it('fails acquisition immediately at the configured in-flight cap', () => {
    const admission = createHostExecutionAdmission({ maxInFlight: 2 });
    expect(admission.tryAcquire()).toBe(true);
    expect(admission.tryAcquire()).toBe(true);
    expect(admission.inFlight).toBe(2);
    expect(admission.tryAcquire()).toBe(false);
    expect(admission.inFlight).toBe(2);
    admission.release();
    expect(admission.tryAcquire()).toBe(true);
    expect(admission.inFlight).toBe(2);
  });

  it('returns 429 Retry-After and emits an admission rejection metric when capacity is saturated', () => {
    const admission = createHostExecutionAdmission({ maxInFlight: 1 });
    const metrics: FlexDocHostExecutionMetricUpdate[] = [];
    const middleware = createHostExecutionAdmissionMiddleware(admission, {
      retryAfterSeconds: 2,
      onHostExecutionMetric: (update) => { metrics.push(update); },
    });
    const first = new FakeResponse();
    const second = new FakeResponse();
    let firstNext = 0;
    let secondNext = 0;

    middleware({}, first, () => { firstNext += 1; });
    middleware({}, second, () => { secondNext += 1; });

    expect(firstNext).toBe(1);
    expect(secondNext).toBe(0);
    expect(second.statusCode).toBe(429);
    expect(second.headers.get('retry-after')).toBe('2');
    expect(second.headers.get('cache-control')).toBe('no-store');
    expect(second.body).toContain('capacity exceeded');
    expect(admission.inFlight).toBe(1);
    expect(metrics).toEqual([{
      name: 'flexdoc_execute_rejections_total',
      kind: 'counter',
      value: 1,
      labels: { source: 'admission', statusCode: 429, reason: 'admission-saturated' },
    }]);

    first.emit('finish');
    first.emit('close');
    expect(admission.inFlight).toBe(0);
  });

  it('keeps metric sink failures off the admission path', () => {
    const admission = createHostExecutionAdmission({ maxInFlight: 1 });
    const middleware = createHostExecutionAdmissionMiddleware(admission, {
      onHostExecutionMetric: () => { throw new Error('metrics failed'); },
    });
    const first = new FakeResponse();
    const second = new FakeResponse();

    middleware({}, first, () => undefined);
    expect(() => middleware({}, second, () => undefined)).not.toThrow();
    expect(second.statusCode).toBe(429);
    expect(second.body).toContain('capacity exceeded');
  });

  it('releases an acquired slot when downstream middleware throws', () => {
    const admission = createHostExecutionAdmission({ maxInFlight: 1 });
    const middleware = createHostExecutionAdmissionMiddleware(admission);
    const response = new FakeResponse();

    expect(() => middleware({}, response, () => { throw new Error('boom'); })).toThrow('boom');
    expect(admission.inFlight).toBe(0);
    expect(admission.tryAcquire()).toBe(true);
  });

  it('rejects invalid limits instead of silently disabling admission', () => {
    expect(() => createHostExecutionAdmission({ maxInFlight: 0 })).toThrow(/positive safe integer/);
    const admission = createHostExecutionAdmission();
    expect(() => createHostExecutionAdmissionMiddleware(admission, { retryAfterSeconds: 0 })).toThrow(/positive safe integer/);
  });
});
