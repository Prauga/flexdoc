import { executeApiClientRequest } from './api-client-execution';

function mockResponse(body: string, init: { status?: number; statusText?: string; headers?: HeadersInit } = {}): Response {
  return {
    status: init.status ?? 200,
    statusText: init.statusText ?? 'OK',
    headers: new Headers(init.headers),
    text: async () => body,
  } as Response;
}

describe('api-client-execution', () => {
  it('runs pre-request scripts, fetches, runs tests, and reports mutations through one execution path', async () => {
    const built: Array<{ method: string; url: string }> = [];
    const environmentChanges: Array<{ action: 'set' | 'unset'; key: string; value?: string }> = [];
    let clock = 0;
    const fetcher: typeof fetch = async (input, init) => {
      expect(String(input)).toBe('https://api.example.test/pets/42');
      expect(new Headers(init?.headers).get('x-trace')).toBe('42');
      return mockResponse('{"id":42}', { headers: { 'content-type': 'application/json', 'x-trace': 'server' } });
    };

    const outcome = await executeApiClientRequest({
      request: { method: 'GET', url: '{{baseUrl}}/pets/{{petId}}', headers: [] },
      scripts: {
        preRequest: `
flex.variables.set('petId', '42');
flex.request.headers.set('X-Trace', '{{petId}}');
console.log('prepared');
        `,
        tests: `
flex.test('status is 200', () => flex.expect(flex.response.code).to.equal(200));
flex.test('body has id', () => flex.expect(flex.response.json()).to.have.property('id', 42));
flex.environment.set('lastPet', String(flex.response.json().id));
console.log('checked');
        `,
      },
      variables: { baseUrl: 'https://api.example.test', petId: '1' },
      environmentVariables: {},
      fetcher,
      now: () => { clock += 25; return clock; },
      onRequestBuilt: (request) => built.push({ method: request.method, url: request.url }),
      onEnvironmentChanges: (changes) => environmentChanges.push(...changes),
    });

    expect(built).toEqual([{ method: 'GET', url: 'https://api.example.test/pets/42' }]);
    expect(environmentChanges).toEqual([{ action: 'set', key: 'lastPet', value: '42' }]);
    expect(outcome.error).toBeUndefined();
    expect(outcome.scriptError).toBeUndefined();
    expect(outcome.scriptLogs).toEqual(['prepared', 'checked']);
    expect(outcome.scriptTests).toEqual([
      { name: 'status is 200', passed: true },
      { name: 'body has id', passed: true },
    ]);
    expect(outcome.response).toMatchObject({ status: 200, statusText: 'OK', body: '{"id":42}', responseTime: 25 });
    expect(outcome.result).toMatchObject({
      executedMethod: 'GET',
      resolvedUrl: 'https://api.example.test/pets/42',
      status: 200,
      responseTime: 25,
      responseBody: '{"id":42}',
    });
    expect(outcome.result?.responseHeaders).toEqual(expect.arrayContaining([['content-type', 'application/json'], ['x-trace', 'server']]));
    expect(outcome.result?.request.url).toBe('{{baseUrl}}/pets/{{petId}}');
  });

  it('applies auth resolution and request interception before fetch', async () => {
    const fetcher: typeof fetch = async (input, init) => {
      expect(String(input)).toBe('https://proxy.example.test/resource');
      expect(new Headers(init?.headers).get('authorization')).toBe('Bearer inherited-token');
      expect(new Headers(init?.headers).get('x-proxy')).toBe('yes');
      return mockResponse('ok');
    };

    const outcome = await executeApiClientRequest({
      request: { method: 'GET', url: 'https://api.example.test/resource', auth: { type: 'inherit' } },
      resolveAuth: () => ({ type: 'bearer', token: 'inherited-token' }),
      requestInterceptor: (request) => ({
        ...request,
        url: 'https://proxy.example.test/resource',
        headers: { ...Object.fromEntries(new Headers(request.headers).entries()), 'X-Proxy': 'yes' },
      }),
      fetcher,
    });

    expect(outcome.result?.resolvedUrl).toBe('https://proxy.example.test/resource');
    expect(outcome.result?.status).toBe(200);
  });

  it('aborts before fetch when the pre-request script fails', async () => {
    let fetchCalls = 0;
    const fetcher: typeof fetch = async () => {
      fetchCalls += 1;
      return mockResponse('unexpected');
    };

    const outcome = await executeApiClientRequest({
      request: { method: 'GET', url: 'https://api.example.test' },
      scripts: { preRequest: `console.log('before'); throw new Error('boom');`, tests: '' },
      fetcher,
    });

    expect(fetchCalls).toBe(0);
    expect(outcome.result).toBeUndefined();
    expect(outcome.error).toBeUndefined();
    expect(outcome.scriptLogs).toEqual(['before']);
    expect(outcome.scriptError).toContain('Pre-request script: boom');
  });

  it('returns a history-compatible result for a failed attempted request', async () => {
    let clock = 0;
    const fetcher: typeof fetch = async () => { throw new Error('offline'); };
    const outcome = await executeApiClientRequest({
      request: { method: 'POST', url: 'https://api.example.test/pets', body: '{}', contentType: 'application/json' },
      fetcher,
      now: () => { clock += 10; return clock; },
    });

    expect(outcome.error).toBe('offline');
    expect(outcome.response).toBeUndefined();
    expect(outcome.result).toMatchObject({
      executedMethod: 'POST',
      resolvedUrl: 'https://api.example.test/pets',
      responseTime: 10,
      error: 'offline',
    });
  });
});
