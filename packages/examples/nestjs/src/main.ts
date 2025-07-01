import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { setupFlexDoc } from '@flexdoc/backend';

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
      theme_: {
        colors: {
          primary: '#3f51b5',
          secondary: '#f50057',
        },
      },
    },
  });

  // You can still keep Swagger UI if you want both
  SwaggerModule.setup('api', app, document);

  await app.listen(3000);
}
bootstrap();

