import { setupFlexDoc } from './setup';

jest.mock('./template', () => ({ generateFlexDocHTML: jest.fn(() => '<html></html>') }));
jest.mock('./renderer-assets', () => ({ getRendererAssets: jest.fn(() => ({ javascript: 'js', css: 'css', version: 'test' })) }));

describe('setupFlexDoc runtime intelligence', () => {
  it('exposes a docs-auth-scoped runtime snapshot only when explicitly enabled', async () => {
    const handlers: Array<{ path: string; handler: any }> = [];
    const app: any = {
      router: { stack: [{ route: { path: '/pets/:petId', methods: { get: true } } }] },
      use(path: string, handler: any) { handlers.push({ path, handler }); },
    };
    setupFlexDoc(app, '/docs', {
      spec: { openapi: '3.1.0', info: { title: 'Pets', version: '1' }, paths: { '/pets/{petId}': { get: {} } } },
      options: { runtimeIntelligence: true },
    });
    const runtime = handlers.find((entry) => entry.path === '/docs/__flexdoc/runtime');
    expect(runtime).toBeDefined();
    const headers: Record<string, string> = {};
    let body = '';
    const response: any = {
      statusCode: 200,
      setHeader(name: string, value: string) { headers[name] = value; },
      send(value: string) { body = value; },
      end(value = '') { body = value; },
    };
    await runtime!.handler({ method: 'GET', headers: { host: 'api.example.com' }, protocol: 'https' }, response);
    expect(headers['Cache-Control']).toBe('no-store');
    const snapshot = JSON.parse(body);
    expect(snapshot.framework).toBe('express');
    expect(snapshot.serverOrigin).toBe('https://api.example.com');
    expect(snapshot.summary.matched).toBe(1);
  });

  it('does not register runtime discovery by default', () => {
    const paths: string[] = [];
    const app: any = { router: { stack: [] }, use(path: string) { paths.push(path); } };
    setupFlexDoc(app, '/docs', { spec: { openapi: '3.1.0', paths: {} } });
    expect(paths).not.toContain('/docs/__flexdoc/runtime');
  });
});
