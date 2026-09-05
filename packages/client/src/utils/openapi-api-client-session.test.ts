import { openapi30Spec } from '../fixtures/openapi/compatibility';
import { createOpenApiApiClientSession } from './openapi-api-client-session';
import { initialRequestValues } from './request-builder';

describe('OpenAPI API Client session', () => {
  it('creates a canonical editable draft with server and auth context', () => {
    const values = {
      ...initialRequestValues(openapi30Spec, '/pets/{id}', 'get'),
      serverUrl: 'https://session.example.test',
      parameters: { id: '42', locale: 'de' },
      auth: { bearer: 'session-token' },
    };

    const session = createOpenApiApiClientSession(openapi30Spec, '/pets/{id}', 'get', values);

    expect(session.serverUrl).toBe('https://session.example.test');
    expect(session.request.method).toBe('GET');
    expect(session.request.url).toContain('https://session.example.test/pets/42');
    expect(session.request.auth).toEqual({ type: 'bearer', token: 'session-token' });
    expect(session.request.headers?.some((entry) => entry.key.toLowerCase() === 'authorization')).toBe(false);
  });

  it('retains fallback server context when live values do not choose one', () => {
    const values = initialRequestValues(openapi30Spec, '/pets/{id}', 'get');
    const session = createOpenApiApiClientSession(
      openapi30Spec,
      '/pets/{id}',
      'get',
      values,
      'https://fallback.example.test',
    );

    expect(session.serverUrl).toBe('https://fallback.example.test');
  });
});
