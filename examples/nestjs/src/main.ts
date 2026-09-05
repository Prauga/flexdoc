import { NestFactory } from '@nestjs/core';
import { DocumentBuilder } from '@nestjs/swagger';
import { setupNestFlexDoc } from '@prauga/flexdoc-backend';
import { AppModule } from './app.module';

const logo = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="96" height="32" viewBox="0 0 96 32"%3E%3Crect width="96" height="32" rx="8" fill="%23111827"/%3E%3Ctext x="12" y="21" fill="white" font-family="Arial,sans-serif" font-size="14" font-weight="700"%3EFlexDoc%3C/text%3E%3C/svg%3E';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const openApiConfig = new DocumentBuilder()
    .setTitle('FlexDoc NestJS Showcase API')
    .setDescription('Code-first OpenAPI documentation using NestJS 12, @nestjs/swagger and the FlexDoc 2.3 renderer.')
    .setVersion('2.3.0')
    .addServer('http://localhost:3000', 'Local development')
    .addServer('https://canary.api.example.test', 'Spot canary example')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'bearerAuth')
    .addApiKey({ type: 'apiKey', in: 'header', name: 'X-API-Key' }, 'apiKeyAuth')
    .addTag('pets', 'Pet operations generated from NestJS decorators')
    .addTag('users', 'User operations generated from NestJS decorators')
    .build();

  setupNestFlexDoc(app, '/docs', openApiConfig, {
    options: {
      title: 'FlexDoc NestJS showcase',
      description: 'The NestJS helper generates the OpenAPI document and serves the same canonical renderer used by every FlexDoc adapter.',
      version: '2.3.0',
      theme: 'dark',
      logo: { url: logo, alt: 'FlexDoc', clickable: false, maxHeight: 32 },
      hideDownloadButton: false,
      showExtensions: true,
      showCommonExtensions: true,
      requiredPropsFirst: true,
      sortPropsAlphabetically: true,
      showRequestHeaders: true,
      expandResponses: '200,201',
      tryIt: {
        enabled: true,
        defaultServer: 'http://localhost:3000',
        credentials: 'same-origin',
      },
      codeSamples: {
        enabled: true,
        languages: ['curl', 'javascript', 'python', 'go', 'java'],
      },
      footer: {
        copyright: 'Prauga FlexDoc 2.3 showcase',
        link: [
          { text: 'Repository', url: 'https://github.com/prauga/flexdoc', icon: 'github' },
          { text: 'Issues', url: 'https://github.com/prauga/flexdoc/issues', icon: 'help-circle' },
        ],
      },
    },
  });

  await app.listen(3000);
  console.log('FlexDoc: http://localhost:3000/docs');
}

void bootstrap();
