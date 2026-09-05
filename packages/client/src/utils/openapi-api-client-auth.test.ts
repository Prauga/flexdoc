import { buildRequest, initialRequestValues } from './request-builder';
import { requestDraftFromOpenApiRequest } from './openapi-api-client-auth';
import { openapi30Spec } from '../fixtures/openapi/compatibility';
import type { OpenAPISpec } from '../types/openapi';

function handoff(spec: OpenAPISpec, path: string, method: string, auth: Record<string, string>) {
  const values = { ...initialRequestValues(spec, path, method), auth };
  const request = buildRequest(spec, path, method, values);
  return requestDraftFromOpenApiRequest(spec, path, method, values, request);
}

describe('OpenAPI auth handoff', () => {
  it('converts bearer auth and strips the raw Authorization header', () => {
    const draft = handoff(openapi30Spec, '/pets/{id}', 'get', { bearer: 'demo-token' });
    expect(draft.auth).toEqual({ type: 'bearer', token: 'demo-token' });
    expect(draft.headers?.some((entry) => entry.key.toLowerCase() === 'authorization')).toBe(false);
  });

  it('prefers a filled bearer requirement over a leading optional no-auth requirement', () => {
    const spec: OpenAPISpec = { ...openapi30Spec, security: [{}, { bearer: [] }] };
    const draft = handoff(spec, '/pets/{id}', 'get', { bearer: 'optional-token' });
    expect(draft.auth).toEqual({ type: 'bearer', token: 'optional-token' });
    expect(draft.headers?.some((entry) => entry.key.toLowerCase() === 'authorization')).toBe(false);
  });

  it('keeps optional security as no auth when no optional credential is filled', () => {
    const spec: OpenAPISpec = { ...openapi30Spec, security: [{}, { bearer: [] }] };
    const draft = handoff(spec, '/pets/{id}', 'get', {});
    expect(draft.auth).toEqual({ type: 'none' });
  });

  it('converts Basic credentials into username and password', () => {
    const spec: OpenAPISpec = { ...openapi30Spec, security: [{ basic: [] }] };
    const draft = handoff(spec, '/pets/{id}', 'get', { basic: 'ada:demo-pass:tail' });
    expect(draft.auth).toEqual({ type: 'basic', username: 'ada', password: 'demo-pass:tail' });
    expect(draft.headers?.some((entry) => entry.key.toLowerCase() === 'authorization')).toBe(false);
  });

  it.each([
    ['header', 'apiKeyHeader', 'X-API-Key'],
    ['query', 'apiKeyQuery', 'api_key'],
  ] as const)('converts %s API keys and strips the raw transport copy', (location, schemeName, key) => {
    const spec: OpenAPISpec = { ...openapi30Spec, security: [{ [schemeName]: [] }] };
    const draft = handoff(spec, '/pets/{id}', 'get', { [schemeName]: 'demo-value' });
    expect(draft.auth).toEqual({ type: 'apiKey', key, value: 'demo-value', in: location });
    if (location === 'header') expect(draft.headers?.some((entry) => entry.key.toLowerCase() === key.toLowerCase())).toBe(false);
    else expect(draft.query?.some((entry) => entry.key === key)).toBe(false);
  });

  it.each(['oauth2', 'openIdConnect'] as const)('preserves %s access tokens as OAuth auth', (type) => {
    const spec: OpenAPISpec = {
      ...openapi30Spec,
      security: [{ auth: [] }],
      components: {
        ...openapi30Spec.components,
        securitySchemes: {
          ...openapi30Spec.components?.securitySchemes,
          auth: type === 'oauth2'
            ? { type, flows: { clientCredentials: { tokenUrl: 'https://issuer.example/token', scopes: {} } } }
            : { type, openIdConnectUrl: 'https://issuer.example/.well-known/openid-configuration' },
        },
      },
    };
    const draft = handoff(spec, '/pets/{id}', 'get', { auth: 'access-token' });
    expect(draft.auth).toEqual({ type: 'oauth2', accessToken: 'access-token' });
  });

  it('keeps cookie API keys as raw transport data', () => {
    const spec: OpenAPISpec = { ...openapi30Spec, security: [{ apiKeyCookie: [] }] };
    const draft = handoff(spec, '/pets/{id}', 'get', { apiKeyCookie: 'cookie-value' });
    expect(draft.auth).toEqual({ type: 'none' });
  });

  it('keeps multi-scheme requirements raw instead of collapsing them', () => {
    const draft = handoff(openapi30Spec, '/payload', 'post', {
      apiKeyHeader: 'header-value',
      apiKeyQuery: 'query-value',
      apiKeyCookie: 'cookie-value',
    });
    expect(draft.auth).toEqual({ type: 'none' });
    expect(draft.headers?.some((entry) => entry.key === 'X-API-Key' && entry.value === 'header-value')).toBe(true);
    expect(draft.query?.some((entry) => entry.key === 'api_key' && entry.value === 'query-value')).toBe(true);
  });

  it('honors operation security over the document default', () => {
    const spec: OpenAPISpec = {
      ...openapi30Spec,
      paths: {
        ...openapi30Spec.paths,
        '/pets/{id}': {
          ...openapi30Spec.paths['/pets/{id}'],
          get: {
            ...openapi30Spec.paths['/pets/{id}'].get!,
            security: [{ apiKeyHeader: [] }],
          },
        },
      },
    };
    const draft = handoff(spec, '/pets/{id}', 'get', { bearer: 'ignored', apiKeyHeader: 'operation-value' });
    expect(draft.auth).toEqual({ type: 'apiKey', key: 'X-API-Key', value: 'operation-value', in: 'header' });
  });
});
