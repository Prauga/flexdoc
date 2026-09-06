# API-host execution

FlexDoc 2.9.5 adds a capability-gated execution path for requests that the browser cannot faithfully perform. The canonical API Client still owns request editing, variable resolution, scripts, tests, history, and collection runs; when a request needs a host-only capability, the renderer can hand the resolved request to the FlexDoc adapter installed inside the API host.

This is intentionally not a generic open proxy. Host execution is a server capability and is unavailable unless the serving adapter explicitly exposes it.

## Availability

The Node backend package can expose host execution through the Express, Fastify, Hono, and Nest integrations. It is **off by default** and must be explicitly enabled in server-side configuration.

```ts
setupFlexDoc(app, '/docs', {
  spec,
  options: {
    tryIt: {
      hostExecution: {
        allowedOrigins: ['https://api.internal.example'],
      },
    },
  },
});
```

`hostExecution: true` also enables the Node executor. When `allowedOrigins` is omitted, the executor derives its exact allowed origins from the OpenAPI `servers` entries available to the host. For production deployments, an explicit `allowedOrigins` list is recommended when the intended execution surface is narrower than the specification.

The JVM, .NET, Python, Go, Ruby, PHP, Axum, Actix, and Elixir adapters mirror the host-execution opt-in in 2.9.5 so applications can keep one configuration shape across stacks. They do **not** implement host execution yet. With the native opt-in unset (the default), the public capability is omitted. With it explicitly enabled, those adapters advertise `available: false`, an empty capability list, and the conventional `__flexdoc/execute` endpoint shape **without registering that route**. This is intentionally not a 501 stub: the renderer sees the capability as unavailable and disables host-only controls honestly.

## Capabilities

The Node executor currently advertises these host capabilities:

- session cookie jars;
- client certificates configured by ID on the server;
- Digest authentication;
- Hawk authentication;
- OAuth 1.0 request signing;
- AWS Signature Version 4.

Bearer, Basic, OAuth 2.0 access tokens, and header/query API keys can continue through the normal browser executor when no other host-only feature is selected. Cookie API keys require host execution because browsers do not allow arbitrary `Cookie` request headers.

NTLM is represented in the canonical request/auth model so imported workspaces do not lose intent, but the Node executor does **not** advertise NTLM support in 2.9.5. A saved/imported NTLM request therefore remains visibly unavailable until it is served by an adapter that advertises that capability.

## Client certificates

Certificates are configured only on the server:

```ts
tryIt: {
  hostExecution: {
    allowedOrigins: ['https://mtls.internal.example'],
    clientCertificates: [
      {
        id: 'internal-mtls',
        name: 'Internal mTLS',
        cert: process.env.FLEXDOC_CLIENT_CERT!,
        key: process.env.FLEXDOC_CLIENT_KEY!,
        passphrase: process.env.FLEXDOC_CLIENT_KEY_PASSPHRASE,
      },
    ],
  },
}
```

The renderer receives only certificate IDs and display names. Certificate PEM material, private keys, passphrases, and the server-side interceptor are never serialized into the documentation page.

## Cookie jars

Selecting **Use API host cookie jar** creates a signed, documentation-session-scoped jar on the API host. `Set-Cookie` values from executed requests are stored in memory and applied only to matching target URLs on later host-executed requests in the same FlexDoc session.

Ordinary host executions do not allocate a cookie session. Cookie jars are bounded in memory and are not a durable login/session store; restarting the API host clears them.

## Request protocol

The renderer sends host executions to the adapter-owned `__flexdoc/execute` route and requires the custom header `X-FlexDoc-Execute: 1`. JSON requests carry the canonical request draft plus host selections. Multipart requests carry a JSON descriptor plus indexed browser file parts, while binary bodies are transferred as Base64 in the execution envelope.

The response is converted back into the same API Client response shape used by browser execution. Post-response scripts/tests, history, Pretty/Raw/Preview response views, and collection-run accounting therefore remain shared rather than branching into a second execution product.

## Security boundaries

Enabling host execution lets a documentation user ask the API host to make outbound requests. Treat it as a privileged server feature and protect the docs route appropriately.

The Node executor applies these controls:

- host execution is explicit opt-in;
- the existing FlexDoc docs authentication also protects the execution and cookie routes;
- `X-FlexDoc-Execute: 1` is required, preventing a simple cross-site form submission from invoking the executor;
- only HTTP and HTTPS URLs are accepted;
- URL-embedded credentials are rejected;
- outbound destinations must match an exact allowed origin;
- link-local/cloud metadata destinations such as `169.254.169.254` are rejected even if configured;
- cross-origin redirects are rejected, even when both origins are otherwise allowed, so credentials are not forwarded or re-signed onto another origin;
- hop-by-hop, proxy, browser security, `Origin`, `Referer`, `Host`, `Content-Length`, and `Set-Cookie` request headers are not accepted from the browser draft;
- responses are limited to 10 MiB;
- host request envelopes are limited to 32 MiB;
- execution timeout is bounded to 120 seconds;
- same-origin redirect following is bounded to five redirects;
- signed cookie-jar sessions are bounded in memory.

`allowedOrigins` is a security boundary, not a convenience wildcard. Configure the smallest exact-origin set required by the documentation. Do not construct it from untrusted request input.

## Server-side interceptor

Node integrations can modify a prepared outbound request immediately before execution:

```ts
hostExecution: {
  allowedOrigins: ['https://api.internal.example'],
  interceptor: async (request) => ({
    ...request,
    headers: [...request.headers, ['X-Internal-Docs', '1']],
  }),
}
```

The interceptor runs on the API host and is appropriate for backend-known headers or routing context that should never be persisted in the browser workspace. The intercepted URL is checked against the same host-execution allowlist before network execution.

## Product boundary

2.9.5 is the first controlled backend-execution slice, focused on capabilities that are impossible or unreliable in a browser. It does not turn every adapter into a proxy and it does not move the API Client state model onto the server. The broader backend-native roadmap still includes headless runner execution, internal/VPC workflows across adapters, runtime-derived environments, and service-aware execution context.

The architectural test remains:

> **Could Scalar implement this without being installed inside the backend?**

Host execution clears that bar because the useful capability comes from FlexDoc's position inside the service/network context, not from reproducing another browser API client.
