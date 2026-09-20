import { executeApiClientRequest } from './api-client-execution';
import { apiClientTransportObservation, resetApiClientTransportObservation } from './api-client-transport-observation';

function mockResponse(body: string, init: { status?: number; statusText?: string; headers?: HeadersInit } = {}): Response {
  const status = init.status ?? 200;
  return {
    status,
    ok: status >= 200 && status < 300,
    statusText: init.statusText ?? 'OK',
    headers: new Headers(init.headers),
    text: async () => body,
  } as Response;
}

const hostSnapshot = (responseTime: number) => JSON.stringify({ status: 200, statusText: 'OK', headers: [['content-type', 'application/json']], body: '{}', responseTime });

describe('execution feeds the transport observation', () => {
  beforeEach(() => resetApiClientTransportObservation());

  it('records a browser execution with its elapsed time', async () => {
    let clock = 0;
    await executeApiClientRequest({
      request: { method: 'GET', url: 'https://api.example.test/pets' },
      fetcher: async () => mockResponse('[]'),
      now: () => { clock += 30; return clock; },
    });

    const observation = apiClientTransportObservation();
    expect(observation.executions).toBe(1);
    expect(observation.byTransport.browser).toMatchObject({ attempts: 1, responses: 1, failures: 0 });
    expect(observation.byTransport.browser.statusClasses['2xx']).toBe(1);
    expect(observation.byTransport.browser.totalDurations).not.toBeNull();
  });

  it('records an API-host execution with its target time and derived overhead', async () => {
    let clock = 0;
    await executeApiClientRequest({
      request: { method: 'GET', url: 'https://api.example.test/pets' },
      hostExecution: { available: true, endpoint: '/docs/__flexdoc/execute', capabilities: [] },
      preferHostExecution: true,
      fetcher: async () => mockResponse(hostSnapshot(100)),
      now: () => { clock += 140; return clock; },
    });

    const host = apiClientTransportObservation().byTransport['api-host'];
    expect(host).toMatchObject({ attempts: 1, responses: 1 });
    expect(host.targetDurations).toMatchObject({ minMs: 100 });
    expect(host.totalDurations).toMatchObject({ minMs: 140 });
    expect(host.hostOverhead).toMatchObject({ minMs: 40 });
  });

  it('records a browser network failure as a failed browser attempt', async () => {
    await executeApiClientRequest({
      request: { method: 'GET', url: 'https://api.example.test/pets' },
      fetcher: async () => { throw new TypeError('Failed to fetch'); },
    });

    expect(apiClientTransportObservation().byTransport.browser).toMatchObject({ attempts: 1, responses: 0, failures: 1, networkFailures: 1 });
  });

  it('records a host-required request with no available host as unexecuted', async () => {
    await executeApiClientRequest({
      request: { method: 'GET', url: 'https://api.example.test/pets', auth: { type: 'digest', username: 'a', password: 'b' } },
      hostExecution: { available: false, endpoint: '/docs/__flexdoc/execute', capabilities: [] },
      fetcher: async () => mockResponse('[]'),
    });

    const observation = apiClientTransportObservation();
    expect(observation.unexecuted).toEqual({ 'host-unavailable': 1 });
    expect(observation.byTransport.browser.attempts).toBe(0);
  });

  it('records a pre-request script failure as unexecuted rather than a transport attempt', async () => {
    const outcome = await executeApiClientRequest({
      request: { method: 'GET', url: 'https://api.example.test/pets' },
      scripts: { preRequest: 'throw new Error("boom");' },
      fetcher: async () => mockResponse('[]'),
    });

    expect(outcome.scriptError).toContain('Pre-request script');
    expect(apiClientTransportObservation().unexecuted).toEqual({ 'script-error': 1 });
  });

  it('records every execution exactly once across mixed transports', async () => {
    const run = (hostAvailable: boolean) => executeApiClientRequest({
      request: { method: 'GET', url: 'https://api.example.test/pets' },
      ...(hostAvailable ? { hostExecution: { available: true, endpoint: '/docs/__flexdoc/execute', capabilities: [] }, preferHostExecution: true } : {}),
      fetcher: async () => mockResponse(hostAvailable ? hostSnapshot(10) : '[]'),
    });

    await run(false);
    await run(true);
    await run(false);

    const observation = apiClientTransportObservation();
    expect(observation.executions).toBe(3);
    expect(observation.byTransport.browser.attempts + observation.byTransport['api-host'].attempts).toBe(3);
  });
});
