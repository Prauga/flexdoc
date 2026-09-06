import * as http from 'http';
import { allowedHostExecutionOrigins, assertHostExecutionResolvedAddressAllowed, createHostExecutionState, ensureHostExecutionSession, isCookieDomainAllowed } from './host-execution';
import { hostExecutionRequestOrigin, parseHostExecutionRequestBody, runHostExecutionRoute } from './host-execution-route';

function headers(contentType = 'application/json'): Record<string, string> {
  return { 'content-type': contentType, 'x-flexdoc-execute': '1' };
}

function sessionCookie(result: { headers: Record<string, string> }): string {
  return (result.headers['Set-Cookie'] || '').split(';', 1)[0];
}

describe('host execution HTTP protocol', () => {
  it('parses multipart descriptor and indexed browser file parts', () => {
    const boundary = 'flexdoc-test-boundary';
    const descriptor = JSON.stringify({ request: { method: 'POST', url: 'https://api.example.test/upload', bodyMode: 'formdata', formData: [{ key: 'photo', type: 'file', enabled: true }] } });
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="descriptor"\r\n\r\n${descriptor}\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="formData[0]"; filename="photo.txt"\r\nContent-Type: text/plain\r\n\r\n`),
      Buffer.from('hello-file'),
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    const parsed = parseHostExecutionRequestBody(`multipart/form-data; boundary=${boundary}`, body);
    expect(parsed.request.bodyMode).toBe('formdata');
    expect(parsed.formDataFiles?.get(0)).toMatchObject({ name: 'photo.txt', contentType: 'text/plain' });
    expect(parsed.formDataFiles?.get(0)?.data.toString()).toBe('hello-file');
  });

  it('requires the renderer custom header', async () => {
    const state = createHostExecutionState({ allowedOrigins: ['https://api.example.test'] });
    const result = await runHostExecutionRoute({ state, spec: {}, headers: { 'content-type': 'application/json' }, body: { request: { method: 'GET', url: 'https://api.example.test' } } });
    expect(result.status).toBe(403);
  });

  it('resolves relative OpenAPI servers against the documentation request origin', async () => {
    const server = http.createServer((_request, response) => response.end('same-origin'));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('test server address unavailable');
    const origin = `http://127.0.0.1:${address.port}`;
    try {
      const state = createHostExecutionState(true);
      const result = await runHostExecutionRoute({
        state,
        spec: { servers: [{ url: '/' }] },
        headers: headers(),
        body: { request: { method: 'GET', url: `${origin}/ping` } },
        docsOrigin: origin,
      });
      expect(result.status).toBe(200);
      expect(JSON.parse(result.body).body).toBe('same-origin');
      expect([...allowedHostExecutionOrigins(state, { servers: [{ url: 'https://api.example.test' }] }, origin)]).toEqual(['https://api.example.test']);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });

  it('derives the docs origin without trusting an arbitrary renderer draft header', () => {
    expect(hostExecutionRequestOrigin({ headers: { host: 'docs.example.test:8443' }, protocol: 'https' })).toBe('https://docs.example.test:8443');
    expect(hostExecutionRequestOrigin({ headers: {}, url: 'https://docs.example.test/docs/__flexdoc/execute' })).toBe('https://docs.example.test');
    expect(hostExecutionRequestOrigin({ headers: { host: 'docs.example.test' }, protocol: 'ftp' })).toBeUndefined();
  });

  it('rejects DNS answers that resolve to metadata or link-local addresses', () => {
    expect(() => assertHostExecutionResolvedAddressAllowed('169.254.169.254')).toThrow('DNS resolutions');
    expect(() => assertHostExecutionResolvedAddressAllowed('fe80::a9fe:a9fe')).toThrow('DNS resolutions');
    expect(() => assertHostExecutionResolvedAddressAllowed('::ffff:169.254.169.254')).toThrow('DNS resolutions');
    expect(() => assertHostExecutionResolvedAddressAllowed('10.0.0.10')).not.toThrow();
  });

  it('rejects public-suffix cookie domains while allowing registrable parent domains', () => {
    expect(isCookieDomainAllowed('api.example.com', 'example.com')).toBe(true);
    expect(isCookieDomainAllowed('foo.com', 'com')).toBe(false);
    expect(isCookieDomainAllowed('foo.example.co.uk', 'co.uk')).toBe(false);
    expect(isCookieDomainAllowed('bucket.s3.amazonaws.com', 's3.amazonaws.com')).toBe(false);
    expect(isCookieDomainAllowed('api.example.com', 'other.com')).toBe(false);
    expect(isCookieDomainAllowed('127.0.0.1', '127.0.0.1')).toBe(false);
  });

  it('rejects response cookies whose Domain does not match the response host', async () => {
    const server = http.createServer((_request, response) => {
      response.setHeader('Set-Cookie', 'sid=abc; Domain=example.com; Path=/');
      response.end('ok');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('test server address unavailable');
    const origin = `http://127.0.0.1:${address.port}`;
    try {
      const result = await runHostExecutionRoute({
        state: createHostExecutionState({ allowedOrigins: [origin] }),
        spec: {},
        headers: headers(),
        body: { request: { method: 'GET', url: origin }, cookieJar: 'session' },
      });
      expect(result.status).toBe(200);
      expect(JSON.parse(result.body).cookies).toEqual([]);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });

  it('rejects metadata and unlisted origins before network execution', async () => {
    const metadataState = createHostExecutionState({ allowedOrigins: ['http://169.254.169.254'] });
    const metadata = await runHostExecutionRoute({ state: metadataState, spec: {}, headers: headers(), body: { request: { method: 'GET', url: 'http://169.254.169.254/latest/meta-data' } } });
    expect(metadata.status).toBe(403);
    expect(metadata.body).toContain('metadata');

    const state = createHostExecutionState({ allowedOrigins: ['https://api.example.test'] });
    const random = await runHostExecutionRoute({ state, spec: {}, headers: headers(), body: { request: { method: 'GET', url: 'https://other.example.test' } } });
    expect(random.status).toBe(403);
    expect(random.body).toContain('not allowed');
  });

  it('executes an explicitly allowed origin and keeps a cookie jar isolated by signed docs session', async () => {
    const server = http.createServer((request, response) => {
      if (request.url === '/set') {
        response.setHeader('Set-Cookie', 'sid=abc; Path=/; HttpOnly');
        response.end('set');
        return;
      }
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({ cookie: request.headers.cookie || '' }));
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('test server address unavailable');
    const origin = `http://127.0.0.1:${address.port}`;
    const state = createHostExecutionState({ allowedOrigins: [origin] });
    try {
      const first = await runHostExecutionRoute({
        state,
        spec: {},
        headers: headers(),
        body: { request: { method: 'GET', url: `${origin}/set` }, cookieJar: 'session' },
      });
      expect(first.status).toBe(200);
      const firstSnapshot = JSON.parse(first.body);
      expect(firstSnapshot.status).toBe(200);
      expect(firstSnapshot.cookies).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'sid', value: 'abc', httpOnly: true })]));
      const cookie = sessionCookie(first);
      expect(cookie).toContain('__flexdoc_session=');

      const second = await runHostExecutionRoute({
        state,
        spec: {},
        headers: { ...headers(), cookie },
        body: { request: { method: 'GET', url: `${origin}/echo` }, cookieJar: 'session' },
      });
      expect(second.status).toBe(200);
      expect(JSON.parse(JSON.parse(second.body).body)).toEqual({ cookie: 'sid=abc' });

      const isolated = await runHostExecutionRoute({
        state,
        spec: {},
        headers: headers(),
        body: { request: { method: 'GET', url: `${origin}/echo` }, cookieJar: 'session' },
      });
      expect(JSON.parse(JSON.parse(isolated.body).body)).toEqual({ cookie: '' });
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });

  it('decodes binary bodyBase64 on the host path', async () => {
    const server = http.createServer((request, response) => {
      const chunks: Buffer[] = [];
      request.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      request.on('end', () => response.end(Buffer.concat(chunks).toString('hex')));
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('test server address unavailable');
    const origin = `http://127.0.0.1:${address.port}`;
    try {
      const result = await runHostExecutionRoute({
        state: createHostExecutionState({ allowedOrigins: [origin] }),
        spec: {},
        headers: headers(),
        body: { request: { method: 'POST', url: origin, bodyMode: 'binary', binary: { fileName: 'blob.bin', contentType: 'application/octet-stream' } }, bodyBase64: Buffer.from([0, 1, 2, 255]).toString('base64') },
      });
      expect(result.status).toBe(200);
      expect(JSON.parse(result.body).body).toBe('000102ff');
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });

  it('keeps host execution off unless the docs host explicitly opts in', () => {
    expect(createHostExecutionState(undefined).enabled).toBe(false);
    expect(createHostExecutionState(false).enabled).toBe(false);
    expect(createHostExecutionState(true).enabled).toBe(true);
    expect(createHostExecutionState({}).enabled).toBe(true);
    expect(createHostExecutionState({ enabled: false }).enabled).toBe(false);
  });

  it('does not allocate a cookie session for ordinary host execution', async () => {
    const server = http.createServer((_request, response) => response.end('ok'));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('test server address unavailable');
    const origin = `http://127.0.0.1:${address.port}`;
    const state = createHostExecutionState({ allowedOrigins: [origin] });
    try {
      const result = await runHostExecutionRoute({
        state,
        spec: {},
        headers: headers(),
        body: { request: { method: 'GET', url: origin } },
      });
      expect(result.status).toBe(200);
      expect(result.headers['Set-Cookie']).toBeUndefined();
      expect(state.jars.size).toBe(0);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });

  it('bounds signed cookie-jar sessions', () => {
    const state = createHostExecutionState(true);
    for (let index = 0; index < 1050; index += 1) ensureHostExecutionSession(state);
    expect(state.jars.size).toBeLessThanOrEqual(1000);
  });

  it('rejects cross-origin redirects even when both origins are allowlisted', async () => {
    let redirectedAuthorization: string | undefined;
    const target = http.createServer((request, response) => {
      redirectedAuthorization = request.headers.authorization;
      response.end('unexpected');
    });
    await new Promise<void>((resolve) => target.listen(0, '127.0.0.1', resolve));
    const targetAddress = target.address();
    if (!targetAddress || typeof targetAddress === 'string') throw new Error('target server address unavailable');
    const targetOrigin = `http://127.0.0.1:${targetAddress.port}`;

    const source = http.createServer((_request, response) => {
      response.statusCode = 302;
      response.setHeader('Location', `${targetOrigin}/redirected`);
      response.end();
    });
    await new Promise<void>((resolve) => source.listen(0, '127.0.0.1', resolve));
    const sourceAddress = source.address();
    if (!sourceAddress || typeof sourceAddress === 'string') throw new Error('source server address unavailable');
    const sourceOrigin = `http://127.0.0.1:${sourceAddress.port}`;

    try {
      const result = await runHostExecutionRoute({
        state: createHostExecutionState({ allowedOrigins: [sourceOrigin, targetOrigin] }),
        spec: {},
        headers: headers(),
        body: { request: { method: 'GET', url: `${sourceOrigin}/start`, auth: { type: 'bearer', token: 'secret-token' } } },
      });
      expect(result.status).toBe(403);
      expect(result.body).toContain('cross-origin redirects');
      expect(redirectedAuthorization).toBeUndefined();
    } finally {
      await new Promise<void>((resolve, reject) => source.close((error) => error ? reject(error) : resolve()));
      await new Promise<void>((resolve, reject) => target.close((error) => error ? reject(error) : resolve()));
    }
  });

});
