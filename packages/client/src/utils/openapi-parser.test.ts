import { OpenAPIParser } from './openapi-parser';
import { OpenAPISpec } from '../types/openapi';

describe('OpenAPIParser', () => {
  const validJsonSpec = JSON.stringify({
    openapi: '3.0.0',
    info: {
      title: 'Test API',
      version: '1.0.0',
    },
    paths: {
      '/pets': {
        get: {
          summary: 'List all pets',
          responses: {
            '200': {
              description: 'A list of pets',
            },
          },
        },
      },
    },
  });

  const validYamlSpec = `openapi: "3.0.0"
info:
  title: "Test API"
  version: "1.0.0"
paths:
  /pets:
    get:
      summary: "List all pets"
      responses:
        "200":
          description: "A list of pets"
`;

  const invalidSpec = '{ "invalid": "spec" }';

  describe('parseSpec', () => {
    it('should parse valid JSON spec', async () => {
      const result = await OpenAPIParser.parseSpec(validJsonSpec);
      expect(result).toHaveProperty('openapi', '3.0.0');
      expect(result).toHaveProperty('info.title', 'Test API');
      expect(result).toHaveProperty('paths./pets.get.summary', 'List all pets');
    });

    it('should parse valid YAML spec', async () => {
      const result = await OpenAPIParser.parseSpec(validYamlSpec);
      expect(result).toHaveProperty('openapi', '3.0.0');
      expect(result).toHaveProperty('info.title', 'Test API');
      expect(result).toHaveProperty('paths./pets.get.summary', 'List all pets');
    });

    it('should parse object input', async () => {
      const objSpec = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: { '/pets': { get: { summary: 'List all pets' } } },
      };
      const result = await OpenAPIParser.parseSpec(objSpec);
      expect(result).toBe(objSpec);
    });

    it('should throw error for invalid JSON/YAML', async () => {
      await expect(OpenAPIParser.parseSpec('invalid spec')).rejects.toThrow(
        'Invalid OpenAPI specification: missing required fields'
      );
    });

    it('should throw error for missing required fields', async () => {
      await expect(OpenAPIParser.parseSpec('{}')).rejects.toThrow(
        'Invalid OpenAPI specification: missing required fields'
      );
    });
  });

  describe('getHttpMethods', () => {
    it('should return all HTTP methods from path item', () => {
      const pathItem = {
        get: {},
        post: {},
        put: {},
        delete: {},
      };
      const methods = OpenAPIParser.getHttpMethods(pathItem);
      expect(methods).toEqual(['get', 'post', 'put', 'delete']);
    });

    it('should return empty array for path item with no methods', () => {
      const pathItem = {};
      const methods = OpenAPIParser.getHttpMethods(pathItem);
      expect(methods).toEqual([]);
    });
  });

  describe('getMethodColor', () => {
    it('should return correct color for GET method', () => {
      const color = OpenAPIParser.getMethodColor('get');
      expect(color).toBe('text-blue-600 bg-blue-50 border-blue-200');
    });

    it('should return correct color for POST method', () => {
      const color = OpenAPIParser.getMethodColor('post');
      expect(color).toBe('text-green-600 bg-green-50 border-green-200');
    });

    it('should return correct color for PUT method', () => {
      const color = OpenAPIParser.getMethodColor('put');
      expect(color).toBe('text-orange-600 bg-orange-50 border-orange-200');
    });

    it('should return correct color for DELETE method', () => {
      const color = OpenAPIParser.getMethodColor('delete');
      expect(color).toBe('text-red-600 bg-red-50 border-red-200');
    });

    it('should return default color for unknown method', () => {
      const color = OpenAPIParser.getMethodColor('unknown');
      expect(color).toBe('text-gray-600 bg-gray-50 border-gray-200');
    });
  });

  describe('resolveReference', () => {
    it('should resolve reference in spec', () => {
      const spec: OpenAPISpec = {
        openapi: '3.0.0',
        info: {
          title: 'Test API',
          version: '1.0.0',
        },
        paths: {},
        components: {
          schemas: {
            Pet: {
              type: 'object',
              properties: {
                name: { type: 'string' },
              },
            },
          },
        },
      };

      const result = OpenAPIParser.resolveReference(
        spec,
        '#/components/schemas/Pet'
      );
      expect(result).toEqual({
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
      });
    });

    it('should throw error for non-local reference', () => {
      const spec = {} as OpenAPISpec;
      expect(() =>
        OpenAPIParser.resolveReference(spec, 'external/reference')
      ).toThrow('Only local references are supported');
    });

    it('should throw error for reference not found', () => {
      const spec = {} as OpenAPISpec;
      expect(() =>
        OpenAPIParser.resolveReference(spec, '#/nonexistent/path')
      ).toThrow('Reference not found: #/nonexistent/path');
    });
  });

  describe('isReference', () => {
    it('should return true for reference object', () => {
      const ref = { $ref: '#/components/schemas/Pet' };
      expect(OpenAPIParser.isReference(ref)).toBe(true);
    });

    it('should return false for non-reference object', () => {
      const nonRef = { type: 'object' };
      expect(OpenAPIParser.isReference(nonRef)).toBe(false);
    });

    it('should return false for null or undefined', () => {
      expect(OpenAPIParser.isReference(null)).toBe(false);
      expect(OpenAPIParser.isReference(undefined)).toBe(false);
    });
  });
});

