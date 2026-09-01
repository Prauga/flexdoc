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

For a Postman-style local workspace with reusable collections, folders, saved requests, and named environments, use `ApiClientWorkspace`. Workspace data is persisted in IndexedDB by default and stays local to the browser. Set `persistenceKey={false}` to disable persistence, or provide a custom string to isolate multiple workspaces.

Environment variables use `{{variable}}` placeholders. The active environment is resolved across request URLs, query parameters, headers, bodies, content types, methods, and common authentication fields at request-build time. Saved requests retain their raw templates, so switching environments does not rewrite collection data. Execution, `onRequestChange`, and code-generation consumers receive the resolved request while the editor continues to display the raw template.

Environment values are displayed as plain text and, when persistence is enabled, stored unencrypted in browser IndexedDB. Treat tokens and other secrets entered as environment values as local browser data rather than protected credential storage.

Template expansion is intentionally one pass: if a variable value itself contains another `{{variable}}` placeholder, that nested placeholder is left unresolved. The low-level resolver also supports method placeholders programmatically, but the current API Client method control is a fixed HTTP-verb selector and does not accept free-form `{{method}}` input.

```jsx
import { ApiClientWorkspace } from '@prauga/flexdoc-client';

function RequestWorkspace() {
  return (
    <ApiClientWorkspace
      persistenceKey='my-api'
      initialRequest={{
        method: 'GET',
        url: '{{baseUrl}}/pets',
      }}
    />
  );
}
```

Create an environment in the workspace, add a `baseUrl` variable such as `https://api.example.com`, and select that environment before sending the templated request.

For programmatic request construction, `buildHttpRequest` accepts arbitrary methods, URLs, ordered query parameters and headers, bodies, common authorization modes, and an optional `variables` map. `resolveHttpRequestDraftVariables` resolves a draft without mutating it, while `requestDraftFromBuiltRequest` converts an existing canonical FlexDoc request into an editable API-client draft.

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

AGPL-3.0-or-later
