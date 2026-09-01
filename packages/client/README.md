# FlexDoc Client

A modern, customizable React component library for rendering OpenAPI documentation.

## Installation

```bash
npm install @prauga/flexdoc-client
```

## Usage

### Basic Usage

```jsx
import { FlexDoc } from '@prauga/flexdoc-client';
import myOpenApiSpec from './my-openapi-spec.json';

function ApiDocumentation() {
  return <FlexDoc spec={myOpenApiSpec} theme='light' />;
}
```

### Standalone API Client

`ApiClient` is the low-level request editor and executor. It can execute arbitrary HTTP requests without requiring an OpenAPI document and uses the same canonical request shape as FlexDoc's OpenAPI request builder and code-sample generator.

```jsx
import { ApiClient } from '@prauga/flexdoc-client';

function RequestEditor() {
  return (
    <ApiClient
      initialRequest={{
        method: 'GET',
        url: 'https://api.example.com/pets',
        query: [{ key: 'limit', value: '10' }],
      }}
    />
  );
}
```

For a Postman-style local workspace with reusable collections, folders, and saved requests, use `ApiClientWorkspace`. Workspace data is persisted in IndexedDB by default and stays local to the browser. Set `persistenceKey={false}` to disable persistence, or provide a custom string to isolate multiple workspaces.

```jsx
import { ApiClientWorkspace } from '@prauga/flexdoc-client';

function RequestWorkspace() {
  return (
    <ApiClientWorkspace
      persistenceKey='my-api'
      initialRequest={{
        method: 'GET',
        url: 'https://api.example.com/pets',
      }}
    />
  );
}
```

For programmatic request construction, `buildHttpRequest` accepts arbitrary methods, URLs, ordered query parameters and headers, bodies, and common authorization modes. `requestDraftFromBuiltRequest` converts an existing canonical FlexDoc request into an editable API-client draft.

### With Custom Styling

```jsx
import { FlexDoc } from '@prauga/flexdoc-client';
import myOpenApiSpec from './my-openapi-spec.json';

function ApiDocumentation() {
  return (
    <FlexDoc
      spec={myOpenApiSpec}
      theme='dark'
      customStyles={{
        fontFamily: 'Inter, sans-serif',
        // Add any other CSS properties
      }}
    />
  );
}
```

### Loading OpenAPI Spec from URL

```jsx
import { useState, useEffect } from 'react';
import { FlexDoc, OpenAPIParser } from '@prauga/flexdoc-client';

function ApiDocumentation() {
  const [spec, setSpec] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchSpec() {
      try {
        const response = await fetch('https://your-api.com/openapi.json');
        const text = await response.text();
        const parsedSpec = await OpenAPIParser.parseSpec(text);
        setSpec(parsedSpec);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchSpec();
  }, []);

  if (loading) return <div>Loading API documentation...</div>;
  if (error) return <div>Error loading API documentation: {error}</div>;
  if (!spec) return <div>No API specification found</div>;

  return <FlexDoc spec={spec} />;
}
```

## Props

| Prop           | Type                  | Default   | Description                                    |
| -------------- | --------------------- | --------- | ---------------------------------------------- |
| `spec`         | `OpenAPISpec`         | Required  | The OpenAPI specification object               |
| `theme`        | `'light' \| 'dark'`   | `'light'` | The theme to use for the documentation         |
| `customStyles` | `React.CSSProperties` | `{}`      | Custom CSS styles to apply to the root element |

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm test
```

## License

MIT
