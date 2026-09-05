const Fastify = require('fastify');
const { setupFastifyFlexDoc } = require('@prauga/flexdoc-backend');
const spec = require('../showcase-openapi.json');

async function buildApp() {
  const app = Fastify({ logger: true });

  app.get('/pets', async (_request, reply) => {
    reply.header('X-Next-Cursor', 'cursor-2');
    return [{ id: 'pet-1', name: 'Miso', status: 'available', age: 3, tags: ['friendly', 'adoptable'] }];
  });
  app.post('/pets', async (request, reply) => {
    reply.code(201);
    return { id: 'pet-new', status: 'available', ...(request.body || {}) };
  });
  app.get('/pets/:petId', async (request) => ({ id: request.params.petId, name: 'Miso', status: 'available', age: 3, tags: ['friendly'] }));
  app.patch('/pets/:petId', async (request) => ({ id: request.params.petId, name: 'Miso', age: 3, tags: ['friendly'], status: 'available', ...(request.body || {}) }));
  app.get('/search', async (request) => ({ terms: request.query.terms || [], count: 1 }));

  setupFastifyFlexDoc(app, '/docs', {
    spec,
    options: {
      title: 'FlexDoc Fastify showcase',
      description: 'Full OpenAPI 3.1 feature showcase served through Fastify.',
      version: '2.8.0',
      showExtensions: true,
      showCommonExtensions: true,
      requiredPropsFirst: true,
      sortPropsAlphabetically: true,
      showRequestHeaders: true,
      expandResponses: '200,201',
      tryIt: { enabled: true, defaultServer: 'http://localhost:3000', credentials: 'same-origin' },
      codeSamples: { enabled: true, languages: ['curl', 'javascript', 'python', 'go', 'java'] },
      footer: { copyright: 'Prauga FlexDoc 2.2', link: [{ text: 'Repository', url: 'https://github.com/prauga/flexdoc' }] },
    },
  });

  return app;
}

async function main() {
  const app = await buildApp();
  await app.listen({ port: 3000, host: '0.0.0.0' });
  console.log('API:  http://localhost:3000/pets');
  console.log('Docs: http://localhost:3000/docs');
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = { buildApp };
