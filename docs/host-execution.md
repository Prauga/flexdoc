# API-host execution

FlexDoc's API Client can execute a resolved request either from the browser or through the FlexDoc adapter installed inside the API host. The same API Client still owns request editing, variable resolution, scripts, tests, history, collections, and response views; API-host execution changes only the network transport used for the resolved request.

This is intentionally not a generic open proxy. Host execution is a privileged server capability and is unavailable unless the serving adapter explicitly exposes a real executor.

## When the API host is used

For interactive browser API Client surfaces, `hostExecution.available: true` means the serving adapter owns a working execute endpoint. FlexDoc prefers that API-host transport for ordinary requests even when the adapter advertises `capabilities: []`.

The capability list is reserved for additional host-only features such as server cookie jars, client certificates, or request-signing schemes. An empty capability list therefore means **basic host transport is available, but no advanced host-only features are advertised**; it does not mean the renderer should fall back to browser `fetch` for every ordinary request.

Reusable collection/headless execution keeps direct transport as its default unless host semantics are required or the calling browser surface explicitly opts into host execution. Requests that require a host-only capability continue to fail closed when the selected host does not advertise it. GET/HEAD requests with bodies likewise require a transport that can faithfully carry them.

## Availability and configuration

Host execution is off by default. Enabling it grants documentation users the ability to make outbound requests from the API host's network context, so every adapter requires explicit server-side opt-in and should be protected by the application's documentation authentication or middleware.

The Node backend package exposes the most complete executor through the Express, Fastify, Hono, and Nest integrations:

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

`hostExecution: true` also enables the Node executor. When `allowedOrigins` is omitted for the Node executor, FlexDoc derives exact origins from the OpenAPI `servers` entries available to the host. For production deployments, prefer an explicit list when the intended execution surface is narrower than the specification.

The first native 3.3 slices require an explicit exact-origin allowlist and only advertise `available: true` when a real native execute route is attached.

### Native 3.3 support matrix

| Adapter / framework | Native execute route | Advertised host-only capabilities | Outbound transport |
| --- | --- | --- | --- |
| Node backend — Express / Fastify / Hono / Nest | Yes | cookies, client certificates, Digest, Hawk, OAuth 1.0, AWS SigV4 | Node executor with origin, redirect, DNS/address, timeout, and response bounds |
| Java — Spring Boot | Yes | `[]` | shared JVM transport; validated-address pinning with original Host/TLS hostname |
| Java — Jakarta REST / JAX-RS | Yes | `[]` | same shared JVM transport as Spring |
| Python — FastAPI / ASGI | Yes | `[]` | resolve/validate once, connect only to the validated address set, preserve original Host/TLS hostname |
| Go | Yes | `[]` | custom `net/http` dialer connects directly to validated IPs; proxy routing disabled |
| ASP.NET Core | Yes | `[]` | `SocketsHttpHandler.ConnectCallback` connects only to validated addresses; proxy routing disabled |
| Rust — Axum | Yes | `[]` | reqwest resolution overridden with validated addresses; system proxies disabled |
| Rust — Actix Web | Yes | `[]` | same validated Rust executor as Axum |
| Ruby — Rack / Rails mount | Yes | `[]` | `Net::HTTP` pinned to the validated address while retaining the original HTTP/TLS hostname; environment proxy disabled |
| Elixir — Plug / Phoenix | Yes | `[]` | passive-mode Mint connection to validated addresses with original Host/SNI/TLS verification |
| PHP — Laravel / Symfony | Yes | `[]` | direct socket connection to validated addresses with original Host/TLS SNI; system HTTP proxy variables are not used |

Python Flask/Django/WSGI integrations remain renderer-only in this first native slice: they do not advertise host execution until they own a real native execute binding.

Framework-neutral JVM hosting can be reused by other Java/Kotlin integrations, but an integration must still own and protect the execute route before it may advertise `available: true`.

## Capabilities

The Node executor currently advertises these advanced host-only capabilities:

- session cookie jars;
- client certificates configured by ID on the server;
- Digest authentication;
- Hawk authentication;
- OAuth 1.0 request signing;
- AWS Signature Version 4.

The first native 3.3 adapters deliberately advertise `capabilities: []`. They execute ordinary resolved HTTP requests and common browser-compatible authentication/body shapes, but they do **not** claim session cookie jars, client certificates, Digest, Hawk, NTLM, OAuth 1.0, or AWS Signature V4 unless that behavior is actually implemented.

Bearer, Basic, OAuth 2.0 access tokens, and header/query API keys do not require an advertised host-only capability. Cookie API keys require cookie-capable host execution because browsers do not allow arbitrary `Cookie` request headers.

NTLM remains represented in the canonical request/auth model so imported workspaces do not lose intent, but no current executor advertises NTLM support. Requests requiring it therefore remain unavailable rather than being approximated.

## Client certificates

Client certificates are currently a Node host capability and are configured only on the server:

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

The renderer receives only certificate IDs and display names. Certificate PEM material, private keys, passphrases, and other server-only execution state are never serialized into the documentation page.

## Cookie jars

The Node executor can provide a signed, documentation-session-scoped cookie jar. `Set-Cookie` values from executed requests are stored in memory and applied only to matching target URLs on later host-executed requests in the same FlexDoc session.

Ordinary host executions do not allocate a cookie session. Cookie jars are bounded in memory and are not a durable login/session store; restarting the API host clears them.

The first native 3.3 adapters do not advertise cookie-jar support and fail closed if the canonical envelope requests it.

## Request protocol

Every implementation reuses the same adapter-owned endpoint:

```text
POST <docsPath>/__flexdoc/execute
X-FlexDoc-Execute: 1
```

JSON requests carry the canonical request draft plus host selections. Multipart requests carry a JSON descriptor plus indexed browser file parts, while binary bodies are transferred as Base64 in the execution envelope.

The execute marker is checked before FlexDoc reads/parses the request body at adapter boundaries that own raw request parsing. The marker is a cross-site invocation guard, **not application authentication**. Protect the documentation and execute route with the same application auth/middleware policy.

Native first-slice implementations use a 32 MiB inbound execution-envelope limit and a 10 MiB returned-response limit. The configured execution timeout is clamped to the canonical safety range, and same-origin redirect following is bounded to five redirects.

The response is normalized back into the same API Client response shape used by browser execution. Post-response scripts/tests, history, Pretty/Raw/Preview views, and collection-run accounting therefore stay shared rather than branching into a second API-client product.

## Origin and private-network policy

`allowedOrigins` is a security boundary, not a convenience wildcard. Configure the smallest exact HTTP(S) origin set required by the documentation and never construct it from untrusted request input.

Private RFC1918/VPC destinations are not blanket-blocked. A private origin can be used when the operator explicitly allowlists that exact origin and the adapter can reach it from the API host's network context. This is one of the core reasons to run FlexDoc inside the backend rather than only in the browser.

Link-local and cloud-metadata destinations remain blocked even if somebody attempts to allowlist them. Implementations reject dangerous literal addresses and dangerous DNS results, including IPv4-mapped IPv6 forms such as `::ffff:169.254.169.254`.

## DNS and connection pinning

A DNS safety preflight is insufficient for a server-side request executor: resolving a hostname once and then letting the HTTP library resolve it again leaves a DNS-rebinding gap.

The hardened native 3.3 executors therefore validate the address set and pin the actual outbound connection to that validated set while retaining the original hostname for HTTP authority and TLS verification:

- JVM: Apache HttpClient uses a request-scoped pinned DNS resolver; the URI retains the original hostname for Host/SNI/certificate verification.
- Python: the socket creation path receives only the validated addresses while the original hostname remains the TLS authority.
- Go: the custom dialer connects directly to validated IPs.
- ASP.NET Core: `ConnectCallback` selects from the validated addresses.
- Rust: reqwest hostname resolution is overridden with the validated socket addresses.
- Ruby: `Net::HTTP#ipaddr=` pins the connection without replacing the request/TLS hostname.
- Elixir: Mint connects to the validated IP tuple while using the original hostname for Host/SNI/TLS verification.
- PHP: the raw socket connects to the validated address while preserving original Host/TLS SNI.

These native transports also avoid implicit/system HTTP proxy routing so proxy configuration cannot silently bypass the address policy. The Node executor applies its own connection-time destination checks under the same security model.

## Redirect policy

Redirects are handled by the executor rather than blindly delegated to the HTTP library.

- only the canonical redirect status codes are followed;
- the target is resolved against the current URL;
- cross-origin redirects are rejected even if the second origin is also allowlisted;
- the next hop is revalidated and re-pinned before connection;
- authentication/query signing that must be reapplied is handled by the executor;
- redirect following is bounded to five hops.

This prevents credentials or signed requests from being forwarded onto a different origin and ensures DNS/address policy is enforced on every connection.

## Header and body safety

Browser-supplied hop-by-hop and transport-owned headers are stripped or rejected. The policy covers `Host`, `Content-Length`, `Connection`, transfer/proxy headers, browser security headers, `Origin`, `Referer`, and other headers that must remain under the outbound transport's control.

The same validation is applied to headers created by authentication configuration, not only to editable draft headers. Header names are normalized before unsafe-header matching, and CR/LF-bearing header values or body-derived content types are rejected before transport serialization.

Multipart file names/content types and other derived MIME metadata are also validated rather than copied blindly onto a raw HTTP request.

## Response and deadline bounds

Host execution is bounded across the entire response, not just until response headers arrive. Native executors stream or incrementally consume the body and abort once the 10 MiB safety limit is exceeded.

Timeout accounting covers the complete outbound operation and redirect chain as far as the platform allows. Synchronous platform DNS APIs cannot always be interrupted mid-resolution; if such a resolver returns after the deadline, the executor does not proceed to a new connection.

Duplicate response headers are retained where the underlying platform exposes them, and invalid/binary response bytes are normalized into the canonical text response shape without adding framework-specific response extensions.

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

The first native 3.3 slices do not expose an equivalent server-side secret/interceptor API. Backend-known secret injection and runtime-derived execution context remain separate product work rather than being approximated through browser-visible configuration.

## Product boundary

The host-execution protocol first appeared as the controlled Node backend path and is reused by the headless CLI and the native 3.3 adapters. The API Client state model remains shared; native adapters add execution leverage from their position inside the service/network environment rather than creating separate Java, Go, Python, Rust, Ruby, Elixir, PHP, or .NET API clients.

The architectural test remains:

> **Could Scalar implement this without being installed inside the backend?**

Host execution clears that bar because the useful capability comes from FlexDoc's position inside the backend and its private network/runtime context, not from reproducing another browser API client.
