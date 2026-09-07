import { buildRuntimeIntelligenceSnapshot, discoverExpressRoutes, normalizeRuntimePath } from './runtime-intelligence';

describe('runtime intelligence', () => {
  it('normalizes Express parameter paths to OpenAPI form', () => {
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

  it('reports presence drift without turning it into enforcement', () => {
    const snapshot = buildRuntimeIntelligenceSnapshot({
      spec: {
        openapi: '3.1.0',
        paths: {
          '/pets': { get: {} },
          '/pets/{petId}': { get: {} },
        },
      },
      discovery: {
        framework: 'express',
        complete: true,
        routes: [
          { method: 'GET', path: '/pets' },
          { method: 'POST', path: '/internal/reindex' },
        ],
      },
      serverOrigin: 'https://api.example.com',
    });
    expect(snapshot.summary).toEqual({ documented: 2, runtime: 2, matched: 1, runtimeOnly: 1, documentedOnly: 1 });
    expect(snapshot.runtimeOnly).toEqual([{ method: 'POST', path: '/internal/reindex' }]);
    expect(snapshot.documentedOnly).toEqual([{ method: 'GET', path: '/pets/{petId}' }]);
    expect(snapshot.serverOrigin).toBe('https://api.example.com');
  });

  it('marks discovery partial when a mounted router prefix cannot be recovered safely', () => {
    const app = { router: { stack: [{ handle: { stack: [{ route: { path: '/child', methods: { get: true } } }] } }] } };
    expect(discoverExpressRoutes(app).complete).toBe(false);
  });
});
