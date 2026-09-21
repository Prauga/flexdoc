const express = require('express');
const { createClient } = require('redis');
const {
  createHostExecutionAdmission,
  createHostExecutionAdmissionMiddleware,
  createHostExecutionObservationRecorder,
  createHostExecutionObservationReport,
  mergeHostExecutionObservationDocuments,
  setupExpressFlexDoc,
} = require('@prauga/flexdoc-backend');
const spec = require('./openapi.json');

const INSTANCE_ID = process.env.INSTANCE_ID || 'local';
const INSTANCES = Number(process.env.FLEXDOC_INSTANCES || 1);
const PUBLIC_ORIGIN = process.env.PUBLIC_ORIGIN || 'http://localhost:8080';
const SESSION_SECRET = process.env.FLEXDOC_SESSION_SECRET;
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const PORT = Number(process.env.PORT || 3000);

function hasDemoDocsSession(req) {
  return String(req.headers.cookie || '')
    .split(';')
    .some((part) => part.trim() === 'flexdoc-fleet-session=demo');
}

function requireDocsSession(req, res, next) {
  if (!hasDemoDocsSession(req)) {
    res.status(401).json({
      error: 'Open /example-login before using the protected FlexDoc fleet example.',
      instanceId: INSTANCE_ID,
    });
    return;
  }
  next();
}

function requireSameOriginCsrf(req, res, next) {
  const origin = req.get('origin');
  const fetchSite = req.get('sec-fetch-site');
  if ((origin && origin !== PUBLIC_ORIGIN) || fetchSite === 'cross-site') {
    res.status(403).json({
      error: `Cross-site FlexDoc execution is not allowed. Expected origin ${PUBLIC_ORIGIN}.`,
      instanceId: INSTANCE_ID,
    });
    return;
  }
  next();
}

function hasApiSession(req) {
  return String(req.headers.cookie || '')
    .split(';')
    .some((part) => part.trim().startsWith('demo-api-session='));
}

function createRedisSessionStore(redis) {
  return {
    async read(sessionId) {
      const raw = await redis.get(`flexdoc:jar:${sessionId}`);
      return raw ? JSON.parse(raw) : undefined;
    },
    async write(sessionId, cookies) {
      // Short TTL: a cookie jar is session state, not durable login state.
      await redis.set(`flexdoc:jar:${sessionId}`, JSON.stringify(cookies), { EX: 3600 });
    },
    async clear(sessionId) {
      await redis.del(`flexdoc:jar:${sessionId}`);
    },
  };
}

async function buildApp() {
  if (!SESSION_SECRET || Buffer.byteLength(SESSION_SECRET) < 32) {
    throw new Error(
      'FLEXDOC_SESSION_SECRET must be set to at least 32 bytes. Generate with: openssl rand -base64 48',
    );
  }

  const redis = createClient({ url: REDIS_URL });
  redis.on('error', (error) => {
    console.error(`[${INSTANCE_ID}] redis error`, error.message);
  });
  await redis.connect();

  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.get('/healthz', (_req, res) => {
    res.json({ ok: true, instanceId: INSTANCE_ID });
  });

  app.get('/example-login', (_req, res) => {
    res
      .cookie('flexdoc-fleet-session', 'demo', {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
      })
      .json({ ok: true, next: '/docs', instanceId: INSTANCE_ID });
  });

  app.get('/whoami', (_req, res) => {
    res.json({ instanceId: INSTANCE_ID });
  });

  app.post('/account/login', (_req, res) => {
    res
      .cookie('demo-api-session', 'ok', {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
      })
      .json({ ok: true, instanceId: INSTANCE_ID });
  });

  app.get('/account/me', (req, res) => {
    if (!hasApiSession(req)) {
      res.status(401).json({ error: 'missing demo-api-session cookie', instanceId: INSTANCE_ID });
      return;
    }
    res.json({ user: 'fleet-demo', instanceId: INSTANCE_ID });
  });

  const admission = createHostExecutionAdmission({
    fleetMaxInFlight: 48,
    instances: INSTANCES,
  });
  const observation = createHostExecutionObservationRecorder();

  // Security ordering for the privileged execute route:
  // authentication -> CSRF/same-origin -> admission -> FlexDoc.
  app.use('/docs', requireDocsSession);
  app.use('/docs/__flexdoc/execute', requireSameOriginCsrf);
  app.use(
    '/docs/__flexdoc/execute',
    createHostExecutionAdmissionMiddleware(admission, { retryAfterSeconds: 1 }),
  );

  // Operator export for this replica. Collect one document per instance, then merge.
  app.get('/__fleet/observation', (_req, res) => {
    res.json(createHostExecutionObservationReport(observation.snapshot()));
  });

  app.get('/__fleet/budget', (_req, res) => {
    res.json({ instanceId: INSTANCE_ID, budget: admission.budget });
  });

  setupExpressFlexDoc(app, '/docs', {
    spec,
    options: {
      title: 'FlexDoc multi-instance fleet',
      description:
        'Three Express replicas behind nginx with a shared session secret, Redis cookie-jar store, and a statically partitioned fleet admission budget.',
      version: '3.4.0',
      tryIt: {
        enabled: true,
        defaultServer: 'http://localhost:3000',
        credentials: 'same-origin',
        apiClientPersistenceKey: 'flexdoc-fleet-example',
        hostExecution: {
          enabled: true,
          allowedOrigins: ['http://localhost:3000'],
          instances: INSTANCES > 1 ? 'multiple' : 'single',
          sessionSecret: SESSION_SECRET,
          sessionStore: createRedisSessionStore(redis),
          onHostExecutionMetric: observation.sink,
        },
      },
    },
  });

  console.log(
    `[${INSTANCE_ID}] admission budget`,
    JSON.stringify(admission.budget),
  );

  return { app, redis, observation, admission };
}

async function mergeFleetObservations(urls) {
  const documents = await Promise.all(
    urls.map(async (url) => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`${url} returned ${response.status}`);
      }
      return response.json();
    }),
  );
  return mergeHostExecutionObservationDocuments(documents);
}

if (require.main === module) {
  buildApp()
    .then(({ app }) => {
      app.listen(PORT, () => {
        console.log(`[${INSTANCE_ID}] listening on ${PORT}`);
        console.log(`[${INSTANCE_ID}] docs behind balancer: ${PUBLIC_ORIGIN}/docs`);
        console.log(`[${INSTANCE_ID}] login: ${PUBLIC_ORIGIN}/example-login`);
      });
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { buildApp, mergeFleetObservations };
