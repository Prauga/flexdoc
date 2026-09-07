import { generateFlexDocPassword } from './auth';
import { setupHonoFlexDoc, HonoLikeContext } from './hono-adapter';
import { generateFlexDocHTML } from './template';

jest.mock('./template', () => ({
  generateFlexDocHTML: jest.fn().mockReturnValue('<html>Hono docs</html>'),
}));

jest.mock('./renderer-assets', () => ({
  getRendererAssets: jest.fn().mockReturnValue({
    javascript: 'window.renderer = true;',
    css: '.renderer { display: block; }',
    version: 'hono-test-version',
  }),
}));

type HonoResult = {
  body: string | Uint8Array;
  status: number;
  headers: Record<string, string>;
};

function createContext(authorization?: string, extraHeaders: Record<string, string> = {}, rawUrl?: string): HonoLikeContext {
  return {
    req: {
      header: (name: string) => {
        const normalized = name.toLowerCase();
        if (normalized === 'authorization') return authorization;
        return extraHeaders[normalized];
      },
      ...(rawUrl ? { raw: new Request(rawUrl) } : {}),
    },
    body: (body, status = 200, headers = {}) => ({ body, status, headers }),
  };
}

describe('setupHonoFlexDoc', () => {
  let handlers: Map<string, (context: HonoLikeContext) => unknown | Promise<unknown>>;
  let app: { get: jest.Mock; post: jest.Mock; delete: jest.Mock; routes: Array<{ method: string; path: string }> };

  beforeEach(() => {
    jest.clearAllMocks();
    handlers = new Map();
    app = {
      routes: [],
      get: jest.fn((path, handler) => { app.routes.push({ method: 'GET', path }); handlers.set(path, handler); }),
      post: jest.fn((path, handler) => { app.routes.push({ method: 'POST', path }); handlers.set(path, handler); }),
      delete: jest.fn((path, handler) => { app.routes.push({ method: 'DELETE', path }); handlers.set(`DELETE ${path}`, handler); }),
    };
  });

  it('registers docs, trailing slash, and immutable renderer routes', () => {
    setupHonoFlexDoc(app, '/docs', { spec: { openapi: '3.0.0' } });

    expect(handlers.has('/docs')).toBe(true);
    expect(handlers.has('/docs/')).toBe(true);
    expect(handlers.has('/docs/__flexdoc/renderer.js')).toBe(true);
    expect(handlers.has('/docs/__flexdoc/renderer.css')).toBe(true);
    expect(handlers.has('/docs/__flexdoc/execute')).toBe(false);
    expect(handlers.has('/docs/__flexdoc/cookies')).toBe(false);
    expect(handlers.has('/docs/__flexdoc/runtime')).toBe(false);
  });

  it('passes the shared renderer host options to the page', async () => {
    setupHonoFlexDoc(app, '/docs', {
      spec: { openapi: '3.0.0' },
      options: { theme: 'dark', tryIt: { hostExecution: true } },
    });

    const result = await handlers.get('/docs')!(createContext()) as HonoResult;
    expect(result.status).toBe(200);
    expect(result.headers['Cache-Control']).toBe('no-cache');
    expect(generateFlexDocHTML).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        theme: 'dark',
        rendererBasePath: '/docs/__flexdoc',
        rendererVersion: 'hono-test-version',
        hostExecutionPublic: expect.objectContaining({ available: true, endpoint: '/docs/__flexdoc/execute' }),
      }),
    );
    expect(result.headers.ETag).toMatch(/^"/);

    await handlers.get('/docs/')!(createContext());
    expect(generateFlexDocHTML).toHaveBeenCalledTimes(1);

    const revalidated = await handlers.get('/docs')!(createContext(undefined, { 'if-none-match': result.headers.ETag })) as HonoResult;
    expect(revalidated.status).toBe(304);
    expect(generateFlexDocHTML).toHaveBeenCalledTimes(1);
  });

  it('exposes live Hono route presence and runtime metadata when opted in', async () => {
    app.routes.push(
      { method: 'GET', path: '/pets' },
      { method: 'POST', path: '/internal/reindex' },
    );
    setupHonoFlexDoc(app, '/docs', {
      spec: { openapi: '3.1.0', paths: { '/pets': { get: {} } } },
      options: { runtimeIntelligence: true },
    });

    expect(handlers.has('/docs/__flexdoc/runtime')).toBe(true);
    const result = await handlers.get('/docs/__flexdoc/runtime')!(createContext(undefined, {}, 'https://api.example.test/docs/__flexdoc/runtime')) as HonoResult;
    const snapshot = JSON.parse(String(result.body));
    expect(result.status).toBe(200);
    expect(result.headers['Cache-Control']).toBe('no-store');
    expect(snapshot.framework).toBe('hono');
    expect(snapshot.runtime.name).toBe('node');
    expect(snapshot.serverOrigin).toBe('https://api.example.test');
    expect(snapshot.summary).toEqual({ documented: 1, runtime: 2, matched: 1, runtimeOnly: 1, documentedOnly: 0 });
    expect(snapshot.runtimeOnly).toEqual([{ method: 'POST', path: '/internal/reindex' }]);

    await handlers.get('/docs')!(createContext());
    expect(generateFlexDocHTML).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ runtimeIntelligencePublic: { available: true, endpoint: '/docs/__flexdoc/runtime', framework: 'hono' } }),
    );
  });

  it('protects docs, assets, and runtime intelligence with the same basic auth contract', async () => {
    const secretKey = 'hono-secret';
    setupHonoFlexDoc(app, '/docs', {
      spec: { openapi: '3.0.0' },
      options: { auth: { type: 'basic', secretKey }, runtimeIntelligence: true },
    });

    const deniedDocs = await handlers.get('/docs')!(createContext()) as HonoResult;
    const deniedAsset = await handlers.get('/docs/__flexdoc/renderer.js')!(createContext()) as HonoResult;
    const deniedRuntime = await handlers.get('/docs/__flexdoc/runtime')!(createContext()) as HonoResult;
    expect(deniedDocs.status).toBe(401);
    expect(deniedDocs.headers['WWW-Authenticate']).toBe('Basic');
    expect(deniedAsset.status).toBe(401);
    expect(deniedRuntime.status).toBe(401);

    const username = 'alice';
    const password = generateFlexDocPassword(username, secretKey);
    const authorization = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
    const allowed = await handlers.get('/docs')!(createContext(authorization)) as HonoResult;
    expect(allowed.status).toBe(200);
  });

  it('serves renderer assets with immutable caching', async () => {
    setupHonoFlexDoc(app, '/docs', { spec: { openapi: '3.0.0' } });
    const result = await handlers.get('/docs/__flexdoc/renderer.css')!(createContext()) as HonoResult;

    expect(result.status).toBe(200);
    expect(result.headers['Cache-Control']).toContain('immutable');
    expect(result.body).toBe('.renderer { display: block; }');
  });
});
