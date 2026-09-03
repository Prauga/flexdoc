import { Hono } from 'hono';
import { setupHonoFlexDoc } from '@prauga/flexdoc-backend';

export const app = new Hono();

app.get('/openapi.json', (c) => c.json({
  openapi: '3.1.0',
  info: { title: 'Hono FlexDoc Example', version: '1.0.0' },
  paths: { '/health': { get: { responses: { 200: { description: 'OK' } } } } },
}));
app.get('/health', (c) => c.json({ status: 'ok' }));
setupHonoFlexDoc(app, '/docs', { specUrl: '/openapi.json', options: { title: 'Hono FlexDoc Example' } });

export default app;
