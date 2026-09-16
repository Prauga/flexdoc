import { preflightApiClientHostExecution } from './api-client-host-preflight';

function reply(status: number, body: string, options: { redirected?: boolean; contentType?: string } = {}): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    redirected: options.redirected === true,
    headers: new Headers({ 'Content-Type': options.contentType || 'application/json' }),
    text: async () => body,
  } as Response;
}

describe('API-host execute route preflight', () => {
  it('recognizes the deliberate FlexDoc canonical-envelope rejection as reachable', async () => {
    const fetcher = jest.fn(async () => reply(400, JSON.stringify({ error: 'Host execution body requires a canonical request draft.' }))) as unknown as typeof globalThis.fetch;
    await expect(preflightApiClientHostExecution('/docs/__flexdoc/execute', fetcher)).resolves.toBeNull();
    expect(fetcher).toHaveBeenCalledWith('/docs/__flexdoc/execute', expect.objectContaining({
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'X-FlexDoc-Execute': '1', 'Content-Type': 'application/json' },
      body: '{}',
    }));
  });

  it('accepts admission-control 429 as proof that the protected execute route is reachable', async () => {
    const fetcher = jest.fn(async () => reply(429, JSON.stringify({ error: 'Busy' }))) as unknown as typeof globalThis.fetch;
    await expect(preflightApiClientHostExecution('/execute', fetcher)).resolves.toBeNull();
  });

  it.each([
    [401, 'authentication'],
    [403, 'CSRF'],
    [404, 'mount order'],
    [405, 'mount order'],
  ])('diagnoses HTTP %s integration failures', async (status, expected) => {
    const fetcher = jest.fn(async () => reply(status, JSON.stringify({ error: 'middleware' }))) as unknown as typeof globalThis.fetch;
    const warning = await preflightApiClientHostExecution('/execute', fetcher);
    expect(warning).toContain(expected);
  });

  it('does not mistake a generic middleware 400 for the FlexDoc envelope rejection', async () => {
    const fetcher = jest.fn(async () => reply(400, '<html>CSRF token missing</html>', { contentType: 'text/html' })) as unknown as typeof globalThis.fetch;
    const warning = await preflightApiClientHostExecution('/execute', fetcher);
    expect(warning).toContain('CSRF');
  });

  it('diagnoses authentication redirects and unexpected success pages', async () => {
    const redirected = jest.fn(async () => reply(200, '<html>login</html>', { redirected: true, contentType: 'text/html' })) as unknown as typeof globalThis.fetch;
    await expect(preflightApiClientHostExecution('/execute', redirected)).resolves.toContain('redirected');

    const success = jest.fn(async () => reply(200, '<html>app shell</html>', { contentType: 'text/html' })) as unknown as typeof globalThis.fetch;
    await expect(preflightApiClientHostExecution('/execute', success)).resolves.toContain('unexpected success');
  });

  it('diagnoses transport failures without throwing', async () => {
    const fetcher = jest.fn(async () => { throw new Error('network'); }) as unknown as typeof globalThis.fetch;
    await expect(preflightApiClientHostExecution('/execute', fetcher)).resolves.toContain('could not reach');
  });
});
