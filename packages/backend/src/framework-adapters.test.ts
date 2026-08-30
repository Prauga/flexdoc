jest.mock('./renderer-assets', () => ({ getRendererAssets: () => ({ javascript: 'renderer-js', css: 'renderer-css' }) }));
jest.mock('./template', () => ({ generateFlexDocHTML: jest.fn(() => '<html>docs</html>') }));

import { setupFastifyFlexDoc } from './framework-adapters';
import { generateFlexDocHTML } from './template';

describe('setupFastifyFlexDoc', () => {
  it('registers native Fastify docs and renderer routes', async () => {
    const routes = new Map<string, any>();
    const app = { get: (path: string, options: any, handler: any) => routes.set(path, { options, handler }) };
    setupFastifyFlexDoc(app, '/docs', { spec: { openapi: '3.1.0', info: { title: 'T', version: '1' }, paths: {} } });

    expect([...routes.keys()]).toEqual(['/docs/__flexdoc/renderer.js', '/docs/__flexdoc/renderer.css', '/docs']);
    const state: any = { headers: {} };
    const reply: any = {
      type(value: string) { state.type = value; return this; },
      header(name: string, value: string) { state.headers[name] = value; return this; },
      code(value: number) { state.code = value; return this; },
      send(value: any) { state.body = value; return value; },
    };
    await routes.get('/docs').handler({ headers: {} }, reply);
    expect(state.body).toBe('<html>docs</html>');
    expect(generateFlexDocHTML).toHaveBeenCalled();
  });

  it('protects Fastify routes when docs auth is configured', async () => {
    const routes = new Map<string, any>();
    const app = { get: (path: string, options: any, handler: any) => routes.set(path, { options, handler }) };
    setupFastifyFlexDoc(app, '/docs', { spec: {}, options: { auth: { type: 'basic', secretKey: 'secret' } } });
    const preHandler = routes.get('/docs').options.preHandler;
    const state: any = {};
    const reply: any = {
      header() { return this; }, code(value: number) { state.code = value; return this; }, send(value: any) { state.body = value; return value; },
    };
    await preHandler({ headers: {} }, reply);
    expect(state.code).toBe(401);
  });
});
