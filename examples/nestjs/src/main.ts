import { NestFactory } from '@nestjs/core';
import { DocumentBuilder } from '@nestjs/swagger';
import { setupNestFlexDoc } from '@prauga/flexdoc-backend';
import { AppModule } from './app.module';
import { apiClientPage } from './api-client-page';

const logo = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="96" height="32" viewBox="0 0 96 32"%3E%3Crect width="96" height="32" rx="8" fill="%23111827"/%3E%3Ctext x="12" y="21" fill="white" font-family="Arial,sans-serif" font-size="14" font-weight="700"%3EFlexDoc%3C/text%3E%3C/svg%3E';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const openApiConfig = new DocumentBuilder()
    .setTitle('FlexDoc NestJS 3.0 Showcase API')
    .setDescription('Code-first OpenAPI with the complete FlexDoc 3.0 renderer/API Client surface and live NestJS Runtime Intelligence.')
    .setVersion('3.0.0')
    .addServer('http://localhost:3000', 'Local development')
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
        defaultServer: 'http://localhost:3000',
        credentials: 'same-origin',
        apiClientPersistenceKey: 'flexdoc-nestjs-3-showcase',
        hostExecution: true,
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

  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.get('/api-client', (_request: unknown, response: { type: (contentType: string) => { send: (body: string) => unknown } }) => response.type('text/html; charset=utf-8').send(apiClientPage()));

  await app.listen(3000);
  console.log('FlexDoc docs: http://localhost:3000/docs');
  console.log('FlexDoc API Client: http://localhost:3000/api-client');
}

void bootstrap();
