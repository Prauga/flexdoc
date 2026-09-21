# Running FlexDoc on more than one instance

FlexDoc is correct on one instance with no configuration. Behind a load balancer it needs three things declared, and if they are missing the failure is quiet: a session cookie one instance cannot verify is indistinguishable from a forged one, so it is correctly discarded, a new session is minted, and the cookie jar is empty. A flow that authenticates and then calls an endpoint needing that cookie passes when consecutive requests land on the same instance and fails when they do not, with nothing in the error pointing at the topology.

This guide is the deployment half of [host-execution operations](./host-execution-operations.md), which covers the configuration surface itself. Start there for what each option means; come here for the topology.

## What multi-instance actually requires

| Concern | Single instance | Fleet |
| --- | --- | --- |
| Session cookie signing | Per-process random secret | One shared `sessionSecret`, at least 32 bytes, from the environment |
| Cookie jars | In-process map | Shared `sessionStore` (Redis, database, whatever the app already runs) |
| Admission bound | `maxInFlight` per process | `fleetMaxInFlight` with `instances`, divided statically |
| Observability | One export is the whole picture | One export per instance, merged with `mergeHostExecutionObservationDocuments` |
| Honest degradation | Not applicable | `instances: 'multiple'`, so a missing piece withdraws the `cookies` capability instead of resetting jars |

The last row is the one that makes the rest safe to get wrong. In `multiple` mode, if the secret or the store is absent, FlexDoc stops advertising `cookies`, names the missing piece at startup, and the renderer shows the honest transport state. A capability the deployment cannot honour is withdrawn rather than offered and quietly broken.

## Application wiring

Configuration comes from the environment so every replica is identical and the secret never lives in an image:

```ts
import express from 'express';
import { createClient } from 'redis';
import {
  createHostExecutionAdmission,
  createHostExecutionAdmissionMiddleware,
  setupExpressFlexDoc,
} from '@prauga/flexdoc-backend';

const app = express();
const redis = createClient({ url: process.env.REDIS_URL });
await redis.connect();

const instances = Number(process.env.FLEXDOC_INSTANCES ?? 1);

// Sized against what the API host tolerates, then divided across replicas.
const admission = createHostExecutionAdmission({ fleetMaxInFlight: 48, instances });

// Keep the privileged execute route behind the application's real boundary:
// authentication -> CSRF/same-origin policy -> admission -> FlexDoc.
app.use('/docs', requireDocumentationUser);
app.use('/docs/__flexdoc/execute', requireSameOriginOrCsrfToken);
app.use(
  '/docs/__flexdoc/execute',
  createHostExecutionAdmissionMiddleware(admission, { retryAfterSeconds: 1 }),
);

setupExpressFlexDoc(app, '/docs', {
  spec,
  options: {
    tryIt: {
      hostExecution: {
        enabled: true,
        allowedOrigins: ['https://api.example.internal'],
        instances: instances > 1 ? 'multiple' : 'single',
        sessionSecret: process.env.FLEXDOC_SESSION_SECRET,
        sessionStore: {
          async read(sessionId) {
            const raw = await redis.get(`flexdoc:jar:${sessionId}`);
            return raw ? JSON.parse(raw) : undefined;
          },
          async write(sessionId, cookies) {
            await redis.set(`flexdoc:jar:${sessionId}`, JSON.stringify(cookies), { EX: 3600 });
          },
          async clear(sessionId) {
            await redis.del(`flexdoc:jar:${sessionId}`);
          },
        },
      },
    },
  },
});
```

Two deliberate choices in that store. It expires jars rather than keeping them forever, because a cookie jar is session state and an unbounded keyspace is a slow leak. And it stores the jar under one key per session rather than one key per session and domain: each record already carries its domain and the jar is capped, so domain keying would add round-trips per request without removing the read-modify-write race it appears to address.\n\nTreat the shared store as a credential store. Use the application's normal encryption-at-rest controls for the backing database/cache, never log serialized jar values, and keep the TTL short enough for the documentation workflow rather than treating these keys as durable login state.

`FLEXDOC_INSTANCES` has to match the real replica count. If it drifts low the fleet admits more than the budget; if it drifts high each instance admits less than its share. Where the orchestrator can tell the application its replica count, read it from there rather than from a second source of truth.

## Docker Compose

Three replicas behind nginx with no affinity, which is the topology that exposes every one of the problems above:

```yaml
services:
  redis:
    image: redis:7-alpine
    command: ["redis-server", "--save", "", "--appendonly", "no"]

  docs:
    build: .
    environment:
      # One secret for every replica. Generate with: openssl rand -base64 48
      FLEXDOC_SESSION_SECRET: ${FLEXDOC_SESSION_SECRET:?set FLEXDOC_SESSION_SECRET}
      FLEXDOC_INSTANCES: "3"
      REDIS_URL: redis://redis:6379
    deploy:
      replicas: 3
    depends_on: [redis]

  lb:
    image: nginx:alpine
    ports: ["8080:80"]
    volumes: ["./nginx.conf:/etc/nginx/nginx.conf:ro"]
    depends_on: [docs]
```

```nginx
events {}
http {
  # Round-robin on purpose: with the secret and store in place, affinity is not
  # needed, and running without it is the only way to prove that.
  upstream docs { server docs:3000; }
  server {
    listen 80;
    location / {
      proxy_pass http://docs;
      proxy_set_header Host $host;
      proxy_set_header X-Forwarded-Proto $scheme;
    }
  }
}
```

`${FLEXDOC_SESSION_SECRET:?...}` fails the deployment when the secret is unset rather than letting each replica fall back to a random one, which would look like a working fleet until a request crossed instances.

## Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-docs
spec:
  replicas: 3
  selector:
    matchLabels: { app: api-docs }
  template:
    metadata:
      labels: { app: api-docs }
    spec:
      containers:
        - name: docs
          image: registry.example.internal/api-docs:latest
          env:
            - name: FLEXDOC_SESSION_SECRET
              valueFrom:
                secretKeyRef: { name: flexdoc-session, key: secret }
            - name: FLEXDOC_INSTANCES
              value: "3"
            - name: REDIS_URL
              value: redis://redis:6379
          readinessProbe:
            httpGet: { path: /docs, port: 3000 }
---
apiVersion: v1
kind: Service
metadata:
  name: api-docs
spec:
  selector: { app: api-docs }
  ports: [{ port: 80, targetPort: 3000 }]
  # No sessionAffinity: the shared secret and store make it unnecessary.
```

```sh
kubectl create secret generic flexdoc-session --from-literal=secret="$(openssl rand -base64 48)"
```

Keep `replicas` and `FLEXDOC_INSTANCES` together. A HorizontalPodAutoscaler changes the first without the second, so either leave this deployment at a fixed replica count or have the application read its replica count from the orchestrator; a scaled fleet with a stale `FLEXDOC_INSTANCES` silently exceeds the admission budget.

## Plain servers behind a load balancer

The same three requirements, without an orchestrator: set `FLEXDOC_SESSION_SECRET` identically in each host's service environment, point every host at one Redis or database, set `FLEXDOC_INSTANCES` to the host count, and leave the balancer on round-robin.

**Session affinity is the interim answer, not the answer.** Sticky sessions fix the symptom today with no code change, but they redistribute users on scale-down and rolling deploys, resetting jars exactly when a deployment is already changing behaviour, and they constrain load balancing to work around a product limitation. Use affinity until the secret and store are in place; do not treat it as the destination.

## Verifying the fleet rather than assuming it

Three checks, in the order that they fail:

1. **Cross-instance sessions.** With the docs open, exercise a cookie-authenticated flow repeatedly through the balancer. Before the shared secret it fails intermittently; after it, it does not. If `cookies` is missing from the advertised capabilities, FlexDoc is telling you the secret or the store is absent — read the startup log rather than guessing.
2. **Admission arithmetic.** `admission.budget` states the per-instance share, the fleet total and any capacity lost to integer division. Multiply the share by the real replica count and compare it against what the API host tolerates.
3. **Fleet observability.** Collect each instance's export and merge them:

```ts
const fleet = mergeHostExecutionObservationDocuments(await collectFromEveryInstance());
```

Counts are exact. `concurrency.peakInFlightUpperBound` is a bound, not a measurement, because per-instance peaks may never have coincided. `durations.percentiles` is null with two or more instances, since a percentile cannot be recovered from other percentiles; use `durations.p95SpreadMs` and the per-instance summaries to find which instance is slow. An empty merge throws rather than reporting a healthy fleet of nothing, which is what a collection failure would otherwise look like.

The merged document still declares `browser-direct-transport-mix`, because browser-direct executions never reach any instance. That gap is the same on one instance as on thirty.
