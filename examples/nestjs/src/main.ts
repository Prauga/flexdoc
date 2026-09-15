import { NestFactory } from '@nestjs/core';
import { DocumentBuilder } from '@nestjs/swagger';
import {
  createHostExecutionAdmission,
  createHostExecutionAdmissionMiddleware,
  setupNestFlexDoc,
} from '@prauga/flexdoc-backend';
import { AppModule } from './app.module';
import { apiClientPage } from './api-client-page';

const logo = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="96" height="32" viewBox="0 0 96 32"%3E%3Crect width="96" height="32" rx="8" fill="%23111827"/%3E%3Ctext x="12" y="21" fill="white" font-family="Arial,sans-serif" font-size="14" font-weight="700"%3EFlexDoc%3C/text%3E%3C/svg%3E';
const localOrigin = 'http://localhost:3000';
const demoAuthorization = `Basic ${Buffer.from('flexdoc:local-development').toString('base64')}`;

type Next = () => void;
type ExpressRequestLike = {
  headers?: Record<string, string | string[] | undefined>;
  get?: (name: string) => string | undefined;
};
type ExpressResponseLike = {
  statusCode: number;
  setHeader: (name: string, value: string) => unknown;
  end: (body?: string) => unknown;
};

function requestHeader(request: ExpressRequestLike, name: string): string | undefined {
  const fromGetter = request.get?.(name);
  if (fromGetter) return fromGetter;
  const value = request.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function requireDemoDocsSession(request: ExpressRequestLike, response: ExpressResponseLike, next: Next) {
  if (requestHeader(request, 'authorization') === demoAuthorization) {
    next();
    return;
  }
  response.statusCode = 401;
  response.setHeader('WWW-Authenticate', 'Basic realm="FlexDoc local demo"');
  response.setHeader('Cache-Control', 'no-store');
  response.end('FlexDoc local demo authentication required.');
}

function requireSameOrigin(request: ExpressRequestLike, response: ExpressResponseLike, next: Next) {
  if (requestHeader(request, 'origin') === localOrigin) {
    next();
    return;
  }
  response.statusCode = 403;
  response.setHeader('Cache-Control', 'no-store');
  response.end('FlexDoc host execution requires the local documentation origin.');
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const expressApp = app.getHttpAdapter().getInstance();

  // These controls must be registered before setupNestFlexDoc so every FlexDoc
  // route inherits the application authentication boundary and the privileged
  // execute route additionally receives CSRF and capacity admission controls.
  // Replace the local Basic-auth example with your real session/SSO middleware.
  const hostExecutionAdmission = createHostExecutionAdmission({ maxInFlight: 16 });
  expressApp.use('/docs', requireDemoDocsSession);
  expressApp.use('/docs/__flexdoc/execute', requireSameOrigin);
  expressApp.use(
    '/docs/__flexdoc/execute',
    createHostExecutionAdmissionMiddleware(hostExecutionAdmission, { retryAfterSeconds: 1 }),
  );

  const openApiConfig = new DocumentBuilder()
    .setTitle('FlexDoc NestJS 3.0 Showcase API')
    .setDescription('Code-first OpenAPI with the complete FlexDoc 3.0 renderer/API Client surface and live NestJS Runtime Intelligence.')
    .setVersion('3.0.0')
    .addServer(localOrigin, 'Local development')
    .addServer('https://canary.api.example.test', 'Spot canary example')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'bearerAuth')
    .addApiKey({ type: 'apiKey', in: 'header', name: 'X-API-Key' }, 'apiKeyAuth')
    .addTag('pets', 'Pet operations generated from NestJS decorators')
    .addTag('users', 'User operations generated from NestJS decorators')
    .build();

  setupNestFlexDoc(app, '/docs', openApiConfig, {
    options: {
      title: 'FlexDoc NestJS 3.0 showcase',
      description: 'NestJS generates the OpenAPI document while FlexDoc also inspects the live underlying HTTP adapter for Runtime Intelligence.',
      version: '3.0.0',
      theme: 'dark',
      logo: { url: logo, alt: 'FlexDoc', clickable: false, maxHeight: 32 },
      hideDownloadButton: false,
      showExtensions: true,
      showCommonExtensions: true,
      requiredPropsFirst: true,
      sortPropsAlphabetically: true,
      showRequestHeaders: true,
      runtimeIntelligence: true,
      expand: 'interactive',
      tryIt: {
        enabled: true,
        defaultServer: localOrigin,
        credentials: 'same-origin',
        apiClientPersistenceKey: 'flexdoc-nestjs-3-showcase',
        // Host execution turns this docs route into privileged server-side egress.
        // Production deployments must authenticate the /docs subtree before FlexDoc,
        // apply CSRF policy at the application boundary, and enforce admission/rate limits.
        hostExecution: { enabled: true, allowedOrigins: [localOrigin] },
      },
      codeSamples: {
        enabled: true,
        languages: ['curl', 'javascript', 'python', 'go', 'java'],
      },
      footer: {
        copyright: 'Prauga FlexDoc 3.0 showcase',
        link: [
          { text: 'API Client', url: '/api-client', icon: 'external-link' },
          { text: 'Repository', url: 'https://github.com/prauga/flexdoc', icon: 'github' },
          { text: 'Issues', url: 'https://github.com/prauga/flexdoc/issues', icon: 'help-circle' },
        ],
      },
    },
  });

  expressApp.get('/api-client', (_request: unknown, response: { type: (contentType: string) => { send: (body: string) => unknown } }) => response.type('text/html; charset=utf-8').send(apiClientPage()));

  await app.listen(3000);
  console.log('FlexDoc docs: http://localhost:3000/docs (Basic auth: flexdoc / local-development)');
  console.log('FlexDoc API Client: http://localhost:3000/api-client');
}

void bootstrap();
