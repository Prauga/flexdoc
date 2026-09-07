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
  app.get('/internal/health', async () => ({ status: 'internal-ok' }));

  setupFastifyFlexDoc(app, '/docs', {
    spec,
    options: {
      title: 'FlexDoc Fastify 3.0 showcase',
      description: 'OpenAPI 3.1 documentation, API Client workflows, and Fastify route-tree Runtime Intelligence.',
      version: '3.0.0',
      showExtensions: true,
      showCommonExtensions: true,
      requiredPropsFirst: true,
      sortPropsAlphabetically: true,
      showRequestHeaders: true,
      runtimeIntelligence: true,
      expand: 'interactive',
      tryIt: { enabled: true, defaultServer: 'http://localhost:3000', credentials: 'same-origin', apiClientPersistenceKey: 'flexdoc-fastify-3-showcase' },
      codeSamples: { enabled: true, languages: ['curl', 'javascript', 'python', 'go', 'java'] },
      footer: { copyright: 'Prauga FlexDoc 3.0 showcase', link: [{ text: 'Repository', url: 'https://github.com/prauga/flexdoc' }] },
    },
  });

  return app;
}

async function main() {
  const app = await buildApp();
  await app.listen({ port: 3000, host: '0.0.0.0' });
  console.log('API:  http://localhost:3000/pets');
  console.log('Docs: http://localhost:3000/docs');
  console.log('Runtime drift: GET /internal/health is intentionally undocumented');
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = { buildApp };
