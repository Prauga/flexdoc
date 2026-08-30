import { buildRequest, initialRequestValues } from './request-builder';
import { OpenAPISpec } from '../types/openapi';

const spec: OpenAPISpec = {
  openapi: '3.1.0',
  info: { title: 'Test', version: '1' },
  servers: [{ url: 'https://{region}.example.com', variables: { region: { default: 'api', enum: ['api', 'eu'] } } }],
  paths: {
    '/users/{id}': {
      parameters: [{ name: 'locale', in: 'query', schema: { type: 'string', default: 'en' } }],
      get: {
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', example: '42' } },
          { name: 'locale', in: 'query', schema: { type: 'string', default: 'fr' } },
          { name: 'tags', in: 'query', style: 'form', explode: true, schema: { type: 'array' } },
          { name: 'filter', in: 'query', style: 'deepObject', schema: { type: 'object' } },
          { name: 'X-Trace', in: 'header', schema: { type: 'string' } },
        ],
        security: [{ bearer: [], apiKey: [] }, { apiKey: [] }],
        responses: { '200': { description: 'ok' } },
      },
    },
    '/form': {
      post: {
        requestBody: { content: { 'application/x-www-form-urlencoded': { schema: { type: 'object' } } } },
        responses: { '204': { description: 'ok' } },
      },
    },
  },
  components: {
    securitySchemes: {
      bearer: { type: 'http', scheme: 'bearer' },
      apiKey: { type: 'apiKey', in: 'header', name: 'X-API-Key' },
    },
  },
};

describe('request builder', () => {
  it('creates useful initial values and lets operation parameters override path parameters', () => {
    const values = initialRequestValues(spec, '/users/{id}', 'get');
    expect(values.parameters).toEqual({ locale: 'fr', id: '42', tags: [], filter: {} });
  });

  it('serializes path, arrays, deep objects, headers, server variables and auth alternatives', () => {
    const request = buildRequest(spec, '/users/{id}', 'get', {
      serverVariables: { region: 'eu' },
      parameters: {
        id: 'a b', locale: 'de', tags: ['one', 'two'], filter: { role: 'admin', active: true },
      },
      headers: { 'X-Trace': 'trace-1' },
      auth: { apiKey: 'secret' },
    });
    expect(request.url).toBe('https://eu.example.com/users/a%20b?locale=de&tags=one&tags=two&filter%5Brole%5D=admin&filter%5Bactive%5D=true');
    expect(request.headers['X-Trace']).toBe('trace-1');
    expect(request.headers['X-API-Key']).toBe('secret');
    expect(request.headers.Authorization).toBeUndefined();
    expect(request.method).toBe('GET');
  });

  it('applies AND security when all credentials for the first alternative are present', () => {
    const request = buildRequest(spec, '/users/{id}', 'get', {
      parameters: { id: '42' },
      auth: { bearer: 'token', apiKey: 'secret' },
    });
    expect(request.headers.Authorization).toBe('Bearer token');
    expect(request.headers['X-API-Key']).toBe('secret');
  });

  it('serializes urlencoded request bodies from JSON editor input', () => {
    const request = buildRequest(spec, '/form', 'post', {
      contentType: 'application/x-www-form-urlencoded',
      body: JSON.stringify({ name: 'Ada Lovelace', role: ['admin', 'author'] }),
    });
    expect(request.body).toBe('name=Ada%20Lovelace&role=admin&role=author');
    expect(request.init.body).toBe(request.body);
    expect(request.bodyKind).toBe('form');
  });

  it('rejects invalid server variable values', () => {
    expect(() => buildRequest(spec, '/users/{id}', 'get', {
      serverVariables: { region: 'moon' }, parameters: { id: '42' },
    })).toThrow('Invalid value for server variable region');
  });
});
