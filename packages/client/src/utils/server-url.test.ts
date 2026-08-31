import { replaceRequestServer, requestUsesServer, resolveServerUrl } from './server-url';

describe('server URL helpers', () => {
  it('resolves OpenAPI server variables with their defaults', () => {
    expect(resolveServerUrl({
      url: 'https://{environment}.example.test/{version}',
      variables: {
        environment: { default: 'api' },
        version: { default: 'v1' },
      },
    })).toBe('https://api.example.test/v1');
  });

  it('recognizes requests underneath a configured server base path', () => {
    expect(requestUsesServer('https://api.example.test/v1/pets/42', 'https://api.example.test/v1')).toBe(true);
    expect(requestUsesServer('https://other.example.test/v1/pets/42', 'https://api.example.test/v1')).toBe(false);
  });

  it('switches to canary or localhost without losing endpoint path, query, or hash', () => {
    const canary = replaceRequestServer(
      'https://api.example.test/v1/pets/42?expand=owner#details',
      'https://api.example.test/v1',
      'https://spot-canary.example.test/v1',
    );
    expect(canary).toBe('https://spot-canary.example.test/v1/pets/42?expand=owner#details');

    const localhost = replaceRequestServer(canary, 'https://spot-canary.example.test/v1', 'http://localhost:8080');
    expect(localhost).toBe('http://localhost:8080/pets/42?expand=owner#details');
  });
});