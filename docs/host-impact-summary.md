# FlexDoc 3.3 host-impact summary

FlexDoc 3.3 adds native API-host execution across the supported runtime families. Because that execution path runs inside the application service, FlexDoc treats host cost as a product contract rather than an implementation detail.

This document is the release-facing summary of the permanent Host Impact Baseline. The harness and regression policy remain owned by `scripts/performance/host-impact/`; this page gives operators a concise view of what is measured, how to interpret it, and what the 3.3 product-tree baseline looked like.

## What the benchmark measures

Each runtime is measured using matched fresh-process scenarios:

1. baseline application without FlexDoc;
2. FlexDoc mounted with host execution disabled;
3. FlexDoc mounted with host execution enabled but idle;
4. host-enabled application under sustained direct application traffic;
5. host-enabled application under sustained FlexDoc host-execution traffic.

The harness records startup/docs-prime time, RSS/PSS context, high-water memory, concurrency-1 and concurrency-12 latency distributions, throughput, CPU time per request, active memory, cooldown retention, and matched direct-path controls.

The target for host-execution traffic is a separate loopback server owned by the benchmark harness, so the measured application process does not absorb the target handler's work.

## Representative 3.3 product-tree baseline

The following measurements come from the real merged 3.3 product-tree Host Impact baseline at benchmark head `8384aa104eaec3e4815fb346986caadc307c1090`. They are evidence for the 3.3 implementation and regression policy, not service-level objectives or a ranking between languages/runtimes.

| Runtime | FlexDoc idle PSS Δ MiB | Host-idle PSS Δ MiB | Directional cooldown PSS Δ MiB | c12 p95 ms | c12 req/s | c12 CPU ms/req |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| .NET / ASP.NET Core | 4.59 | 1.25 | 14.59 | 7.337 | 2874.2 | 0.4798 |
| Elixir / Plug | -0.20 | -5.48 | -1.43 | 8.060 | 2645.5 | 0.8127 |
| Go / net/http | 2.98 | 0.00 | -0.11 | 7.651 | 2789.7 | 0.3252 |
| Java / Spring Boot | -16.87 | -9.05 | 125.93 | 7.158 | 3008.9 | 0.3066 |
| Node / Express | -2.61 | -2.43 | 2.87 | 8.199 | 2496.9 | 0.4042 |
| PHP / native host | -7.74 | 1.10 | 27.09 | 38.208 | 464.6 | 7.1492 |
| Python / FastAPI | -3.05 | 0.01 | 1.05 | 14.008 | 1207.7 | 1.0157 |
| Ruby / Rack | 2.44 | -0.09 | 0.76 | 45.960 | 287.3 | 1.3953 |
| Rust / Actix | 1.20 | 0.24 | 2.50 | 6.851 | 3008.8 | 0.3029 |
| Rust / Axum | 1.18 | 0.23 | 3.30 | 5.986 | 3813.0 | 0.2627 |

Small or negative PSS deltas are normal process/allocator/GC noise and must not be interpreted as FlexDoc making a process smaller.

## How to read memory numbers

PSS is the primary working-set signal because it proportionally accounts for shared pages across worker processes. The CI memory guardrail uses the matched direct-vs-host attributable cooldown PSS delta rather than raw host-process growth.

That distinction is essential for managed runtimes. JIT compilation, heap commitment, garbage collection, allocator arenas, thread stacks and page residency can differ between two sustained scenarios even when live FlexDoc-owned objects are almost unchanged.

The Java baseline demonstrates the rule. Its one-run directional cooldown value was high, but focused forced-GC/native-memory investigation found only a few MiB of live-heap difference, and the process working-set subtraction could reverse between runs. The 125.93 MiB value therefore remains diagnostic evidence; it is not described as a FlexDoc-retained-memory leak.

Raw RSS/PSS and both sustained scenarios remain available in per-runtime artifacts for investigation. Suspicious managed-runtime changes require repeat runs plus heap/native evidence before they are attributed to FlexDoc.

## Performance decisions made during 3.3

The 3.3 performance investigation produced concrete product decisions rather than simply recording numbers:

- **JVM validated-address connection pooling was accepted.** Reuse remains partitioned by freshly validated DNS pin sets so transport reuse does not weaken destination validation. The accepted implementation materially improved CPU/request and sustained latency/throughput versus the original JVM transport.
- **The JVM scheduler/thread experiment was rejected.** It reduced some hosted-run memory but regressed interactive concurrency-1 CPU, p95 latency and throughput.
- **The .NET small-body allocation fix was accepted.** It reduced host-path allocation/working-set pressure while preserving strict malformed-UTF-8 behavior.
- **The Node response-copy experiment was rejected.** It regressed CPU, latency and throughput.
- **The PHP persistent-socket experiment was rejected.** Its small performance improvement did not justify worse PSS plus additional connection-lifecycle and security complexity.

These choices are part of the Host Impact contract: an optimization is not accepted merely because one metric improves.

## Regression policy

The Host Impact workflow is a **catastrophic-regression guardrail**, not a benchmark leaderboard and not a customer-facing latency SLO.

A threshold should not move just because a pull request fails. Rebaselining requires an intentional reviewed runtime/harness change, at least three complete successful ten-runtime runs, investigation of outliers, representative-run provenance, corroborating run IDs, explicit headroom rationale, and a fresh complete matrix after the threshold change.

If a change improves performance while the existing guardrail still passes, the threshold should normally remain unchanged. Guardrails are safety limits rather than targets that track every improvement.

## Operator takeaway

FlexDoc's normal application hot path remains isolated from documentation work. Host execution adds real work only when a developer explicitly sends a request through the API host. That path is measured continuously across the supported runtime families so future execution, Runtime Intelligence, and Contract Validation changes cannot silently normalize material host regressions.

For benchmark implementation details and rebaseline procedure, see `scripts/performance/host-impact/README.md`. For the broader renderer and production-readiness contract, see `docs/performance.md`.
