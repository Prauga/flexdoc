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

`hostExecution: true` also enables the Node executor. When `allowedOrigins` is omitted, the executor derives its exact allowed origins from the OpenAPI `servers` entries available to the host. Relative server URLs are resolved against the documentation request origin, and an OpenAPI document with no `servers` entry uses the same-origin `/` default. An explicit absolute `servers` list does not implicitly add the docs origin. For production deployments, an explicit `allowedOrigins` list is recommended when the intended execution surface is narrower than the specification.

FlexDoc 3.3 source adds the first non-Node implementation of this same protocol in the Spring Boot adapter. Spring host execution is **off by default** and requires an explicit exact-origin allowlist. When enabled, the Spring host registers `POST <docsPath>/__flexdoc/execute` and advertises `available: true`. It consumes the existing canonical JSON, Base64 binary, and multipart descriptor-plus-indexed-file envelope; it does not introduce a Java-specific request protocol.

The shared JVM, JAX-RS, .NET, Python, Go, Ruby, PHP, Axum, Actix, Elixir, Vert.x, and Ktor surfaces remain truthful: unless a transport owns a real execute route, they continue to advertise `available: false` or omit the capability entirely. No adapter registers a fake 501 execute stub merely to look compatible.

## Capabilities

The Node executor currently advertises these host capabilities:

- session cookie jars;
- client certificates configured by ID on the server;
- Digest authentication;
- Hawk authentication;
- OAuth 1.0 request signing;
- AWS Signature Version 4.

Bearer, Basic, OAuth 2.0 access tokens, and header/query API keys can continue through the normal browser executor when no other host-only feature is selected. Cookie API keys require host execution because browsers do not allow arbitrary `Cookie` request headers.

The first Spring 3.3 source slice advertises an empty host-only capability list. It can execute the canonical resolved request shape with ordinary headers/query/body modes plus None, Basic, Bearer, OAuth 2.0 access-token, and header/query API-key authentication. It deliberately does **not** claim cookies, client certificates, Digest, Hawk, NTLM, OAuth 1.0, or AWS Signature V4 until those behaviors are implemented natively.

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

The Spring 3.3 source route consumes all three transport forms. Multipart file parts are reassembled by index into the canonical form-data draft before the neutral JVM executor builds the outbound multipart body. Incoming execution envelopes are bounded to 32 MiB.

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
- link-local/cloud metadata destinations such as `169.254.169.254` are rejected both from literal URLs and again after DNS resolution at connection time;
- cross-origin redirects are rejected, even when both origins are otherwise allowed, so credentials are not forwarded or re-signed onto another origin;
- hop-by-hop, proxy, browser security, `Origin`, `Referer`, `Host`, `Content-Length`, and `Set-Cookie` request headers are not accepted from the browser draft;
- responses are limited to 10 MiB;
- host request envelopes are limited to 32 MiB;
- execution timeout is bounded to 120 seconds;
- same-origin redirect following is bounded to five redirects;
- signed cookie-jar sessions are bounded in memory;
- response `Set-Cookie` values with a `Domain` unrelated to the response host, or scoped to an ICANN/private public suffix, are rejected using the Public Suffix List.

The Spring 3.3 source executor preserves the same protocol-level boundaries where its Java transport can enforce them: explicit opt-in, exact allowed origins, `X-FlexDoc-Execute: 1`, HTTP(S)-only targets, embedded-credential rejection, unsafe-request-header filtering, cross-origin redirect rejection, five-redirect limit, bounded 100 ms–120 s request timeout, 32 MiB incoming envelopes, 10 MiB streamed response bodies, and literal/DNS-preflight rejection of link-local/cloud-metadata destinations.

One JVM limitation is documented rather than hidden: Java 17 `HttpClient` does not expose the selected socket address to this executor, so FlexDoc can resolve and reject dangerous addresses before each request/redirect but cannot perform the Node executor's stronger connection-time DNS pinning. Operators should keep the Spring exact-origin allowlist narrow and avoid allowing attacker-controlled hostnames.

`allowedOrigins` is a security boundary, not a convenience wildcard. Configure the smallest exact-origin set required by the documentation. Do not construct it from untrusted request input. Public documentation with host execution enabled should still be treated as a server-side proxy surface and protected by application authentication/middleware.

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

Spring does not expose a server-side request interceptor in this first 3.3 source slice. Backend-known secret injection and runtime-derived execution context remain later 3.3 work rather than being approximated through browser-visible configuration.

## Product boundary

2.9.5 is the first controlled backend-execution slice, focused on capabilities that are impossible or unreliable in a browser. FlexDoc 3.2 reuses this same advertised execution contract from the headless CLI; see [Headless Runner](./headless-runner.md). FlexDoc 3.3 begins carrying the contract into native adapters with Spring as the first truthful JVM implementation.

The first Spring slice is transport infrastructure, not the whole 3.3 milestone. Ordinary private/VPC execution still needs a deliberate product selection path, and advanced native auth, backend-known secrets, runtime-derived environments, deeper private-network workflows, and more native framework bindings remain follow-on 3.3 work.

The architectural test remains:

> **Could Scalar implement this without being installed inside the backend?**

Host execution clears that bar because the useful capability comes from FlexDoc's position inside the service/network context, not from reproducing another browser API client.
