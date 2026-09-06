import { executeApiClientRequest } from './api-client-execution';

function mockResponse(body: string, init: { status?: number; statusText?: string; headers?: HeadersInit } = {}): Response {
  return {
    status: init.status ?? 200,
    ok: (init.status ?? 200) >= 200 && (init.status ?? 200) < 300,
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

  it('routes host-only auth through the API host and keeps response tests in the browser', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetcher: typeof fetch = async (input, init) => {
      calls.push({ url: String(input), init });
      return mockResponse(JSON.stringify({
        status: 201,
        statusText: 'Created',
        headers: [['content-type', 'application/json'], ['set-cookie', 'sid=abc']],
        body: '{"ok":true}',
        responseTime: 17,
      }));
    };
    let interceptorCalls = 0;
    const outcome = await executeApiClientRequest({
      request: { method: 'POST', url: 'https://api.example.test/private', auth: { type: 'digest', username: 'u', password: 'p' } },
      scripts: { tests: "flex.test('host response', () => flex.expect(flex.response.code).to.equal(201));" },
      requestInterceptor: (request) => { interceptorCalls += 1; return request; },
      hostExecution: { available: true, endpoint: '/docs/__flexdoc/execute', capabilities: ['digest'] },
      fetcher,
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('/docs/__flexdoc/execute');
    expect(new Headers(calls[0].init?.headers).get('x-flexdoc-execute')).toBe('1');
    expect(JSON.parse(String(calls[0].init?.body)).request.auth).toMatchObject({ type: 'digest', username: 'u', password: 'p' });
    expect(interceptorCalls).toBe(0);
    expect(outcome.response).toMatchObject({ status: 201, responseTime: 17, body: '{"ok":true}' });
    expect(outcome.scriptTests).toEqual([{ name: 'host response', passed: true }]);
  });

  it('fails closed with the same explicit error when host execution is unavailable', async () => {
    let fetchCalls = 0;
    const outcome = await executeApiClientRequest({
      request: { method: 'GET', url: 'https://api.example.test/private', auth: { type: 'digest', username: 'u', password: 'p' } },
      fetcher: async () => { fetchCalls += 1; return mockResponse('unexpected'); },
    });
    expect(fetchCalls).toBe(0);
    expect(outcome.error).toBe('Host execution is disabled on this documentation server.');
    expect(outcome.result?.error).toBe(outcome.error);
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
