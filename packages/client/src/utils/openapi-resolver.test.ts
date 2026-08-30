import { bundleExternalReferences, EXTERNAL_DOCUMENTS_KEY } from './openapi-resolver';
import { OpenAPIParser } from './openapi-parser';
import { OpenAPISpec } from '../types/openapi';

const root: OpenAPISpec = {
  openapi: '3.1.0',
  info: { title: 'Root', version: '1' },
  paths: {
    '/pets': {
      get: {
        responses: {
          '200': { $ref: './responses.yaml#/PetResponse' },
        },
      },
    },
  },
};

describe('external reference bundling', () => {
  it('rebases relative and local references into one JSON-safe root graph', async () => {
    const bundled = await bundleExternalReferences(root, {
      baseUri: 'https://example.com/openapi/root.yaml',
      load: async (uri) => {
        expect(uri).toBe('https://example.com/openapi/responses.yaml');
        return {
          PetResponse: {
            description: 'ok',
            content: { 'application/json': { schema: { $ref: '#/Pet' } } },
          },
          Pet: {
            type: 'object',
            properties: { parent: { $ref: '#/Pet' } },
          },
        };
      },
    });

    const responseRef = bundled.paths['/pets'].get!.responses['200'] as any;
    expect(responseRef.$ref).toContain(EXTERNAL_DOCUMENTS_KEY);
    const response = OpenAPIParser.resolveReference(bundled, responseRef.$ref);
    const schemaRef = response.content['application/json'].schema.$ref;
    const pet = OpenAPIParser.resolveReference(bundled, schemaRef);
    expect(pet.type).toBe('object');
    expect(OpenAPIParser.resolveReference(bundled, pet.properties.parent.$ref)).toBe(pet);
    expect(() => JSON.stringify(bundled)).not.toThrow();
  });

  it('decodes escaped JSON Pointer tokens', () => {
    const spec: any = { openapi: '3.1.0', info: { title: 'x', version: '1' }, paths: {}, components: { schemas: { 'a/b~c': { type: 'string' } } } };
    expect(OpenAPIParser.resolveReference(spec, '#/components/schemas/a~1b~0c').type).toBe('string');
  });
});
