import { Hono } from 'hono';
import { setupHonoFlexDoc } from '@prauga/flexdoc-backend';

const spec = {
  openapi: '3.1.0',
  info: {
    title: 'Hono FlexDoc 3.0 Showcase',
    version: '3.0.0',
    description: 'Small Hono contract used to demonstrate live route discovery and API Client handoff.',
  },
  servers: [{ url: 'http://localhost:3000', description: 'Local development' }],
  paths: {
    '/health': {
      get: {
        summary: 'Health check',
        tags: ['System'],
        responses: { 200: { description: 'Healthy' } },
      },
    },
    '/pets/{petId}': {
      get: {
        summary: 'Get a pet',
        tags: ['Pets'],
        parameters: [{ name: 'petId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: {
            description: 'Pet returned',
            content: { 'application/json': { schema: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' } } } } },
          },
        },
      },
    },
  },
};

export const app = new Hono();

app.get('/health', (c) => c.json({ status: 'ok' }));
app.get('/pets/:petId', (c) => c.json({ id: c.req.param('petId'), name: 'Miso' }));
// Intentionally omitted from the contract so Runtime Intelligence reports it as runtime-only.
app.get('/internal/health', (c) => c.json({ status: 'internal-ok' }));

setupHonoFlexDoc(app, '/docs', {
  spec,
  options: {
    title: 'FlexDoc Hono 3.0 showcase',
    description: 'Live Hono route discovery plus the canonical FlexDoc 3.0 renderer and API Client surface.',
    version: '3.0.0',
    runtimeIntelligence: true,
    expand: 'interactive',
    tryIt: {
      enabled: true,
      defaultServer: 'http://localhost:3000',
      credentials: 'same-origin',
      apiClientPersistenceKey: 'flexdoc-hono-3-showcase',
    },
    codeSamples: { enabled: true, languages: ['curl', 'javascript', 'python', 'go', 'java'] },
  },
});

export default app;
