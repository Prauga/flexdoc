import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { setupFlexDoc } from '@bluejeans/flexdoc-backend';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = new DocumentBuilder()
    .setTitle('FlexDoc Example API')
    .setDescription('Example API demonstrating Swagger integration')
    .setVersion('1.0')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // Setup FlexDoc with the OpenAPI document
  setupFlexDoc(app, 'docs', {
    spec: document,
    options: {
      title: 'FlexDoc Example API',
      description: 'Example API demonstrating FlexDoc integration',
      version: '1.0',
      theme: 'dark',
      logo: {
        url: 'https://placehold.co/150x50?text=FlexDoc',
        clickable: true,
      },
      hideDownloadButton: false,
      footer: {
        copyright: 'Copyright © 2025 FlexDoc',
        link: [
          {
            text: 'GitHub',
            url: 'https://github.com/bluejeans117/flexdoc',
            icon: 'github',
          },
          {
            text: 'Documentation',
            url: 'https://flexdoc.bluejeans.com',
            icon: 'book-open',
          },
          {
            text: 'Support',
            url: 'https://github.com/bluejeans117/flexdoc/issues',
            icon: 'help-circle',
          },
        ],
      },
    },
  });

  // You can still keep Swagger UI if you want both
  SwaggerModule.setup('api', app, document);

  await app.listen(3000);
}
bootstrap();

