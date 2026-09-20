import {
  apiClientTransportObservation,
  createApiClientTransportRecorder,
  createApiClientTransportReport,
  resetApiClientTransportObservation,
} from './api-client-transport-observation';

const hostResponse = (overrides: Record<string, unknown> = {}) => ({
  response: { transport: 'api-host' as const, status: 200, responseTime: 100, hostRoundTripTime: 140, ...overrides },
});

const browserResponse = (overrides: Record<string, unknown> = {}) => ({
  response: { transport: 'browser' as const, status: 200, responseTime: 50, ...overrides },
});

describe('API Client transport observation', () => {
  it('reports the transport mix that an API host cannot see', () => {
    const recorder = createApiClientTransportRecorder();
    recorder.record(browserResponse());
    recorder.record(browserResponse());
    recorder.record(hostResponse());

    const observation = recorder.snapshot();
    expect(observation.executions).toBe(3);
    expect(observation.byTransport.browser.attempts).toBe(2);
    expect(observation.byTransport['api-host'].attempts).toBe(1);
    expect(observation.byTransport.browser.responses).toBe(2);
  });

  it('separates browser-to-host overhead from target latency', () => {
    const recorder = createApiClientTransportRecorder();
    recorder.record(hostResponse({ responseTime: 100, hostRoundTripTime: 140 }));
    recorder.record(hostResponse({ responseTime: 300, hostRoundTripTime: 320 }));

    const host = recorder.snapshot().byTransport['api-host'];
    expect(host.targetDurations).toMatchObject({ minMs: 100, maxMs: 300 });
    expect(host.totalDurations).toMatchObject({ minMs: 140, maxMs: 320 });
    expect(host.hostOverhead).toMatchObject({ minMs: 20, maxMs: 40 });
  });

  it('never reports negative overhead when the host reports a longer target than the round trip', () => {
    const recorder = createApiClientTransportRecorder();
    recorder.record(hostResponse({ responseTime: 200, hostRoundTripTime: 150 }));

    expect(recorder.snapshot().byTransport['api-host'].hostOverhead).toMatchObject({ minMs: 0, maxMs: 0 });
  });

  it('omits host-only duration series for browser executions', () => {
    const recorder = createApiClientTransportRecorder();
    recorder.record(browserResponse());

    const browser = recorder.snapshot().byTransport.browser;
    expect(browser.totalDurations).toMatchObject({ minMs: 50 });
    expect(browser.targetDurations).toBeNull();
    expect(browser.hostOverhead).toBeNull();
  });

  it('groups responses by status class rather than exact status', () => {
    const recorder = createApiClientTransportRecorder();
    for (const status of [200, 201, 301, 404, 503, 100]) recorder.record(browserResponse({ status }));

    expect(recorder.snapshot().byTransport.browser.statusClasses).toEqual({ '2xx': 2, '3xx': 1, '4xx': 1, '5xx': 1, other: 1 });
  });

  it('counts an attempted transport that produced no response as a failure', () => {
    const recorder = createApiClientTransportRecorder();
    recorder.record({ result: { transport: 'browser' }, failureKind: 'browser-network' });
    recorder.record({ result: { transport: 'api-host' } });

    const observation = recorder.snapshot();
    expect(observation.byTransport.browser).toMatchObject({ attempts: 1, responses: 0, failures: 1, networkFailures: 1 });
    expect(observation.byTransport['api-host']).toMatchObject({ attempts: 1, failures: 1, networkFailures: 0 });
  });

  it('categorizes executions that never reached a transport', () => {
    const recorder = createApiClientTransportRecorder();
    recorder.record({ result: {} });
    recorder.record({ scriptError: 'Pre-request script: boom' });
    recorder.record({});

    expect(recorder.snapshot().unexecuted).toEqual({ 'host-unavailable': 1, 'script-error': 1, 'request-invalid': 1 });
  });

  it('keeps unexecuted attempts out of the transport mix', () => {
    const recorder = createApiClientTransportRecorder();
    recorder.record({ result: {} });

    const observation = recorder.snapshot();
    expect(observation.executions).toBe(1);
    expect(observation.byTransport.browser.attempts).toBe(0);
    expect(observation.byTransport['api-host'].attempts).toBe(0);
  });

  it('reports exact percentiles for a known distribution', () => {
    const recorder = createApiClientTransportRecorder();
    for (let value = 1; value <= 100; value += 1) recorder.record(browserResponse({ responseTime: value }));

    expect(recorder.snapshot().byTransport.browser.totalDurations).toEqual({
      sampleCount: 100,
      sampled: false,
      minMs: 1,
      p50Ms: 50,
      p95Ms: 95,
      p99Ms: 99,
      maxMs: 100,
    });
  });

  it('bounds retained durations and marks the summary as sampled', () => {
    const recorder = createApiClientTransportRecorder({ durationSampleCapacity: 10, random: () => 0.999 });
    for (let value = 1; value <= 50; value += 1) recorder.record(browserResponse({ responseTime: value }));

    const durations = recorder.snapshot().byTransport.browser.totalDurations;
    expect(durations).toMatchObject({ sampleCount: 10, sampled: true });
    expect(recorder.snapshot().byTransport.browser.responses).toBe(50);
  });

  it('bounds the window to observed activity', () => {
    let clock = 1_000;
    const recorder = createApiClientTransportRecorder({ now: () => clock });
    expect(recorder.snapshot().windowStart).toBeNull();

    recorder.record(browserResponse());
    clock = 5_000;
    recorder.record(browserResponse());

    const observation = recorder.snapshot();
    expect(observation.windowStart).toBe(new Date(1_000).toISOString());
    expect(observation.windowEnd).toBe(new Date(5_000).toISOString());
  });

  it('resets to an empty window', () => {
    const recorder = createApiClientTransportRecorder();
    recorder.record(hostResponse());
    recorder.reset();

    const observation = recorder.snapshot();
    expect(observation).toMatchObject({ executions: 0, windowStart: null, windowEnd: null, unexecuted: {} });
    expect(observation.byTransport['api-host'].totalDurations).toBeNull();
  });

  it('declares the evidence the browser half cannot contain and names its pair', () => {
    const report = createApiClientTransportReport(createApiClientTransportRecorder().snapshot(), '2026-09-21T00:00:00.000Z');

    expect(report.schema).toBe('flexdoc.api-client.transport-observation/1');
    expect(report.pairsWith).toBe('flexdoc.host-execution.observation/1');
    expect(report.gaps).toEqual(['host-side-rejection-reasons']);
    expect(report.generatedAt).toBe('2026-09-21T00:00:00.000Z');
  });

  it('never retains urls, methods, headers, bodies or credentials', () => {
    const recorder = createApiClientTransportRecorder();
    recorder.record({
      response: {
        transport: 'api-host',
        status: 200,
        responseTime: 100,
        hostRoundTripTime: 140,
        // Fields the recorder must ignore even when handed to it.
        ...({ body: 'secret-body', headers: [['authorization', 'Bearer secret-token']] } as unknown as Record<string, never>),
      },
    });

    const vocabulary = new Set([
      'flexdoc.api-client.transport-observation/1',
      'flexdoc.host-execution.observation/1',
      'host-side-rejection-reasons',
    ]);
    const leaves: unknown[] = [];
    const walk = (value: unknown): void => {
      if (Array.isArray(value)) return value.forEach(walk);
      if (value && typeof value === 'object') return Object.values(value).forEach(walk);
      leaves.push(value);
    };
    walk(createApiClientTransportReport(recorder.snapshot()));

    for (const leaf of leaves) {
      if (typeof leaf === 'number' || typeof leaf === 'boolean' || leaf === null) continue;
      expect(typeof leaf).toBe('string');
      const text = leaf as string;
      if (vocabulary.has(text)) continue;
      expect(text).toMatch(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/);
    }
  });

  it('shares one observation across the module for operator export', () => {
    resetApiClientTransportObservation();
    expect(apiClientTransportObservation().executions).toBe(0);
  });
});
