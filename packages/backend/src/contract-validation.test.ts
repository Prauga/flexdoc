import { validateRuntimeContract } from './contract-validation';

describe('runtime contract validation', () => {
  it('passes when runtime and OpenAPI expose the same operations', () => {
    expect(validateRuntimeContract({
      documentedRoutes: [
        { method: 'GET', path: '/pets' },
        { method: 'GET', path: '/pets/{petId}' },
      ],
      runtimeRoutes: [
        { method: 'GET', path: '/pets' },
        { method: 'GET', path: '/pets/{id}' },
      ],
      discoveryComplete: true,
    })).toEqual({
      status: 'pass',
      complete: true,
      findings: [],
      summary: { total: 0, errors: 0, warnings: 0, info: 0 },
    });
  });

  it('reports a single actionable method mismatch instead of duplicate presence findings', () => {
    const result = validateRuntimeContract({
      documentedRoutes: [{ method: 'POST', path: '/pets/{petId}' }],
      runtimeRoutes: [{ method: 'GET', path: '/pets/{id}' }],
      discoveryComplete: true,
    });

    expect(result.status).toBe('fail');
    expect(result.summary).toEqual({ total: 1, errors: 1, warnings: 0, info: 0 });
    expect(result.findings).toEqual([expect.objectContaining({
      code: 'runtime.method-mismatch',
      severity: 'error',
      location: { kind: 'operation', path: '/pets/{petId}' },
      expected: ['POST'],
      observed: ['GET'],
    })]);
  });

  it('reports undocumented runtime operations as warnings', () => {
    const result = validateRuntimeContract({
      documentedRoutes: [{ method: 'GET', path: '/pets' }],
      runtimeRoutes: [
        { method: 'GET', path: '/pets' },
        { method: 'POST', path: '/internal/reindex' },
      ],
      discoveryComplete: true,
    });

    expect(result.status).toBe('warn');
    expect(result.findings).toEqual([expect.objectContaining({
      code: 'runtime.operation-undocumented',
      severity: 'warning',
      location: { kind: 'operation', method: 'POST', path: '/internal/reindex' },
    })]);
  });

  it('treats documented absence as an error only when discovery is complete', () => {
    const complete = validateRuntimeContract({
      documentedRoutes: [{ method: 'GET', path: '/pets/{petId}' }],
      runtimeRoutes: [],
      discoveryComplete: true,
    });
    expect(complete.status).toBe('fail');
    expect(complete.findings[0]).toEqual(expect.objectContaining({
      code: 'runtime.operation-unobserved',
      severity: 'error',
    }));

    const partial = validateRuntimeContract({
      documentedRoutes: [{ method: 'GET', path: '/pets/{petId}' }],
      runtimeRoutes: [],
      discoveryComplete: false,
    });
    expect(partial.status).toBe('partial');
    expect(partial.complete).toBe(false);
    expect(partial.findings[0]).toEqual(expect.objectContaining({
      code: 'runtime.operation-unobserved',
      severity: 'info',
    }));
  });
});
