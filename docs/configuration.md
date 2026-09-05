# FlexDoc Configuration Options

This document outlines all available configuration options for FlexDoc. These options can be used to customize the appearance and behavior of your API documentation.

## Basic Configuration

When setting up FlexDoc, you can provide configuration options as follows:

### For NestJS:

```typescript
FlexDocModule.forRoot({
  path: 'api-docs',
  options: {
    // Your configuration options here
  },
});
```

### For Express:

```typescript
setupFlexDoc(app, {
  path: 'api-docs',
  options: {
    // Your configuration options here
  },
});
```

### For React Component:

```tsx
<FlexDoc
  spec={openApiSpec}
  options={
    {
      // Your configuration options here
    }
  }
/>
```

## Available Options

| Option                     | Type                         | Default                           | Description                                                              |
| -------------------------- | ---------------------------- | --------------------------------- | ------------------------------------------------------------------------ |
| `title`                    | `string`                     | `"API Documentation"`             | The title displayed in the documentation header                          |
| `description`              | `string`                     | `""`                              | A description of your API that appears below the title                   |
| `version`                  | `string`                     | `"1.0.0"`                         | The version of your API                                                  |
| `theme`                    | `object`                     | See [Theming Guide](./theming.md) | Custom theme options                                                     |
| `hideHostname`             | `boolean`                    | `false`                           | Whether to hide the hostname in the API endpoints                        |
| `expand`                   | `string | string[]`          | omitted (compact)                 | Default expanded endpoint sections; accepts presets or explicit sections |
| `pathInMiddlePanel`        | `boolean`                    | `false`                           | Whether to show the path in the middle panel instead of the left sidebar |
| `defaultModelsExpandDepth` | `number`                     | `1`                               | The default expand depth for models                                      |
| `defaultModelExpandDepth`  | `number`                     | `1`                               | The default expand depth for model properties                            |
| `defaultModelRendering`    | `"model" \| "example"`       | `"model"`                         | The default rendering for models                                         |
| `displayOperationId`       | `boolean`                    | `false`                           | Whether to display the operation ID                                      |
| `displayRequestDuration`   | `boolean`                    | `false`                           | Whether to display the request duration                                  |
| `docExpansion`             | `"list" \| "full" \| "none"` | `"list"`                          | The default expansion setting for the operations                         |
| `filter`                   | `boolean \| string`          | `false`                           | Whether to show the filter box                                           |
| `maxDisplayedTags`         | `number`                     | `null`                            | The maximum number of tags to display                                    |
| `showExtensions`           | `boolean`                    | `false`                           | Whether to display vendor extensions                                     |
| `showCommonExtensions`     | `boolean`                    | `false`                           | Whether to display common extensions                                     |
| `tagSorter`                | `(a, b) => number`           | `null`                            | A function to sort the tags                                              |
| `operationSorter`          | `(a, b) => number`           | `null`                            | A function to sort operations                                            |
| `favicon`                  | `string`                     | `null`                            | The URL to a custom favicon                                              |
| `auth`                     | `object`                     | `null`                            | Authentication configuration (see below)                                 |

## Expansion Defaults and Viewer Preferences

FlexDoc keeps endpoint pages compact by default. Hosts can set the initial expansion baseline with `expand`:

```typescript
options: {
  expand: 'all'
  // or: expand: 'documentation'
  // or: expand: ['documentation', 'tryIt']
  // or explicit sections: ['parameters', 'responses', 'codeSamples']
}
```

Supported presets are `minimal`, `documentation`, `interactive`, `all`, and `none`. Explicit section names are `parameters`, `requestBody`, `responses`, `tryIt`, and `codeSamples`. `expandResponses` remains accepted for backwards compatibility when `expand` is not supplied, but new integrations should use `expand`.

The host value is a default rather than a policy. Readers can open **Settings** and choose their own expansion baseline. When the top bar is hidden in an embed, FlexDoc provides a floating Settings entry point. The preference is stored locally per documentation origin and API title and takes precedence over the host default. **Reset to documentation defaults** removes the viewer override. Individual section clicks are transient and are not persisted.

## Language Adapter Renderer Options

The self-hosted Go, Python, PHP, Ruby, Elixir, Rust (Axum and Actix), .NET, and Java adapters expose the same renderer settings as the JavaScript host. Existing first-class adapter fields such as `path`, `specUrl`, `title`, `theme`, and `tryIt.enabled` remain authoritative. The following additional values are injected into `window.__FLEXDOC_OPTIONS__` only when the host supplies them:

| Renderer field | Type | Omitted behavior |
| --- | --- | --- |
| `expand` | preset string or section list | compact renderer default |
| `tryIt.defaultServer` | string | renderer chooses the operation/spec server |
| `tryIt.credentials` | `omit`, `same-origin`, or `include` | renderer fetch default |
| `tryIt.apiClientPersistenceKey` | string or `false` | renderer derives its normal workspace key; `false` disables IndexedDB workspace persistence |

For typed languages, adapter APIs use the closest native representation. Java Spring additionally exposes `expand-sections`; when both `expand` and `expand-sections` are configured, the section list wins. All language hosts preserve JSON types, so `apiClientPersistenceKey: false` is emitted as JSON `false`, never the string `"false"`.

The JavaScript backend integrations (Express, Fastify, NestJS, and Hono) already pass the complete `options` object through and therefore do not need a separate adapter mapping for these fields.

## Authentication Options

FlexDoc supports authentication to protect your API documentation. See the [Authentication Guide](../packages/backend/docs/authentication.md) for detailed information.

```typescript
options: {
  auth: {
    type: 'basic', // or 'bearer'
    secretKey: 'your-strong-secret-key'
  }
}
```

## Custom Styling

You can customize the appearance of your documentation using the `theme` option. See the [Theming Guide](./theming.md) for detailed information.

```typescript
options: {
  theme: {
    primaryColor: '#1976d2',
    secondaryColor: '#9c27b0',
    backgroundColor: '#ffffff',
    textColor: '#333333',
    // ... other theme options
  }
}
```

## Advanced Configuration

### Custom Request Interceptor

```typescript
options: {
  requestInterceptor: (req) => {
    req.headers['X-Custom-Header'] = 'value';
    return req;
  },
}
```

### Custom Response Interceptor

```typescript
options: {
  responseInterceptor: (res) => {
    console.log(res);
    return res;
  },
}
```

### Custom Layout

```typescript
options: {
  layout: 'BaseLayout', // or 'StandaloneLayout'
}
```

## Example Configuration

```typescript
const options = {
  title: 'My Amazing API',
  description: 'This API provides access to amazing features',
  version: '2.0.0',
  hideHostname: true,
  pathInMiddlePanel: true,
  docExpansion: 'list',
  filter: true,
  theme: {
    primaryColor: '#1976d2',
    secondaryColor: '#9c27b0',
  },
  auth: {
    type: 'basic',
    secretKey: process.env.FLEXDOC_SECRET_KEY,
  },
};
```

For more examples, see the [Examples](../examples) directory.
