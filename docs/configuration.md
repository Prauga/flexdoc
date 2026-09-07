# FlexDoc configuration

The canonical renderer consumes `FlexDocRendererOptions`. The Node backend exposes the closely related `FlexDocOptions`, adding server-only documentation authentication and host capabilities. Native adapters map their typed configuration fields into the same renderer contract.

## Mounting the renderer

React:

```tsx
<FlexDoc
  spec={openApiDocument}
  theme="light"
  options={{ title: 'Pets API' }}
/>;
```

Express:

```ts
setupExpressFlexDoc(app, '/docs', {
  spec: openApiDocument,
  options: { title: 'Pets API' },
});
```

`FlexDocModuleOptions` accepts `path`, either `spec` or `specUrl`, and `options`.

## Metadata and chrome

Renderer options include:

- `title`, `description`, `altDescription`, and `version`;
- `tagGroups` for grouping OpenAPI tags;
- `logo`, `favicon`, and `footer`;
- `hideTopbar`, `hideDownloadButton`, and `hideHostname`;
- `locale` and partial `messages` overrides for renderer-owned chrome.

OpenAPI-authored operation summaries, descriptions, and schema content remain sourced from the document; `messages` translates renderer controls and status copy.

## Expansion and navigation

`expand` controls the initial operation-section baseline:

```ts
options: {
  expand: 'documentation',
  // or: ['parameters', 'responses', 'tryIt']
}
```

Presets are `minimal`, `documentation`, `interactive`, `all`, and `none`. Explicit sections are `parameters`, `requestBody`, `responses`, `tryIt`, and `codeSamples`.

Viewer Settings can override the host baseline. Preferences are stored per documentation origin and API title. `expandResponses` remains accepted for backward compatibility when `expand` is omitted.

Additional presentation controls include:

- `defaultModelsExpandDepth`;
- `requiredPropsFirst` and `sortPropsAlphabetically`;
- `showExtensions` and `showCommonExtensions`;
- `showRequestHeaders`, `payloadSampleIdx`, and `noAutoAuth`;
- `lazyRendering`, `scrollYOffset`, `nativeScrollbars`, and `suppressWarnings`.

Some historical compatibility flags describe behavior now inherent in the canonical renderer and may not create a separate UI path.

## Try It and API Client

```ts
options: {
  tryIt: {
    enabled: true,
    defaultServer: 'https://api.example.com',
    credentials: 'same-origin',
    apiClientPersistenceKey: 'pets-api',
  }
}
```

Try It provides Basic and Advanced density over one request state. **Open in API Client** navigates to a sibling workspace view; it does not embed a second workspace inside operation details.

`tryIt` accepts:

- `enabled`;
- `defaultServer`;
- browser `credentials`: `omit`, `same-origin`, or `include`;
- `apiClientPersistenceKey`: a string, or `false` to disable workspace persistence;
- `requestInterceptor` in the React API only;
- adapter-provided `hostExecution` capability metadata.

GET and HEAD bodies are retained. Browsers may reject them; when available, API-host execution sends them from the host.

## Code samples

```ts
options: {
  codeSamples: {
    enabled: true,
    languages: ['curl', 'javascript', 'python', 'go', 'java'],
  }
}
```

Samples reflect the request currently configured in Try It.

## Documentation authentication

The Node backend can protect the documentation subtree:

```ts
options: {
  auth: {
    type: 'basic',
    secretKey: process.env.FLEXDOC_SECRET,
  }
}
```

`basic` and `bearer` are supported. `secretKey` is server-only and is removed before renderer options are serialized. This protects the documentation route; it is separate from credentials used by Try It requests.

## API-host execution

Node host execution is explicit opt-in:

```ts
options: {
  tryIt: {
    hostExecution: {
      enabled: true,
      allowedOrigins: ['https://api.example.com'],
    },
  },
}
```

It supports requests requiring the host cookie jar, configured client certificates, Digest, Hawk, OAuth 1.0, or AWS Signature V4. The renderer receives only public capability metadata, certificate IDs/names, and endpoint paths. See [API-host execution](./host-execution.md).

## Runtime Intelligence

Runtime Intelligence is also explicit opt-in:

```ts
options: {
  runtimeIntelligence: true,
}
```

Supported hosts expose `GET <docsPath>/__flexdoc/runtime` beneath the same documentation authentication boundary. The renderer compares observed routes with the OpenAPI document and reports whether discovery is complete or partial. See [Runtime Intelligence](./runtime-intelligence.md).

## Native adapter mappings

Go, Python, PHP, Ruby, Elixir, Rust, ASP.NET Core, and Java adapters expose native equivalents for their supported renderer settings. Common fields are:

- docs `path`, `specUrl`, and `title`;
- initial `theme`;
- Try It enablement, server, credentials, and persistence key;
- section expansion.

Runtime Intelligence and host execution availability are adapter-specific. Do not infer support from the renderer UI alone; adapters advertise capabilities explicitly. Consult the package README and native API comments for exact field names.

## Theming

`ThemeConfig` supports nested color, typography, sidebar, and HTTP-method tokens. See [Theming](./theming.md) for the current shape; legacy flat color keys and built-in theme-preset exports are not part of the 3.0 API.
