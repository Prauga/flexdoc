import {
  buildRuntimeIntelligenceSnapshot,
  discoverExpressRoutes,
  discoverFastifyRoutes,
  discoverHonoRoutes,
  normalizeRuntimePath,
  runtimeIntelligenceEnabled,
} from './runtime-intelligence';

describe('runtime intelligence', () => {
  it('requires an explicit true opt-in', () => {
    expect(runtimeIntelligenceEnabled(true)).toBe(true);
    expect(runtimeIntelligenceEnabled({ enabled: true })).toBe(true);
    expect(runtimeIntelligenceEnabled(false)).toBe(false);
    expect(runtimeIntelligenceEnabled(undefined)).toBe(false);
    expect(runtimeIntelligenceEnabled({} as any)).toBe(false);
    expect(runtimeIntelligenceEnabled({ enabled: false } as any)).toBe(false);
  });

  it('normalizes framework parameter paths to OpenAPI form', () => {
    expect(normalizeRuntimePath('/pets/:petId')).toBe('/pets/{petId}');
    expect(normalizeRuntimePath('/orgs/:orgId(\\d+)/users/:userId?')).toBe('/orgs/{orgId}/users/{userId}');
  });

  it('discovers direct Express routes without treating middleware as endpoints', () => {
    const app = {
      router: {
        stack: [
          { route: { path: '/pets', methods: { get: true, post: true } } },
          { route: { path: '/pets/:petId', methods: { get: true } } },
          { handle: () => undefined },
        ],
      },
    };
    expect(discoverExpressRoutes(app)).toEqual({
      framework: 'express',
      complete: true,
      routes: [
        { method: 'GET', path: '/pets' },
        { method: 'POST', path: '/pets' },
        { method: 'GET', path: '/pets/{petId}' },
      ],
    });
  });

  it('retains duplicate Express registration evidence without double-counting wire-equivalent routes', () => {
    const discovery = discoverExpressRoutes({
      router: {
        stack: [
          { route: { path: '/pets/:id', methods: { get: true } } },
          { route: { path: '/pets/:petId', methods: { get: true } } },
        ],
      },
    });

    expect(discovery.routes).toEqual([{ method: 'GET', path: '/pets/{id}' }]);
    expect(discovery.duplicateRoutes).toEqual([{ method: 'GET', path: '/pets/{id}', count: 2 }]);
  });

  it('discovers Fastify route trees after ready and suppresses implicit HEAD siblings', async () => {
    const app = {
      version: '5.12.1',
      ready: jest.fn(async () => undefined),
      printRoutes: jest.fn(() => [
        '└── /',
        '    ├── pets (GET, HEAD)',
        '    │   └── /:petId (GET, HEAD)',
        '    ├── internal/reindex (POST)',
        '    └── docs (GET, HEAD)',
      ].join('\n')),
    };

    expect(await discoverFastifyRoutes(app, '/docs')).toEqual({
      framework: 'fastify',
      frameworkVersion: '5.12.1',
      complete: true,
      routes: [
        { method: 'POST', path: '/internal/reindex' },
        { method: 'GET', path: '/pets' },
        { method: 'GET', path: '/pets/{petId}' },
      ],
    });
    expect(app.ready).toHaveBeenCalledTimes(1);
    expect(app.printRoutes).toHaveBeenCalledWith({ commonPrefix: false });
  });

  it('discovers Hono registered routes and excludes FlexDoc topology', () => {
    const app = {
      routes: [
        { method: 'GET', path: '/pets' },
        { method: 'POST', path: '/pets/:petId/actions' },
        { method: 'GET', path: '/docs' },
        { method: 'ALL', path: '/middleware/*' },
      ],
    };

    expect(discoverHonoRoutes(app, '/docs')).toEqual({
      framework: 'hono',
      complete: false,
      routes: [
        { method: 'GET', path: '/pets' },
        { method: 'POST', path: '/pets/{petId}/actions' },
      ],
    });
  });

  it('reports presence drift plus safe runtime server and environment metadata without enforcement', () => {
    const snapshot = buildRuntimeIntelligenceSnapshot({
      spec: {
        openapi: '3.1.0',
        paths: {
          '/pets': { get: {} },
          '/pets/{petId}': { get: {} },
        },
      },
      discovery: {
        framework: 'fastify',
        frameworkVersion: '5.12.1',
        complete: true,
        routes: [
          { method: 'GET', path: '/pets' },
          { method: 'POST', path: '/internal/reindex' },
        ],
      },
      serverOrigin: 'https://api.example.com',
      server: { localPort: 8443 },
      environment: { name: 'production' },
      runtime: { name: 'node', version: 'v22.22.3', platform: 'linux', arch: 'x64' },
    });
    expect(snapshot.summary).toEqual({ documented: 2, runtime: 2, matched: 1, runtimeOnly: 1, documentedOnly: 1 });
    expect(snapshot.runtimeOnly).toEqual([{ method: 'POST', path: '/internal/reindex' }]);
    expect(snapshot.documentedOnly).toEqual([{ method: 'GET', path: '/pets/{petId}' }]);
    expect(snapshot.validation.summary).toEqual({ total: 2, errors: 1, warnings: 1, info: 0 });
    expect(snapshot.serverOrigin).toBe('https://api.example.com');
    expect(snapshot.server).toEqual({ localPort: 8443 });
    expect(snapshot.environment).toEqual({ name: 'production' });
    expect(snapshot.frameworkVersion).toBe('5.12.1');
    expect(snapshot.runtime).toEqual({ name: 'node', version: 'v22.22.3', platform: 'linux', arch: 'x64' });
  });

  it('feeds duplicate host registrations into contract validation', () => {
    const snapshot = buildRuntimeIntelligenceSnapshot({
      spec: { openapi: '3.1.0', paths: { '/pets/{petId}': { get: {} } } },
      discovery: {
        framework: 'express',
        complete: true,
        routes: [{ method: 'GET', path: '/pets/{id}' }],
        duplicateRoutes: [{ method: 'GET', path: '/pets/{id}', count: 2 }],
      },
    });

    expect(snapshot.summary).toEqual({ documented: 1, runtime: 1, matched: 1, runtimeOnly: 0, documentedOnly: 0 });
    expect(snapshot.validation.findings).toEqual([expect.objectContaining({ code: 'runtime.duplicate-operation' })]);
  });

  it('marks discovery partial when a mounted Express router prefix cannot be recovered safely', () => {
    const app = { router: { stack: [{ handle: { stack: [{ route: { path: '/child', methods: { get: true } } }] } }] } };
    expect(discoverExpressRoutes(app).complete).toBe(false);
  });
});
