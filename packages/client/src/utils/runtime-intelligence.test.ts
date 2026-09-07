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

  it('returns a validated runtime snapshot', () => {
    expect(parseRuntimeIntelligenceSnapshot(snapshot)).toEqual(snapshot);
  });

  it.each([
    null,
    {},
    { ...snapshot, runtime: undefined },
    { ...snapshot, summary: { ...snapshot.summary, matched: '1' } },
    { ...snapshot, routes: [{ method: 'GET' }] },
    { ...snapshot, discoveryComplete: 'yes' },
    { ...snapshot, server: { localPort: -1 } },
  ])('rejects malformed payload %#', (value) => {
    expect(() => parseRuntimeIntelligenceSnapshot(value)).toThrow('Runtime intelligence returned an invalid snapshot.');
  });
});
