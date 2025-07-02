# Getting Started with FlexDoc

This guide will help you quickly set up FlexDoc in your project to create beautiful API documentation.

## Installation

### Backend Integration

Install the FlexDoc backend package:

```bash
npm install @flexdoc/backend
```

### Frontend Integration (Optional)

If you want to use FlexDoc as a standalone component in your React application:

```bash
npm install @flexdoc/client
```

## Quick Setup

### NestJS Integration

1. Import the FlexDocModule in your app.module.ts:

```typescript
import { Module } from '@nestjs/common';
import { FlexDocModule } from '@flexdoc/backend';

@Module({
  imports: [
    // Your other modules...
    FlexDocModule.forRoot({
      path: 'api-docs', // The URL path where docs will be served
      options: {
        title: 'My API Documentation',
        hideHostname: true,
        pathInMiddlePanel: true,
      },
    }),
  ],
})
export class AppModule {}
```

2. Start your NestJS application and navigate to `/api-docs` to see your documentation.

### Express Integration

```typescript
import express from 'express';
import { setupFlexDoc } from '@flexdoc/backend';

const app = express();

// Your other routes and middleware...

// Set up FlexDoc
setupFlexDoc(app, {
  path: 'api-docs',
  options: {
    title: 'My API Documentation',
    hideHostname: true,
    pathInMiddlePanel: true,
  },
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
```

### React Component Integration

```tsx
import { FlexDoc } from '@flexdoc/client';
import { openApiSpec } from './your-spec';

function App() {
  return (
    <FlexDoc
      spec={openApiSpec}
      options={{
        title: 'My API Documentation',
        hideHostname: true,
        pathInMiddlePanel: true,
      }}
    />
  );
}
```

## Next Steps

- [Configuration Options](./configuration.md) - Learn about all available configuration options
- [Theming Guide](./theming.md) - Customize the look and feel of your documentation
- [Authentication](../packages/backend/docs/authentication.md) - Secure your API documentation
- [Examples](../packages/examples) - See complete example applications
