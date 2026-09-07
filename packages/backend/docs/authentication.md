# Protecting FlexDoc documentation

`@prauga/flexdoc-backend` can protect the complete documentation subtree with deterministic Basic credentials or signed bearer tokens. The boundary includes the HTML shell, renderer assets, Runtime Intelligence, and API-host execution endpoints.

This is documentation-route authentication. It is separate from credentials entered into Try It or the API Client for calls to the documented API.

## Configure authentication

```ts
import { setupExpressFlexDoc } from '@prauga/flexdoc-backend';

setupExpressFlexDoc(app, '/docs', {
  spec,
  options: {
    auth: {
      type: 'basic', // or 'bearer'
      secretKey: process.env.FLEXDOC_SECRET!,
    },
  },
});
```

The same `options.auth` object is accepted by the Fastify, NestJS, and Hono integrations.

For module-based NestJS registration:

```ts
import { FlexDocModule } from '@prauga/flexdoc-backend';

FlexDocModule.forRoot({
  path: '/docs',
  spec,
  options: {
    auth: {
      type: 'bearer',
      secretKey: process.env.FLEXDOC_SECRET!,
    },
  },
});
```

`secretKey` remains on the server and is removed before renderer options are serialized.

## Generate credentials

The backend package installs `flexdoc-auth-generator`.

Basic password:

```bash
npx --package @prauga/flexdoc-backend flexdoc-auth-generator basic \
  --username john.doe \
  --secret "$FLEXDOC_SECRET"
```

Bearer token, valid for 30 days:

```bash
npx --package @prauga/flexdoc-backend flexdoc-auth-generator bearer \
  --expiry 30 \
  --secret "$FLEXDOC_SECRET"
```

Basic authentication derives the expected password deterministically from the username and secret; no user database is created. Bearer authentication verifies the JWT signature and expiry against the secret.

## Operational requirements

- Store the secret in a secret manager or environment variable, never in source.
- Use a long random secret and HTTPS.
- Choose short bearer-token lifetimes appropriate for the documentation exposure.
- Rotating the secret invalidates existing Basic passwords and bearer tokens.
- Apply upstream authorization instead when per-user identity, roles, revocation, SSO, or audit trails are required.

Runtime Intelligence can reveal endpoints intentionally omitted from OpenAPI. Keep it disabled unless needed, and never expose it outside the intended documentation audience.
