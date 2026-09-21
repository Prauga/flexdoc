# Express multi-instance fleet

Runnable proof that FlexDoc host-execution session jars, admission budgeting and observation merge work behind a load balancer with **no session affinity**.

Three Express replicas share one `FLEXDOC_SESSION_SECRET` and a Redis cookie-jar store, sit behind nginx round-robin on `:8080`, and export per-instance observation documents that `mergeHostExecutionObservationDocuments` combines.

Pinned to `@prauga/flexdoc-backend` `3.4.0`.

## What this demonstrates

| Concern | How this example handles it |
| --- | --- |
| Shared session signing | One `FLEXDOC_SESSION_SECRET` (≥ 32 bytes) injected into every replica |
| Shared cookie jars | Redis `sessionStore` with a one-hour TTL |
| Honest degradation | `instances: 'multiple'` — without both pieces FlexDoc would withhold `cookies` |
| Fleet admission | `fleetMaxInFlight: 48` ÷ `FLEXDOC_INSTANCES: 3` → 16 slots each |
| Security ordering | docs auth → same-origin/CSRF → admission middleware → FlexDoc |
| Fleet observability | `GET /__fleet/observation` per replica + `npm run merge-observations` |

See [`docs/multi-instance-deployment.md`](../../docs/multi-instance-deployment.md) for the operator guide this example implements.

## Run with Docker Compose

```bash
export FLEXDOC_SESSION_SECRET="$(openssl rand -base64 48)"
docker compose up --build
```

Then:

1. Open `http://localhost:8080/example-login` (sets the docs-surface cookie).
2. Open `http://localhost:8080/docs`.
3. In Try It / API Client, prefer host execution and call **POST `/account/login`**, then **GET `/account/me`**, several times.
4. Confirm `/account/me` keeps succeeding even though nginx is round-robin — the jar lives in Redis, not in the replica that handled login.
5. Hit `http://localhost:8080/whoami` a few times; `instanceId` should rotate across `docs-1` / `docs-2` / `docs-3`.

Per-replica ports for operator checks:

| Replica | Direct URL |
| --- | --- |
| docs-1 | `http://localhost:3001` |
| docs-2 | `http://localhost:3002` |
| docs-3 | `http://localhost:3003` |

```bash
# Admission arithmetic — every replica should report the same partitioned budget
curl -s http://localhost:3001/__fleet/budget | jq

# After a few host-executed requests, merge the three observation exports
npm run merge-observations
```

The merged document has exact additive counts, `concurrency.peakInFlightUpperBound` (a bound, not a measurement), and `durations.percentiles: null` with three instances — percentiles cannot be recovered from other percentiles.

## Run one replica locally

Useful when iterating on the Express wiring without Compose:

```bash
export FLEXDOC_SESSION_SECRET="$(openssl rand -base64 48)"
export FLEXDOC_INSTANCES=1
export PUBLIC_ORIGIN=http://localhost:3000
export REDIS_URL=redis://127.0.0.1:6379
export INSTANCE_ID=local
npm install
npm start
```

Requires a local Redis. With `FLEXDOC_INSTANCES=1` the example still uses the shared secret and store; set `FLEXDOC_INSTANCES=3` only when three processes are actually running.

## Intentionally not in this example

- Session affinity — the point is that it is unnecessary once the secret and store are in place.
- A HorizontalPodAutoscaler — `FLEXDOC_INSTANCES` must stay equal to the real replica count; see the deployment guide.
- Encryption-at-rest for Redis — use your platform's normal controls; never log serialized jar values.
