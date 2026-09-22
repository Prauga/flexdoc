const express = require('express');
const {
  createHostExecutionAdmission,
  createHostExecutionAdmissionMiddleware,
  setupExpressFlexDoc,
} = require('@prauga/flexdoc-backend');
const spec = require('../showcase-openapi.json');

function hasDemoDocsSession(req) {
  return String(req.headers.cookie || '')
    .split(';')
    .some((part) => part.trim() === 'flexdoc-example-session=demo');
}

function requireDocsSession(req, res, next) {
  if (!hasDemoDocsSession(req)) {
    res.status(401).json({ error: 'Open /example-login before using the protected FlexDoc example.' });
    return;
  }
  next();
}

function requireSameOriginCsrf(req, res, next) {
  const origin = req.get('origin');
  const fetchSite = req.get('sec-fetch-site');
  if ((origin && origin !== 'http://localhost:3000') || fetchSite === 'cross-site') {
    res.status(403).json({ error: 'Cross-site FlexDoc execution is not allowed.' });
    return;
  }
  next();
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.get('/example-login', (_req, res) => {
    res.cookie('flexdoc-example-session', 'demo', {
      httpOnly: true,
      sameSite: 'strict',
      path: '/docs',
    }).json({ ok: true, next: '/docs' });
  });

  app.get('/pets', (req, res) => {
    res.set('X-Next-Cursor', 'cursor-2').json([
      { id: 'pet-1', name: 'Miso', status: 'available', age: 3, tags: ['friendly', 'adoptable'] },
    ]);
  });
  app.post('/pets', (req, res) => res.status(201).json({ id: 'pet-new', status: 'available', ...req.body }));
  app.get('/pets/:petId', (req, res) => res.json({ id: req.params.petId, name: 'Miso', status: 'available', age: 3, tags: ['friendly'] }));
  app.patch('/pets/:petId', (req, res) => res.json({ id: req.params.petId, name: 'Miso', age: 3, tags: ['friendly'], status: 'available', ...req.body }));
  app.get('/search', (req, res) => res.json({ terms: req.query.terms || [], count: 1 }));
  app.post('/sessions', (req, res) => res.json({ token: `local-${req.body.scope || 'session'}` }));
  app.post('/uploads', (_req, res) => res.status(201).json({ id: 'upload-local', url: 'http://localhost:3000/uploads/upload-local' }));

  // Intentionally omitted from the OpenAPI document so Runtime Intelligence has real drift to report.
  app.get('/internal/health', (_req, res) => res.json({ status: 'internal-ok' }));

  // Security ordering matters for host execution:
  // 1. authenticate the whole documentation subtree;
  // 2. enforce application CSRF policy on the privileged execute POST;
  // 3. bound per-process in-flight server-side egress;
  // 4. only then register the FlexDoc routes.
  const hostAdmission = createHostExecutionAdmission({ maxInFlight: 16 });
  app.use('/docs', requireDocsSession);
  app.use(
    '/docs/__flexdoc/execute',
    requireSameOriginCsrf,
    createHostExecutionAdmissionMiddleware(hostAdmission, { retryAfterSeconds: 1 }),
  );

  setupExpressFlexDoc(app, '/docs', {
    spec,
    options: {
      title: 'FlexDoc Express 3.3 showcase',
      description: 'OpenAPI 3.1 documentation, API Client workflows, native host execution, and live Express Runtime Intelligence in one backend-native example.',
      version: '3.3.0',
      favicon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"%3E%3Crect width="32" height="32" rx="8" fill="%237c3aed"/%3E%3Ctext x="8" y="22" fill="white" font-size="18"%3EF%3C/text%3E%3C/svg%3E',
      customCss: '.flexdoc-root { --express-showcase: 1; }',
      customJs: 'document.documentElement.dataset.flexdocExample="express";',
      showExtensions: true,
      showCommonExtensions: true,
      requiredPropsFirst: true,
      sortPropsAlphabetically: true,
      showRequestHeaders: true,
      runtimeIntelligence: {
        enabled: true,
        acknowledgedUndocumented: [{ method: 'GET', path: '/internal/health' }],
      },
      expand: 'interactive',
      tryIt: {
        enabled: true,
        defaultServer: 'http://localhost:3000',
        credentials: 'same-origin',
        apiClientPersistenceKey: 'flexdoc-express-3-showcase',
        hostExecution: { enabled: true, allowedOrigins: ['http://localhost:3000'] },
      },
      codeSamples: { enabled: true, languages: ['curl', 'javascript', 'python', 'go', 'java'] },
      footer: { copyright: 'Prauga FlexDoc 3.3 showcase', link: [{ text: 'Repository', url: 'https://github.com/prauga/flexdoc' }] },
    },
  });

  return app;
}

if (require.main === module) {
  buildApp().listen(3000, () => console.log('Login: http://localhost:3000/example-login\nAPI:   http://localhost:3000/pets\nDocs:  http://localhost:3000/docs\nGET /internal/health is acknowledged as intentionally undocumented'));
}

module.exports = { buildApp };
