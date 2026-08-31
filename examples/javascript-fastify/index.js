const Fastify = require('fastify');
const { setupFastifyFlexDoc } = require('@prauga/flexdoc-backend');

const spec = {
  openapi: '3.1.0',
  info: { title: 'FlexDoc Fastify example', version: '1.0.0' },
  servers: [{ url: 'http://localhost:3000' }],
  paths: {
    '/hello/{name}': {
      get: {
        summary: 'Say hello',
        parameters: [
          {
            name: 'name',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: {
            description: 'Greeting',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['message'],
                  properties: { message: { type: 'string' } },
                },
              },
            },
          },
        },
      },
    },
  },
};

async function buildApp() {
  const app = Fastify({ logger: true });

  app.get('/hello/:name', {
    schema: {
      params: {
        type: 'object',
        required: ['name'],
        properties: { name: { type: 'string' } },
      },
      response: {
        200: {
          type: 'object',
          required: ['message'],
          properties: { message: { type: 'string' } },
        },
      },
    },
  }, async (request) => ({ message: `Hello, ${request.params.name}!` }));

  setupFastifyFlexDoc(app, '/docs', {
    spec,
    options: { title: 'FlexDoc Fastify example', tryIt: { enabled: true } },
  });

  return app;
}

async function main() {
  const app = await buildApp();
  await app.listen({ port: 3000, host: '0.0.0.0' });
  console.log('Docs: http://localhost:3000/docs');
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = { buildApp };
