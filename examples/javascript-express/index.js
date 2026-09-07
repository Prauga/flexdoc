const express = require('express');
const { setupExpressFlexDoc } = require('@prauga/flexdoc-backend');
const spec = require('../showcase-openapi.json');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

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

  setupExpressFlexDoc(app, '/docs', {
    spec,
    options: {
      title: 'FlexDoc Express 3.0 showcase',
      description: 'OpenAPI 3.1 documentation, API Client workflows, and live Express Runtime Intelligence in one backend-native example.',
      version: '3.0.0',
      favicon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"%3E%3Crect width="32" height="32" rx="8" fill="%237c3aed"/%3E%3Ctext x="8" y="22" fill="white" font-size="18"%3EF%3C/text%3E%3C/svg%3E',
      customCss: '.flexdoc-root { --express-showcase: 1; }',
      customJs: 'document.documentElement.dataset.flexdocExample="express";',
      showExtensions: true,
      showCommonExtensions: true,
      requiredPropsFirst: true,
      sortPropsAlphabetically: true,
      showRequestHeaders: true,
      runtimeIntelligence: true,
      expand: 'interactive',
      tryIt: { enabled: true, defaultServer: 'http://localhost:3000', credentials: 'same-origin', apiClientPersistenceKey: 'flexdoc-express-3-showcase' },
      codeSamples: { enabled: true, languages: ['curl', 'javascript', 'python', 'go', 'java'] },
      footer: { copyright: 'Prauga FlexDoc 3.0 showcase', link: [{ text: 'Repository', url: 'https://github.com/prauga/flexdoc' }] },
    },
  });

  return app;
}

if (require.main === module) {
  buildApp().listen(3000, () => console.log('API:  http://localhost:3000/pets\nDocs: http://localhost:3000/docs\nRuntime drift: GET /internal/health is intentionally undocumented'));
}

module.exports = { buildApp };
