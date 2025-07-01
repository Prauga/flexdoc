import { OpenAPISpec } from '../types/openapi';

export const sampleSpec: OpenAPISpec = {
  openapi: '3.0.0',
  info: {
    title: 'Pet Store API',
    description:
      'A sample API that uses a petstore as an example to demonstrate features in the OpenAPI 3.0 specification',
    termsOfService: 'http://example.com/terms/',
    contact: {
      name: 'Swagger API Team',
      email: 'apiteam@swagger.io',
      url: 'http://swagger.io',
    },
    license: {
      name: 'Apache 2.0',
      url: 'https://www.apache.org/licenses/LICENSE-2.0.html',
    },
    version: '1.0.0',
  },
  servers: [
    {
      url: 'https://petstore.swagger.io/v2',
      description: 'Production server',
    },
    {
      url: 'https://staging-petstore.swagger.io/v2',
      description: 'Staging server',
    },
  ],
  paths: {
    '/pets': {
      get: {
        summary: 'List all pets',
        description:
          'Returns a list of pets from the system that the user has access to',
        operationId: 'listPets',
        tags: ['pets'],
        parameters: [
          {
            name: 'limit',
            in: 'query',
            description: 'How many items to return at one time (max 100)',
            required: false,
            schema: {
              type: 'integer',
              format: 'int32',
              maximum: 100,
              default: 20,
            },
          },
          {
            name: 'tags',
            in: 'query',
            description: 'Tags to filter by',
            required: false,
            schema: {
              type: 'array',
              items: {
                type: 'string',
              },
            },
          },
        ],
        responses: {
          '200': {
            description: 'A paged array of pets',
            headers: {
              'x-next': {
                description: 'A link to the next page of responses',
                schema: {
                  type: 'string',
                },
              },
            },
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Pets',
                },
              },
            },
          },
          default: {
            description: 'unexpected error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
      },
      post: {
        summary: 'Create a pet',
        description: 'Creates a new pet in the store',
        operationId: 'createPet',
        tags: ['pets'],
        security: [
          {
            bearerAuth: [],
          },
        ],
        requestBody: {
          description: 'Pet to add to the store',
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/NewPet',
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Pet created successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Pet',
                },
              },
            },
          },
          '400': {
            description: 'Invalid input',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized',
          },
          default: {
            description: 'unexpected error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
      },
    },
    '/pets/{petId}': {
      get: {
        summary: 'Info for a specific pet',
        description: 'Returns detailed information about a specific pet',
        operationId: 'showPetById',
        tags: ['pets'],
        parameters: [
          {
            name: 'petId',
            in: 'path',
            required: true,
            description: 'The id of the pet to retrieve',
            schema: {
              type: 'string',
            },
          },
        ],
        responses: {
          '200': {
            description: 'Expected response to a valid request',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Pet',
                },
              },
            },
          },
          '404': {
            description: 'Pet not found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          default: {
            description: 'unexpected error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
      },
      put: {
        summary: 'Update a pet',
        description: 'Updates an existing pet in the store',
        operationId: 'updatePet',
        tags: ['pets'],
        security: [
          {
            bearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'petId',
            in: 'path',
            required: true,
            description: 'The id of the pet to update',
            schema: {
              type: 'string',
            },
          },
        ],
        requestBody: {
          description: 'Pet data to update',
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Pet',
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Pet updated successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Pet',
                },
              },
            },
          },
          '400': {
            description: 'Invalid input',
          },
          '401': {
            description: 'Unauthorized',
          },
          '404': {
            description: 'Pet not found',
          },
        },
      },
      delete: {
        summary: 'Delete a pet',
        description: 'Deletes a pet from the store',
        operationId: 'deletePet',
        tags: ['pets'],
        security: [
          {
            bearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'petId',
            in: 'path',
            required: true,
            description: 'The id of the pet to delete',
            schema: {
              type: 'string',
            },
          },
        ],
        responses: {
          '204': {
            description: 'Pet deleted successfully',
          },
          '401': {
            description: 'Unauthorized',
          },
          '404': {
            description: 'Pet not found',
          },
        },
      },
    },
    '/users': {
      get: {
        summary: 'List all users',
        description: 'Returns a list of users in the system',
        operationId: 'listUsers',
        tags: ['users'],
        security: [
          {
            bearerAuth: [],
          },
        ],
        responses: {
          '200': {
            description: 'A list of users',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/User',
                  },
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized',
          },
        },
      },
      post: {
        summary: 'Create a user',
        description: 'Creates a new user in the system',
        operationId: 'createUser',
        tags: ['users'],
        requestBody: {
          description: 'User to create',
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/NewUser',
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'User created successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/User',
                },
              },
            },
          },
          '400': {
            description: 'Invalid input',
          },
        },
      },
    },
  },
  components: {
    schemas: {
      Pet: {
        type: 'object',
        required: ['id', 'name'],
        properties: {
          id: {
            type: 'integer',
            format: 'int64',
            description: 'Unique identifier for the pet',
            example: 123,
          },
          name: {
            type: 'string',
            description: "Pet's name",
            example: 'Fluffy',
          },
          tag: {
            type: 'string',
            description: 'Tag to categorize the pet',
            example: 'dog',
          },
          status: {
            type: 'string',
            enum: ['available', 'pending', 'sold'],
            description: 'Pet status in the store',
            example: 'available',
          },
        },
      },
      NewPet: {
        type: 'object',
        required: ['name'],
        properties: {
          name: {
            type: 'string',
            description: "Pet's name",
            example: 'Fluffy',
          },
          tag: {
            type: 'string',
            description: 'Tag to categorize the pet',
            example: 'dog',
          },
        },
      },
      Pets: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/Pet',
        },
      },
      User: {
        type: 'object',
        required: ['id', 'username', 'email'],
        properties: {
          id: {
            type: 'integer',
            format: 'int64',
            description: 'Unique identifier for the user',
            example: 456,
          },
          username: {
            type: 'string',
            description: "User's username",
            example: 'john_doe',
          },
          email: {
            type: 'string',
            format: 'email',
            description: "User's email address",
            example: 'john@example.com',
          },
          firstName: {
            type: 'string',
            description: "User's first name",
            example: 'John',
          },
          lastName: {
            type: 'string',
            description: "User's last name",
            example: 'Doe',
          },
        },
      },
      NewUser: {
        type: 'object',
        required: ['username', 'email'],
        properties: {
          username: {
            type: 'string',
            description: "User's username",
            example: 'john_doe',
          },
          email: {
            type: 'string',
            format: 'email',
            description: "User's email address",
            example: 'john@example.com',
          },
          firstName: {
            type: 'string',
            description: "User's first name",
            example: 'John',
          },
          lastName: {
            type: 'string',
            description: "User's last name",
            example: 'Doe',
          },
        },
      },
      Error: {
        type: 'object',
        required: ['code', 'message'],
        properties: {
          code: {
            type: 'integer',
            format: 'int32',
            description: 'Error code',
            example: 400,
          },
          message: {
            type: 'string',
            description: 'Error message',
            example: 'Invalid input provided',
          },
        },
      },
    },
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT token authentication',
      },
    },
  },
  tags: [
    {
      name: 'pets',
      description: 'Everything about your pets',
    },
    {
      name: 'users',
      description: 'Operations about users',
    },
  ],
};
