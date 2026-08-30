import assert from 'node:assert/strict';
import test from 'node:test';
import { OpenAPIParser, bundleExternalReferences, buildRequest, generateCodeSample } from '../dist/index.js';

const spec = {
  openapi: '3.1.0',
  info: { title: 'Core fixture', version: '1.0.0' },
  servers: [{ url: 'https://api.example.test' }],
  paths: {
    '/pets/{id}': {
      get: {
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'include', in: 'query', schema: { type: 'array', items: { type: 'string' } } },
        ],
        responses: {
          '200': {
            description: 'ok',
            content: { 'application/json': { schema: { $ref: './models.yaml#/$defs/Pet' } } },
          },
        },
      },
    },
  },
};

test('parses OpenAPI and bundles external references', async () => {
  const parsed = await OpenAPIParser.parseSpec(JSON.stringify(spec));
  const bundled = await bundleExternalReferences(parsed, {
    baseUri: 'https://docs.example.test/openapi.yaml',
    load: async (uri) => {
      assert.equal(uri, 'https://docs.example.test/models.yaml');
      return { $defs: { Pet: { type: 'object', properties: { id: { type: 'string' } } } } };
    },
  });
  assert.ok(bundled['x-flexdoc-external-documents']);
  assert.match(bundled.paths['/pets/{id}'].get.responses['200'].content['application/json'].schema.$ref, /^#\/x-flexdoc-external-documents\//);
});

test('builds canonical requests and code samples without renderer dependencies', () => {
  const request = buildRequest(spec, '/pets/{id}', 'get', { parameters: { id: '42', include: ['owner', 'tags'] } });
  assert.equal(request.url, 'https://api.example.test/pets/42?include=owner&include=tags');
  assert.equal(request.method, 'GET');
  assert.match(generateCodeSample(request, 'curl'), /api\.example\.test\/pets\/42/);
});
