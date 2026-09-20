import { diagnoseApiClientHostExecutionFailure } from './api-client-host-preflight';

function reply(
  status: number,
  body: string,
  options: { redirected?: boolean; contentType?: string; allow?: string } = {},
): Response {
  const headers = new Headers({ 'Content-Type': options.contentType || 'application/json' });
  if (options.allow) headers.set('Allow', options.allow);
  return {
    status,
    ok: status >= 200 && status < 300,
    redirected: options.redirected === true,
    headers,
    text: async () => body,
  } as Response;
}

describe('API-host execute route failure diagnostics', () => {
  it('does nothing when no endpoint is configured', async () => {
    const fetcher = jest.fn() as unknown as typeof globalThis.fetch;
    await expect(diagnoseApiClientHostExecutionFailure('   ', fetcher)).resolves.toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('sends only a credential-free target diagnostic envelope', async () => {
    const fetcher = jest.fn(async () => reply(400, JSON.stringify({ error: 'Host execution body requires a canonical request draft.' }))) as unknown as typeof globalThis.fetch;
    await expect(diagnoseApiClientHostExecutionFailure('/docs/__flexdoc/execute', fetcher)).resolves.toBeNull();
    expect(fetcher).toHaveBeenCalledWith('/docs/__flexdoc/execute', expect.objectContaining({
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'X-FlexDoc-Execute': '1', 'Content-Type': 'application/json' },
      body: '{}',
    }));
    const init = (fetcher as unknown as jest.Mock).mock.calls[0][1] as RequestInit;
    expect(String(init.body)).not.toContain('target');
    expect(String(init.body)).not.toContain('authorization');
    expect(String(init.body)).not.toContain('secret');
  });

  it('recognizes canonical validation and admission-control responses as proof the route exists', async () => {
    const canonical = jest.fn(async () => reply(400, JSON.stringify({ error: 'Host execution body requires a canonical request draft.' }))) as unknown as typeof globalThis.fetch;
    await expect(diagnoseApiClientHostExecutionFailure('/canonical', canonical)).resolves.toBeNull();

    const busy = jest.fn(async () => reply(429, JSON.stringify({ error: 'Busy' }))) as unknown as typeof globalThis.fetch;
    await expect(diagnoseApiClientHostExecutionFailure('/busy', busy)).resolves.toBeNull();
  });

  it.each([404, 501])('diagnoses HTTP %s as an unavailable execute route', async (status) => {
    const fetcher = jest.fn(async () => reply(status, JSON.stringify({ error: 'missing' }))) as unknown as typeof globalThis.fetch;
    await expect(diagnoseApiClientHostExecutionFailure(`/missing-${status}`, fetcher)).resolves.toContain('not available');
  });

  it('diagnoses 405 as a route mismatch only when POST is not allowed', async () => {
    const missingPost = jest.fn(async () => reply(405, '', { allow: 'GET, HEAD' })) as unknown as typeof globalThis.fetch;
    await expect(diagnoseApiClientHostExecutionFailure('/method-mismatch', missingPost)).resolves.toContain('not available');

    const postAllowed = jest.fn(async () => reply(405, '', { allow: 'GET, POST' })) as unknown as typeof globalThis.fetch;
    const warning = await diagnoseApiClientHostExecutionFailure('/method-middleware', postAllowed);
    expect(warning).toContain('HTTP 405');
    expect(warning).not.toContain('not available');
  });

  it.each([
    [401, 'authentication'],
    [403, 'CSRF'],
  ])('adds actionable middleware guidance for HTTP %s', async (status, expected) => {
    const fetcher = jest.fn(async () => reply(status, JSON.stringify({ error: 'middleware' }))) as unknown as typeof globalThis.fetch;
    await expect(diagnoseApiClientHostExecutionFailure(`/middleware-${status}`, fetcher)).resolves.toContain(expected);
  });

  it('does not mistake a generic middleware 400 for the canonical FlexDoc rejection', async () => {
    const fetcher = jest.fn(async () => reply(400, '<html>CSRF token missing</html>', { contentType: 'text/html' })) as unknown as typeof globalThis.fetch;
    await expect(diagnoseApiClientHostExecutionFailure('/generic-400', fetcher)).resolves.toContain('CSRF');
  });

  it('diagnoses redirects and unexpected success pages', async () => {
    const redirected = jest.fn(async () => reply(200, '<html>login</html>', { redirected: true, contentType: 'text/html' })) as unknown as typeof globalThis.fetch;
    await expect(diagnoseApiClientHostExecutionFailure('/redirected', redirected)).resolves.toContain('redirected');

    const success = jest.fn(async () => reply(200, '<html>app shell</html>', { contentType: 'text/html' })) as unknown as typeof globalThis.fetch;
    await expect(diagnoseApiClientHostExecutionFailure('/unexpected-success', success)).resolves.toContain('hardened execute route');
  });

  it('preserves the original failure path when the diagnostic request itself cannot run', async () => {
    const fetcher = jest.fn(async () => { throw new Error('network'); }) as unknown as typeof globalThis.fetch;
    await expect(diagnoseApiClientHostExecutionFailure('/network-failure', fetcher)).resolves.toBeNull();
  });

  it('does not start a diagnostic when execution was already cancelled', async () => {
    const controller = new AbortController();
    controller.abort();
    const fetcher = jest.fn() as unknown as typeof globalThis.fetch;
    await expect(diagnoseApiClientHostExecutionFailure('/cancelled', fetcher, controller.signal)).resolves.toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('caches recognized routes for page-lifetime browser fetch diagnostics', async () => {
    const endpoint = '/cached-canonical-route';
    const originalFetch = globalThis.fetch;
    const fetcher = jest.fn(async () => reply(400, JSON.stringify({ error: 'Host execution body requires a canonical request draft.' }))) as unknown as typeof globalThis.fetch;
    globalThis.fetch = fetcher;
    try {
      await expect(diagnoseApiClientHostExecutionFailure(endpoint)).resolves.toBeNull();
      await expect(diagnoseApiClientHostExecutionFailure(endpoint)).resolves.toBeNull();
      expect(fetcher).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
