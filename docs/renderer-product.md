# FlexDoc shared renderer

FlexDoc has one product renderer: the standalone browser bundle built by `@prauga/flexdoc-client`. Server/framework packages are adapters. They provide an OpenAPI document and renderer options, then serve the versioned renderer assets; they must not implement their own schema, request, search, or code-sample UI.

## Renderer contract v1

Language adapters exchange JSON shaped like:

```json
{
  "contractVersion": "1",
  "spec": { "openapi": "3.1.0", "info": {}, "paths": {} },
  "options": {}
}
```

The machine-readable contract is `packages/renderer-contract/flexdoc-renderer.schema.json`. Release builds attach `flexdoc-renderer.tar.gz`, containing the standalone JavaScript, CSS, contract schema, and manifest. Go, Java, Rust, Python, and other integrations can vendor or download that artifact without reimplementing renderer behavior.

## Try It

Try It is enabled by default and uses the same request builder as generated code samples. It understands operation/path/global servers, path/query/header/cookie parameters, request bodies, HTTP bearer/basic auth, API keys, OAuth/OpenID bearer tokens, and response status/headers/body.

```ts
{
  tryIt: {
    enabled: true,
    defaultServer: 'https://api.example.com',
    credentials: 'same-origin'
  }
}
```

Browser security still applies. Cross-origin Try It calls require the API to allow the documentation origin with CORS. Browsers also restrict setting some forbidden headers such as `Cookie`; cookie-authenticated calls should normally use browser-managed cookies with an appropriate `credentials` mode.

The React API also accepts a `requestInterceptor`, useful for client-side request rewriting. That function is intentionally not part of the JSON contract because functions cannot be transported between non-JavaScript adapters.

## Generated code examples

Code examples are derived from the exact request currently configured in Try It, so parameter, server, header, body, and auth changes are reflected in the sample. Supported languages are cURL, JavaScript, Python, Go, and Java.

```ts
{
  codeSamples: {
    enabled: true,
    languages: ['curl', 'javascript', 'python', 'go', 'java']
  }
}
```

## OpenAPI 3.1

The renderer supports the OpenAPI 3.1 document fields used by FlexDoc and renders common JSON Schema 2020-12 constructs, including type unions, `const`, examples, arrays, `allOf`, `oneOf`, `anyOf`, additional properties, and recursive local references. Recursive references are displayed as references instead of being expanded indefinitely.

## Responsive behavior

Desktop uses a persistent endpoint sidebar. Smaller viewports use a modal navigation drawer with touch-sized controls, Escape-to-close, background scroll locking, horizontally scrollable code/language tabs, and content padding sized for narrow screens. Endpoint selection is reflected in the URL hash so links can be shared and browser back/forward restores selection.

## Options and compatibility

The canonical renderer consumes title/description/version overrides, tag groups, light/dark or detailed theme configuration, logo, footer, favicon/host-page customizations, topbar/download/hostname controls, schema ordering, response expansion, extension visibility, request headers, payload sample selection, Try It, and code sample configuration.

Several historical renderer flags map naturally to the canonical React implementation rather than toggling a separate code path: browser scrollbars are native, endpoint paths already live in the middle/main panel, collapsed sections render their content conditionally, and warnings/loading UI only appear when relevant. New adapters should pass options through rather than interpret them independently.

## Authentication boundary

`FlexDocOptions.auth` protects the documentation route in the Node backend. Its `secretKey` is server-only and is deliberately removed before browser configuration is serialized. API credentials entered in Try It are runtime browser values and are separate from route authentication.
