# FlexDoc - OpenAPI Documentation Generator

FlexDoc is a beautiful, highly customizable OpenAPI documentation generator that can be easily integrated into backend applications. It provides a modern, interactive interface for API documentation with advanced features and customization options.

## Features

- 🎨 **Beautiful UI**: Modern, responsive design with smooth animations and micro-interactions
- 📱 **Mobile-First**: Fully responsive design that works on all devices
- 🎯 **Interactive**: Live API explorer with request/response examples
- 🔍 **Advanced Search**: Powerful search and filtering capabilities
- 🎨 **Customizable**: Extensive theming and styling options
- ⚡ **Fast**: Optimized performance with lazy loading and efficient rendering
- 🔧 **Easy Integration**: Simple setup for NestJS and other frameworks
- 📖 **OpenAPI 3.0**: Full support for OpenAPI 3.0 specifications

## Quick Start

### React Component (Standalone)

```bash
npm install @flexdoc/client
```

```tsx
import { FlexDoc } from '@flexdoc/client';
import { openApiSpec } from './your-spec';

function App() {
  return (
    <FlexDoc
      spec={openApiSpec}
      theme='light'
      customStyles={{ fontFamily: 'Inter' }}
    />
  );
}
```

### NestJS Integration

```bash
npm install @flexdoc/backend
```

```typescript
// main.ts
import { setupFlexDoc } from '@flexdoc/backend';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Create OpenAPI document
  const config = new DocumentBuilder()
    .setTitle('My API')
    .setDescription('API documentation')
    .setVersion('1.0')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // Setup FlexDoc
  setupFlexDoc(app, '/docs', {
    spec: document,
    options: {
      title: 'My API Documentation',
      theme: 'light',
      customCss: `
        .flexdoc-container {
          --primary-color: #3b82f6;
        }
      `,
    },
  });

  await app.listen(3000);
}
```

### Express Integration

```typescript
import express from 'express';
import { generateFlexDocHTML } from 'flexdoc';

const app = express();

app.get('/docs', (req, res) => {
  const html = generateFlexDocHTML(openApiSpec, {
    title: 'My API Documentation',
    theme: 'light',
  });
  res.send(html);
});
```

## Configuration Options

### FlexDocOptions

```typescript
interface FlexDocOptions {
  title?: string; // Page title
  description?: string; // Page description
  theme?: 'light' | 'dark'; // Color theme
  customCss?: string; // Custom CSS styles
  customJs?: string; // Custom JavaScript
  favicon?: string; // Custom favicon URL
  logo?: string; // Custom logo URL

  // Advanced theming
  theme_?: {
    colors?: {
      primary?: string; // Primary brand color
      secondary?: string; // Secondary color
      accent?: string; // Accent color
      background?: string; // Background color
      surface?: string; // Surface color
      text?: string; // Text color
      textSecondary?: string; // Secondary text color
      border?: string; // Border color
    };
    typography?: {
      fontSize?: string; // Base font size
      fontFamily?: string; // Font family
      lineHeight?: string; // Line height
    };
    spacing?: {
      unit?: number; // Base spacing unit
    };
  };
}
```

## Examples

### Basic Usage

```typescript
setupFlexDoc(app, '/docs', {
  spec: openApiDocument,
  options: {
    title: 'Pet Store API',
    description: 'Beautiful API documentation',
    theme: 'light',
  },
});
```

### Custom Theming

```typescript
setupFlexDoc(app, '/docs', {
  spec: openApiDocument,
  options: {
    title: 'My API',
    theme: 'light',
    theme_: {
      colors: {
        primary: '#6366f1',
        secondary: '#10b981',
        accent: '#f59e0b',
      },
      typography: {
        fontFamily: 'Inter, sans-serif',
        fontSize: '14px',
      },
    },
    customCss: `
      .flexdoc-container {
        --border-radius: 12px;
      }
      .method-badge {
        border-radius: var(--border-radius);
      }
    `,
  },
});
```

### Multiple Documentation Sites

```typescript
// Public API docs
setupFlexDoc(app, '/docs', {
  spec: publicApiSpec,
  options: { title: 'Public API' },
});

// Internal API docs
setupFlexDoc(app, '/internal-docs', {
  spec: internalApiSpec,
  options: {
    title: 'Internal API',
    theme: 'dark',
  },
});
```

## Running the Example

1. Clone the repository
2. Navigate to the NestJS example:
   ```bash
   cd examples/nestjs-example
   npm install
   npm run start:dev
   ```
3. Open your browser:
   - FlexDoc: http://localhost:3000/docs
   - Swagger UI: http://localhost:3000/swagger

## Comparison with Other Tools

| Feature              | FlexDoc | Redoc | Swagger UI |
| -------------------- | ------- | ----- | ---------- |
| Modern UI            | ✅      | ✅    | ❌         |
| Mobile Responsive    | ✅      | ✅    | ⚠️         |
| Interactive Examples | ✅      | ❌    | ✅         |
| Advanced Search      | ✅      | ⚠️    | ❌         |
| Custom Theming       | ✅      | ⚠️    | ⚠️         |
| Performance          | ✅      | ✅    | ⚠️         |
| Easy Integration     | ✅      | ✅    | ✅         |

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## Testing

FlexDoc uses Jest for testing both the client and backend packages. Each package has its own test configuration and coverage reports.

### Client Tests

```bash
cd packages/client
npm test
```

To generate coverage reports:

```bash
cd packages/client
npm run test:coverage
```

### Backend Tests

```bash
cd packages/backend
npm test
```

To generate coverage reports:

```bash
cd packages/backend
npm run test:coverage
```

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

- 📖 [Documentation](https://flexdoc.dev)
- 💬 [Discord Community](https://discord.gg/flexdoc)
- 🐛 [Issue Tracker](https://github.com/flexdoc/flexdoc/issues)
- 📧 [Email Support](mailto:support@flexdoc.dev)

