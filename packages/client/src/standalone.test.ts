import { prepareSpec } from './standalone';
import { OpenAPISpec } from './types/openapi';

const spec: OpenAPISpec = {
  openapi: '3.0.0',
  info: { title: 'Original', version: '1.0.0' },
  paths: {
    '/public': {
      get: {
        tags: ['users'],
        responses: { '200': { description: 'ok' } },
      },
    },
    '/internal': {
      get: {
        tags: ['admin'],
        responses: { '200': { description: 'ok' } },
      },
    },
  },
  components: {
    schemas: {
      Node: {
        type: 'object',
        properties: {
          children: {
            type: 'array',
            items: { $ref: '#/components/schemas/Node' },
          },
        },
      },
    },
  },
};

describe('prepareSpec', () => {
  it('filters and renames grouped operations without mutating the source spec', () => {
    const before = JSON.stringify(spec);
    const result = prepareSpec(spec, {
      title: 'Public API',
      tagGroups: [{ name: 'Public', tags: ['users'] }],
    });

    expect(result.info.title).toBe('Public API');
    expect(result.paths['/public']?.get?.tags).toEqual(['Public']);
    expect(result.paths['/internal']).toBeUndefined();
    expect(JSON.stringify(spec)).toBe(before);
  });

  it('keeps the component graph intact, including recursive schemas', () => {
    const result = prepareSpec(spec, {
      tagGroups: [{ name: 'Public', tags: ['users'] }],
    });

    expect(result.components?.schemas?.Node).toEqual(spec.components?.schemas?.Node);
  });
});
