import { OpenAPISpec } from '../../types/openapi';

export const openapi30Spec: OpenAPISpec = {
  openapi: '3.0.3',
  info: { title: 'Compatibility 3.0', version: '1.0.0' },
  servers: [{ url: 'https://{region}.example.test', variables: { region: { default: 'api', enum: ['api', 'eu'] } } }],
  security: [{ bearer: [] }],
  paths: {
    '/pets/{id}': {
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        { name: 'locale', in: 'query', schema: { type: 'string', default: 'en' } },
      ],
      get: {
        parameters: [
          { name: 'locale', in: 'query', schema: { type: 'string', default: 'fr' } },
          { name: 'tags', in: 'query', style: 'form', explode: true, schema: { type: 'array', items: { type: 'string' } } },
          { name: 'filter', in: 'query', style: 'deepObject', schema: { type: 'object' } },
          { name: 'X-Trace', in: 'header', schema: { type: 'string' } },
          { name: 'session', in: 'cookie', schema: { type: 'string' } },
        ],
        responses: { '200': { $ref: '#/components/responses/PetResponse' } },
      },
    },
    '/payload': {
      post: {
        security: [{ apiKeyHeader: [], apiKeyQuery: [], apiKeyCookie: [] }],
        requestBody: { $ref: '#/components/requestBodies/Payload' },
        responses: { '204': { description: 'accepted' } },
      },
    },
  },
  components: {
    schemas: {
      Pet: {
        type: 'object', required: ['id'],
        properties: {
          id: { type: 'string' },
          status: { type: 'string', enum: ['available', 'adopted'], default: 'available' },
          owner: { $ref: '#/components/schemas/Person' },
        },
      },
      Person: {
        type: 'object',
        nullable: true,
        properties: { name: { type: 'string' }, pets: { type: 'array', items: { $ref: '#/components/schemas/Pet' } } },
      },
    },
    responses: {
      PetResponse: { description: 'pet response', content: { 'application/json': { schema: { $ref: '#/components/schemas/Pet' } } } },
    },
    requestBodies: {
      Payload: {
        required: true,
        content: {
          'application/json': { schema: { type: 'object' }, example: { name: 'Ada' } },
          'application/x-www-form-urlencoded': { schema: { type: 'object' } },
          'multipart/form-data': { schema: { type: 'object' } },
        },
      },
    },
    securitySchemes: {
      bearer: { type: 'http', scheme: 'bearer' },
      basic: { type: 'http', scheme: 'basic' },
      apiKeyHeader: { type: 'apiKey', in: 'header', name: 'X-API-Key' },
      apiKeyQuery: { type: 'apiKey', in: 'query', name: 'api_key' },
      apiKeyCookie: { type: 'apiKey', in: 'cookie', name: 'api_session' },
    },
  },
};

export const openapi31Spec: OpenAPISpec = {
  openapi: '3.1.0',
  jsonSchemaDialect: 'https://json-schema.org/draft/2020-12/schema',
  info: { title: 'Compatibility 3.1', summary: 'JSON Schema 2020-12 coverage', version: '1.0.0' },
  paths: {
    '/events/{coords}/{labels}/{matrix}': {
      get: {
        parameters: [
          { name: 'coords', in: 'path', required: true, style: 'label', explode: true, schema: { type: 'array' } },
          { name: 'labels', in: 'path', required: true, style: 'label', explode: true, schema: { type: 'object' } },
          { name: 'matrix', in: 'path', required: true, style: 'matrix', explode: true, schema: { type: 'object' } },
          { name: 'space', in: 'query', style: 'spaceDelimited', explode: false, schema: { type: 'array' } },
          { name: 'pipe', in: 'query', style: 'pipeDelimited', explode: false, schema: { type: 'array' } },
          { name: 'object', in: 'query', style: 'form', explode: false, schema: { type: 'object' } },
        ],
        responses: { '200': { description: 'ok' } },
      },
    },
  },
  components: {
    schemas: {
      Event: {
        oneOf: [
          { $ref: '#/components/schemas/CreatedEvent' },
          { $ref: '#/components/schemas/DeletedEvent' },
        ],
        discriminator: {
          propertyName: 'kind',
          mapping: { created: '#/components/schemas/CreatedEvent', deleted: '#/components/schemas/DeletedEvent' },
        },
      },
      BaseEvent: { type: 'object', required: ['id'], properties: { id: { type: 'string' }, metadata: { type: ['object', 'null'], additionalProperties: true } } },
      CreatedEvent: { allOf: [{ $ref: '#/components/schemas/BaseEvent' }, { type: 'object', properties: { kind: { const: 'created' }, child: { $ref: '#/components/schemas/CreatedEvent' } } }] },
      DeletedEvent: { allOf: [{ $ref: '#/components/schemas/BaseEvent' }, { type: 'object', properties: { kind: { const: 'deleted' } } }] },
      StrictMap: { type: 'object', additionalProperties: false, patternProperties: { '^x-': { type: 'string' } } },
    },
  },
};

export const externalRootSpec: OpenAPISpec = {
  openapi: '3.1.0',
  info: { title: 'External refs', version: '1.0.0' },
  paths: {
    '/things': {
      get: {
        responses: {
          '200': { description: 'ok', content: { 'application/json': { schema: { $ref: './models.yaml#/Thing' } } } },
        },
      },
    },
  },
  components: { schemas: { RootMeta: { type: 'object', properties: { source: { type: 'string' } } } } },
};

export const externalDocuments: Record<string, unknown> = {
  'https://example.test/models.yaml': {
    Thing: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        meta: { $ref: './common.yaml#/Meta' },
        rootMeta: { $ref: './openapi.yaml#/components/schemas/RootMeta' },
      },
    },
  },
  'https://example.test/common.yaml': {
    Meta: { type: 'object', properties: { next: { $ref: './models.yaml#/Thing' } } },
  },
};
