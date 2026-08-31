const Fastify = require('fastify');
const swagger = require('@fastify/swagger');
const { setupFastifySwaggerFlexDoc } = require('@prauga/flexdoc-backend');

async function main() {
  const app = Fastify({ logger: true });

  await app.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: { title: 'FlexDoc Fastify example', version: '1.0.0' },
      servers: [{ url: 'http://localhost:3000' }],
    },
  });

  app.get('/hello/:name', {
    schema: {
      summary: 'Say hello',
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

  setupFastifySwaggerFlexDoc(app, '/docs', {
    options: { title: 'FlexDoc Fastify example', tryIt: { enabled: true } },
  });

  await app.listen({ port: 3000, host: '0.0.0.0' });
  console.log('Docs: http://localhost:3000/docs');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
