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

function createContext(authorization?: string): HonoLikeContext {
  return {
    req: {
      header: (name: string) => name.toLowerCase() === 'authorization' ? authorization : undefined,
    },
    body: (body, status = 200, headers = {}) => ({ body, status, headers }),
  };
}

describe('setupHonoFlexDoc', () => {
  let handlers: Map<string, (context: HonoLikeContext) => unknown | Promise<unknown>>;
  let app: { get: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    handlers = new Map();
    app = {
      get: jest.fn((path, handler) => {
        handlers.set(path, handler);
      }),
    };
  });

  it('registers docs, trailing slash, and immutable renderer routes', () => {
    setupHonoFlexDoc(app, '/docs', { spec: { openapi: '3.0.0' } });

    expect(handlers.has('/docs')).toBe(true);
    expect(handlers.has('/docs/')).toBe(true);
    expect(handlers.has('/docs/__flexdoc/renderer.js')).toBe(true);
    expect(handlers.has('/docs/__flexdoc/renderer.css')).toBe(true);
  });

  it('passes the shared renderer host options to the page', async () => {
    setupHonoFlexDoc(app, '/docs', {
      spec: { openapi: '3.0.0' },
      options: { theme: 'dark' },
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
      }),
    );
  });

  it('protects docs and assets with the same basic auth contract as setupFlexDoc', async () => {
    const secretKey = 'hono-secret';
    setupHonoFlexDoc(app, '/docs', {
      spec: { openapi: '3.0.0' },
      options: { auth: { type: 'basic', secretKey } },
    });

    const deniedDocs = await handlers.get('/docs')!(createContext()) as HonoResult;
    const deniedAsset = await handlers.get('/docs/__flexdoc/renderer.js')!(createContext()) as HonoResult;
    expect(deniedDocs.status).toBe(401);
    expect(deniedDocs.headers['WWW-Authenticate']).toBe('Basic');
    expect(deniedAsset.status).toBe(401);

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
