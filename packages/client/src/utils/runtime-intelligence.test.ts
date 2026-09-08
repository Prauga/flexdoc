import { parseRuntimeIntelligenceSnapshot } from './runtime-intelligence';

describe('parseRuntimeIntelligenceSnapshot', () => {
  const snapshot = {
    framework: 'express',
    runtime: { name: 'node', version: 'v22.22.3', platform: 'linux', arch: 'x64' },
    serverOrigin: 'https://api.example.com',
    server: { localPort: 8443 },
    environment: { name: 'production' },
    discoveryComplete: true,
    routes: [{ method: 'GET', path: '/pets' }],
    runtimeOnly: [],
    documentedOnly: [],
    summary: { documented: 1, runtime: 1, matched: 1, runtimeOnly: 0, documentedOnly: 0 },
  };

  it('keeps compatible 3.0/native snapshots valid when validation is absent', () => {
    expect(parseRuntimeIntelligenceSnapshot(snapshot)).toEqual(snapshot);
  });

  it('parses a structured 3.1 contract-validation payload', () => {
    const validation = {
      status: 'warn',
      complete: true,
      findings: [{
        id: 'runtime.duplicate-operation:GET:/pets/{}',
        code: 'runtime.duplicate-operation',
        severity: 'warning',
        location: { kind: 'operation', method: 'GET', path: '/pets/{id}' },
        message: 'Runtime registers GET /pets/{id} 2 times.',
        expected: 'One runtime registration for this HTTP operation',
        observed: '2 runtime registrations',
      }],
      summary: { total: 1, errors: 0, warnings: 1, info: 0 },
    };

    expect(parseRuntimeIntelligenceSnapshot({ ...snapshot, validation })).toEqual({ ...snapshot, validation });
  });

  it.each([
    null,
    {},
    { ...snapshot, runtime: undefined },
    { ...snapshot, summary: { ...snapshot.summary, matched: '1' } },
    { ...snapshot, routes: [{ method: 'GET' }] },
    { ...snapshot, discoveryComplete: 'yes' },
    { ...snapshot, server: { localPort: -1 } },
    { ...snapshot, validation: { status: 'warn', complete: true, findings: [], summary: { total: 1, errors: 0, warnings: 1, info: 0 } } },
    { ...snapshot, validation: { status: 'unknown', complete: true, findings: [], summary: { total: 0, errors: 0, warnings: 0, info: 0 } } },
  ])('rejects malformed payload %#', (value) => {
    expect(() => parseRuntimeIntelligenceSnapshot(value)).toThrow('Runtime intelligence returned an invalid snapshot.');
  });
});
