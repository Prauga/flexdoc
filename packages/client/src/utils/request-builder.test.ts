import { buildRequest, initialRequestValues } from './request-builder';
import { OpenAPISpec } from '../types/openapi';

const spec: OpenAPISpec = {
  openapi: '3.1.0',
  info: { title: 'Test', version: '1' },
  servers: [{ url: 'https://api.example.com' }],
  paths: {
    '/users/{id}': {
      get: {
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', example: '42' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
          { name: 'X-Trace', in: 'header', schema: { type: 'string' } },
        ],
        security: [{ apiKey: [] }],
        responses: { '200': { description: 'ok' } },
      },
    },
  },
  components: {
    securitySchemes: { apiKey: { type: 'apiKey', in: 'header', name: 'X-API-Key' } },
  },
};

describe('request builder', () => {
  it('creates useful initial parameter values', () => {
    const values = initialRequestValues(spec, '/users/{id}', 'get');
    expect(values.parameters).toEqual({ id: '42', limit: '10' });
  });

  it('builds path, query, headers and auth from one request model', () => {
    const request = buildRequest(spec, '/users/{id}', 'get', {
      parameters: { id: 'a b', limit: '25' },
      headers: { 'X-Trace': 'trace-1' },
      auth: { apiKey: 'secret' },
    });
    expect(request.url).toBe('https://api.example.com/users/a%20b?limit=25');
    expect(request.headers['X-Trace']).toBe('trace-1');
    expect(request.headers['X-API-Key']).toBe('secret');
    expect(request.method).toBe('GET');
  });
});
