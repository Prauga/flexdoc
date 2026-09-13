'use strict';

const path = require('node:path');
const express = require('express');

const root = path.resolve(__dirname, '../../../../');
const { setupExpressFlexDoc } = require(path.join(root, 'packages/backend/dist'));

const mode = process.env.FLEXDOC_BENCH_MODE || 'baseline';
const port = Number(process.env.FLEXDOC_BENCH_PORT || 5810);
const origin = process.env.FLEXDOC_BENCH_ORIGIN || `http://127.0.0.1:${port}`;
const app = express();
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));
app.get('/target', (_req, res) => res.json({ ok: true, runtime: 'node-express' }));
app.get('/openapi.json', (_req, res) => res.json({
  openapi: '3.0.3',
  info: { title: 'FlexDoc host-impact benchmark', version: '1.0.0' },
  paths: { '/target': { get: { responses: { 200: { description: 'ok' } } } } },
}));

if (mode !== 'baseline') {
  const tryIt = { enabled: true, defaultServer: origin };
  if (mode === 'host') tryIt.hostExecution = { allowedOrigins: [origin] };
  setupExpressFlexDoc(app, '/docs', {
    spec: {
      openapi: '3.0.3',
      info: { title: 'FlexDoc host-impact benchmark', version: '1.0.0' },
      servers: [{ url: origin }],
      paths: { '/target': { get: { responses: { 200: { description: 'ok' } } } } },
    },
    options: { title: 'FlexDoc host-impact benchmark', tryIt },
  });
}

const server = app.listen(port, '127.0.0.1');
function shutdown() { server.close(() => process.exit(0)); }
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
