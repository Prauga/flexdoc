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

Basic and Advanced Try It are two densities over one request state. Basic keeps the operation workflow compact; Advanced adds scripts, advanced authentication, environment selection, and full response inspection without mounting a second request editor.

**Open in API Client** carries the live request into a sibling FlexDoc view. The full workspace owns collections, imports, environments, history, and collection runs and replaces the documentation sidebar while active; it is not embedded inside operation details.

Browser security still applies. Cross-origin Try It calls require the API to allow the documentation origin with CORS. Browsers also restrict setting some forbidden headers such as `Cookie`, and browser Fetch may reject GET/HEAD requests with bodies. Capability-gated API-host execution handles supported browser-impossible requests when the serving adapter explicitly enables it.

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

## Runtime Intelligence

When a serving adapter explicitly advertises Runtime Intelligence, the renderer fetches the no-store snapshot from `<docsPath>/__flexdoc/runtime`. The panel shows framework/runtime context, matched routes, implemented-but-undocumented routes, documented routes not observed at runtime, and whether discovery is complete or partial. Documented drift rows navigate directly to the operation.

Runtime Intelligence is off by default and shares the documentation authentication boundary. Framework support and safe metadata rules are documented in [Runtime Intelligence](./runtime-intelligence.md).

## Responsive behavior

Desktop bounds the product shell so the endpoint sidebar and operation content scroll independently. The sibling API Client similarly separates its collections sidebar from request content. Smaller viewports use a modal navigation drawer with touch-sized controls, Escape-to-close, background scroll locking, horizontally scrollable code/language tabs, and content padding sized for narrow screens. Endpoint selection uses collision-safe URL hashes so links can be shared and browser back/forward restores selection.

The command palette supports keyboard navigation across operations and product commands, including Overview, Runtime Intelligence, API Client, Settings, and Send when a visible request can be executed. Results are windowed for large specifications.

Viewer Settings persist expansion, sidebar, and light/dark/high-contrast appearance preferences. Reduced-motion, forced-color/high-contrast, and operation print layouts are first-class renderer paths.

## Options and compatibility

The canonical renderer consumes title/description/version overrides, tag groups, light/dark or detailed theme configuration, logo, footer, favicon/host-page customizations, topbar/download/hostname controls, schema ordering, response expansion, extension visibility, request headers, payload sample selection, Try It, and code sample configuration.

Several historical renderer flags map naturally to the canonical React implementation rather than toggling a separate code path: browser scrollbars are native, endpoint paths already live in the middle/main panel, collapsed sections render their content conditionally, and warnings/loading UI only appear when relevant. New adapters should pass options through rather than interpret them independently.

## Authentication boundary

`FlexDocOptions.auth` protects the documentation route in the Node backend. Its `secretKey` is server-only and is deliberately removed before browser configuration is serialized. API credentials entered in Try It are runtime browser values and are separate from route authentication.
