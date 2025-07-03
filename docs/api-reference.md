# FlexDoc API Reference

This document provides a comprehensive reference for the FlexDoc API, covering both backend and frontend components.

## Backend API

### NestJS Module

#### `FlexDocModule.forRoot(options)`

Creates and configures the FlexDoc module for NestJS applications.

```typescript
import { FlexDocModule } from '@flexdoc/backend';

@Module({
  imports: [
    FlexDocModule.forRoot({
      path: 'api-docs',
      options: {
        title: 'API Documentation',
        // ... other options
      },
    }),
  ],
})
export class AppModule {}
```

**Parameters:**

| Parameter | Type     | Description                                                             |
| --------- | -------- | ----------------------------------------------------------------------- |
| `path`    | `string` | The URL path where the documentation will be served                     |
| `options` | `object` | Configuration options (see [Configuration Options](./configuration.md)) |

#### `FlexDocModule.forRootAsync(options)`

Asynchronously creates and configures the FlexDoc module for NestJS applications.

```typescript
import { FlexDocModule } from '@flexdoc/backend';

@Module({
  imports: [
    FlexDocModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        path: configService.get('FLEXDOC_PATH'),
        options: {
          title: configService.get('FLEXDOC_TITLE'),
          // ... other options
        },
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
```

**Parameters:**

| Parameter    | Type         | Description                                      |
| ------------ | ------------ | ------------------------------------------------ |
| `imports`    | `Array<any>` | Modules to import                                |
| `useFactory` | `Function`   | Factory function that returns the module options |
| `inject`     | `Array<any>` | Dependencies to inject into the factory function |

### Express Setup

#### `setupFlexDoc(app, options)`

Sets up FlexDoc for Express applications.

```typescript
import express from 'express';
import { setupFlexDoc } from '@flexdoc/backend';

const app = express();

setupFlexDoc(app, {
  path: 'api-docs',
  options: {
    title: 'API Documentation',
    // ... other options
  },
});
```

**Parameters:**

| Parameter         | Type      | Description                                                             |
| ----------------- | --------- | ----------------------------------------------------------------------- |
| `app`             | `Express` | The Express application instance                                        |
| `options`         | `object`  | Configuration options                                                   |
| `options.path`    | `string`  | The URL path where the documentation will be served                     |
| `options.options` | `object`  | Documentation options (see [Configuration Options](./configuration.md)) |

### Authentication

#### `generatePassword(username, secret)`

Generates a deterministic password for basic authentication.

```typescript
import { generatePassword } from '@flexdoc/backend/auth';

const password = generatePassword('admin', 'your-strong-secret-key');
```

**Parameters:**

| Parameter  | Type     | Description    |
| ---------- | -------- | -------------- |
| `username` | `string` | The username   |
| `secret`   | `string` | The secret key |

**Returns:** `string` - The generated password

#### `generateToken(expiry, secret)`

Generates a JWT token for bearer authentication.

```typescript
import { generateToken } from '@flexdoc/backend/auth';

const token = generateToken(30, 'your-strong-secret-key');
```

**Parameters:**

| Parameter | Type     | Description          |
| --------- | -------- | -------------------- |
| `expiry`  | `number` | Token expiry in days |
| `secret`  | `string` | The secret key       |

**Returns:** `string` - The generated JWT token

## Frontend API

### React Component

#### `<FlexDoc />`

React component for rendering FlexDoc documentation.

```tsx
import { FlexDoc } from '@bluejeans/flexdoc';
import { openApiSpec } from './your-spec';

function App() {
  return (
    <FlexDoc
      spec={openApiSpec}
      options={{
        title: 'API Documentation',
        // ... other options
      }}
    />
  );
}
```

**Props:**

| Prop      | Type     | Description                                                             |
| --------- | -------- | ----------------------------------------------------------------------- |
| `spec`    | `object` | OpenAPI specification object                                            |
| `options` | `object` | Configuration options (see [Configuration Options](./configuration.md)) |
| `url`     | `string` | URL to fetch the OpenAPI specification from (alternative to `spec`)     |

### Theme API

#### `themes`

Object containing predefined themes.

```typescript
import { FlexDoc, themes } from '@bluejeans/flexdoc';

function App() {
  return (
    <FlexDoc
      spec={openApiSpec}
      options={{
        theme: themes.material,
      }}
    />
  );
}
```

**Available Themes:**

- `themes.default`
- `themes.material`
- `themes.github`
- `themes.monokai`
- `themes.nord`

## CLI Tools

### Authentication CLI

The FlexDoc package includes CLI tools for generating authentication credentials.

#### Basic Authentication

```bash
npx ts-node generate-auth.ts basic --username admin --secret your-strong-secret-key
```

**Options:**

| Option       | Description                       |
| ------------ | --------------------------------- |
| `--username` | Username to generate password for |
| `--secret`   | Secret key used for generation    |

#### Bearer Authentication

```bash
npx ts-node generate-auth.ts bearer --expiry 30 --secret your-strong-secret-key
```

**Options:**

| Option     | Description                        |
| ---------- | ---------------------------------- |
| `--expiry` | Token expiry in days (default: 30) |
| `--secret` | Secret key used for signing        |

## Interfaces

### FlexDocOptions

```typescript
interface FlexDocOptions {
  title?: string;
  description?: string;
  version?: string;
  theme?: ThemeOptions;
  hideHostname?: boolean;
  pathInMiddlePanel?: boolean;
  defaultModelsExpandDepth?: number;
  defaultModelExpandDepth?: number;
  defaultModelRendering?: 'model' | 'example';
  displayOperationId?: boolean;
  displayRequestDuration?: boolean;
  docExpansion?: 'list' | 'full' | 'none';
  filter?: boolean | string;
  maxDisplayedTags?: number;
  showExtensions?: boolean;
  showCommonExtensions?: boolean;
  tagSorter?: (a: any, b: any) => number;
  operationSorter?: (a: any, b: any) => number;
  favicon?: string;
  auth?: AuthOptions;
  customCss?: string;
}
```

### AuthOptions

```typescript
interface AuthOptions {
  type: 'basic' | 'bearer';
  secretKey: string;
}
```

### ThemeOptions

```typescript
interface ThemeOptions {
  primaryColor?: string;
  secondaryColor?: string;
  backgroundColor?: string;
  textColor?: string;
  headingColor?: string;
  linkColor?: string;
  navbarColor?: string;
  navbarTextColor?: string;
  codeBackgroundColor?: string;
  codeTextColor?: string;
  borderColor?: string;
  errorColor?: string;
  successColor?: string;
  warningColor?: string;
  infoColor?: string;
  components?: {
    header?: HeaderThemeOptions;
    sidebar?: SidebarThemeOptions;
    content?: ContentThemeOptions;
    codeBlock?: CodeBlockThemeOptions;
    button?: ButtonThemeOptions;
  };
  dark?: ThemeOptions;
  logo?: {
    url: string;
    altText?: string;
    height?: string;
  };
}
```

For more detailed information, see the [Examples](../packages/examples) directory.
