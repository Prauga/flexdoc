# FlexDoc - OpenAPI Documentation Generator

FlexDoc is a beautiful, highly customizable OpenAPI documentation generator that can be easily integrated into backend applications. It provides a modern, interactive interface for API documentation with advanced features and customization options.

## Features

- 🎨 **Beautiful UI**: Modern, responsive design with smooth animations and micro-interactions
- 📱 **Mobile-First**: Fully responsive design that works on all devices
- 🎯 **Interactive**: Live API explorer with request/response examples
- 🔍 **Advanced Search**: Powerful search and filtering capabilities
- 🎨 **Customizable**: Extensive theming and styling options
- 🔒 **Authentication**: Secure your documentation with Basic or Bearer token authentication
- ⚡ **Fast**: Optimized performance with lazy loading and efficient rendering
- 🔧 **Easy Integration**: Simple setup for NestJS and other frameworks
- 📖 **OpenAPI 3.0**: Full support for OpenAPI 3.0 specifications

## Quick Start

### React Component (Standalone)

```bash
npm install @bluejeans/flexdoc
```

```tsx
import { FlexDoc } from '@bluejeans/flexdoc';
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
npm install @bluejeans/flexdoc-backend
```

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { FlexDocModule } from '@bluejeans/flexdoc-backend';

@Module({
  imports: [
    // Your other modules...
    FlexDocModule.forRoot({
      path: 'api-docs',
      options: {
        title: 'My API Documentation',
        hideHostname: true,
        pathInMiddlePanel: true,
        // Enable authentication (optional)
        auth: {
          type: 'basic', // or 'bearer'
          secretKey: process.env.FLEXDOC_SECRET_KEY || 'your-strong-secret-key',
        },
      },
    }),
  ],
})
export class AppModule {}
```

### Express Integration

```typescript
import express from 'express';
import { setupFlexDoc } from '@bluejeans/flexdoc-backend';

const app = express();

// Your other routes and middleware...

// Set up FlexDoc
setupFlexDoc(app, {
  path: 'api-docs',
  options: {
    title: 'My API Documentation',
    hideHostname: true,
    pathInMiddlePanel: true,
    // Enable authentication (optional)
    auth: {
      type: 'basic', // or 'bearer'
      secretKey: process.env.FLEXDOC_SECRET_KEY || 'your-strong-secret-key',
    },
  },
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
```

## Authentication

FlexDoc supports two authentication methods to secure your API documentation:

### Basic Authentication

```typescript
// In your configuration
options: {
  auth: {
    type: 'basic',
    secretKey: process.env.FLEXDOC_SECRET_KEY
  }
}
```

Generate credentials for users:

```bash
# Using the CLI tool
npx ts-node generate-auth.ts basic --username admin --secret your-strong-secret-key
```

### Bearer Authentication (JWT)

```typescript
// In your configuration
options: {
  auth: {
    type: 'bearer',
    secretKey: process.env.FLEXDOC_SECRET_KEY
  }
}
```

Generate JWT tokens:

```bash
# Using the CLI tool
npx ts-node generate-auth.ts bearer --expiry 30 --secret your-strong-secret-key
```

For more details, see the [Authentication Guide](./packages/backend/docs/authentication.md).

## Configuration Options

### FlexDocOptions

```typescript
interface FlexDocOptions {
  title?: string; // Page title
  description?: string; // Page description
  theme?: 'light' | 'dark' | ThemeOptions; // Color theme
  customCss?: string; // Custom CSS styles
  customJs?: string; // Custom JavaScript
  favicon?: string; // Custom favicon URL
  logo?: string; // Custom logo URL
  hideHostname?: boolean; // Hide hostname in API endpoints
  pathInMiddlePanel?: boolean; // Show path in middle panel

  // Authentication
  auth?: {
    type: 'basic' | 'bearer';
    secretKey: string;
  };

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

For a complete list of configuration options, see the [Configuration Guide](./docs/configuration.md).

## Examples

### Basic Usage

```typescript
FlexDocModule.forRoot({
  path: 'api-docs',
  options: {
    title: 'Pet Store API',
    description: 'Beautiful API documentation',
    theme: 'light',
  },
});
```

### Custom Theming

```typescript
FlexDocModule.forRoot({
  path: 'api-docs',
  options: {
    title: 'My API',
    theme: {
      primaryColor: '#6366f1',
      secondaryColor: '#10b981',
      backgroundColor: '#ffffff',
      textColor: '#333333',
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

### Secured Documentation with Authentication

```typescript
FlexDocModule.forRoot({
  path: 'api-docs',
  options: {
    title: 'Internal API Documentation',
    theme: 'dark',
    auth: {
      type: 'basic', // or 'bearer'
      secretKey: process.env.FLEXDOC_SECRET_KEY,
    },
  },
});
```

### Multiple Documentation Sites

```typescript
// Public API docs
FlexDocModule.forRoot({
  path: 'public-docs',
  options: { title: 'Public API' },
});

// Internal API docs (with authentication)
FlexDocModule.forRoot({
  path: 'internal-docs',
  options: {
    title: 'Internal API',
    theme: 'dark',
    auth: {
      type: 'basic',
      secretKey: process.env.FLEXDOC_SECRET_KEY,
    },
  },
});
```

## Running the Example

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Navigate to the NestJS example:
   ```bash
   cd packages/examples/nestjs
   npm run start:dev
   ```
4. Open your browser:
   - FlexDoc: http://localhost:3000/api-docs

## Comparison with Other Tools

| Feature              | FlexDoc | Redoc | Swagger UI |
| -------------------- | ------- | ----- | ---------- |
| Modern UI            | ✅      | ✅    | ❌         |
| Mobile Responsive    | ✅      | ✅    | ⚠️         |
| Interactive Examples | ✅      | ❌    | ✅         |
| Advanced Search      | ✅      | ⚠️    | ❌         |
| Custom Theming       | ✅      | ⚠️    | ⚠️         |
| Authentication       | ✅      | ❌    | ⚠️         |
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

- 📖 [Documentation](https://bluejeans117.github.io/flexdoc)
- 🐛 [Issue Tracker](https://github.com/bluejeans117/flexdoc/issues)
- 📧 [Email Support](mailto:vishnurajesh45@gmail.com)

## Documentation

- [Getting Started](./docs/getting-started.md)
- [Configuration Options](./docs/configuration.md)
- [Theming Guide](./docs/theming.md)
- [Authentication](./packages/backend/docs/authentication.md)
- [API Reference](./docs/api-reference.md)
- [Examples](./packages/examples)
