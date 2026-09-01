jest.mock('./renderer-assets', () => ({
  getRendererAssets: () => ({
    javascript: 'renderer-js',
    css: 'renderer-css',
    version: 'test-renderer-version',
  }),
}));
jest.mock('./template', () => ({ generateFlexDocHTML: jest.fn(() => '<html>docs</html>') }));

import { setupFastifyFlexDoc, setupFastifySwaggerFlexDoc } from './framework-adapters';
import { generateFlexDocHTML } from './template';

function replyState() {
  const state: any = { headers: {} };
  const reply: any = {
    type(value: string) { state.type = value; return this; },
    header(name: string, value: string) { state.headers[name] = value; return this; },
    code(value: number) { state.code = value; return this; },
    send(value: any) { state.body = value; return value; },
  };
  return { state, reply };
}

describe('setupFastifyFlexDoc', () => {
  beforeEach(() => jest.clearAllMocks());

  it('registers native Fastify docs and renderer routes', async () => {
    const routes = new Map<string, any>();
    const app = { get: (path: string, options: any, handler: any) => routes.set(path, { options, handler }) };
    setupFastifyFlexDoc(app, '/docs', { spec: { openapi: '3.1.0', info: { title: 'T', version: '1' }, paths: {} } });

    expect([...routes.keys()]).toEqual(['/docs/__flexdoc/renderer.js', '/docs/__flexdoc/renderer.css', '/docs']);
    const { state, reply } = replyState();
    await routes.get('/docs').handler({ headers: {} }, reply);
    expect(state.body).toBe('<html>docs</html>');
    expect(generateFlexDocHTML).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ rendererVersion: 'test-renderer-version' })
    );
  });

  it('protects Fastify routes when docs auth is configured', async () => {
    const routes = new Map<string, any>();
    const app = { get: (path: string, options: any, handler: any) => routes.set(path, { options, handler }) };
    setupFastifyFlexDoc(app, '/docs', { spec: {}, options: { auth: { type: 'basic', secretKey: 'secret' } } });
    const preHandler = routes.get('/docs').options.preHandler;
    const { state, reply } = replyState();
    await preHandler({ headers: {} }, reply);
    expect(state.code).toBe(401);
  });

  it('resolves @fastify/swagger only after Fastify is ready', async () => {
    const routes = new Map<string, any>();
    let ready = false;
    const spec = { openapi: '3.1.0', info: { title: 'Generated', version: '1' }, paths: {} };
    const swagger = jest.fn(() => {
      if (!ready) throw new Error('swagger called before ready');
      return spec;
    });
    const app = {
      get: (path: string, options: any, handler: any) => routes.set(path, { options, handler }),
      ready: jest.fn(async () => { ready = true; }),
      swagger,
    };

    setupFastifySwaggerFlexDoc(app, '/docs');
    expect(app.ready).not.toHaveBeenCalled();
    expect(swagger).not.toHaveBeenCalled();

    const { reply } = replyState();
    await routes.get('/docs').handler({ headers: {} }, reply);

    expect(app.ready).toHaveBeenCalledTimes(1);
    expect(swagger).toHaveBeenCalledTimes(1);
    expect(generateFlexDocHTML).toHaveBeenCalledWith(spec, expect.any(Object));
  });
});
