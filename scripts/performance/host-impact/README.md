# Host-impact baseline and regression guardrails

The host-impact harness measures FlexDoc host execution across the supported runtime families using matched fresh-process controls. It records memory context, sustained direct-path behavior, sustained host-execution behavior, latency, throughput, CPU, and cooldown retention.

`regression-thresholds.json` is a **catastrophic regression guardrail**, not a service-level objective or a cross-runtime performance ranking. The thresholds are deliberately broad enough to tolerate normal GitHub-hosted runner variance while still failing changes that materially break host execution. `../performance-policy.json` is the machine-readable governance contract; `check-regressions.mjs` validates both the threshold provenance and the minimum rebaseline evidence requirements before applying the numeric limits.

The CI memory guardrail uses the **matched direct-vs-host attributable cooldown PSS delta** (`hostAttributableCooldownPssKiB`). It intentionally does not gate on raw host-process cooldown growth. Managed runtimes can commit heap/pages, JIT code, allocator arenas, thread stacks, and other process memory under either sustained path, so raw host growth without the matched direct control is not a reliable FlexDoc-specific regression signal. Raw host/direct working-set growth remains in the summary and per-runtime JSON for diagnosis.

## Rebaselining thresholds

Do not edit thresholds simply because a pull request fails the guardrail. Rebaseline only when an intentional, reviewed runtime or harness change makes the previous baseline obsolete.

1. Run the complete ten-runtime Host Impact workflow on the intended release-candidate tree. Do not use a partial matrix or a locally modified harness.
2. Repeat the complete workflow enough times to distinguish a stable shift from hosted-runner variance. For a threshold change, use at least three successful complete runs and compare the same runtime/scenario fields across them. This minimum is also encoded in `performance-policy.json`.
3. Investigate outliers before changing a limit. For managed runtimes, directional PSS is diagnostic context rather than live-object accounting; use repeatability and heap/native evidence before attributing retained memory to FlexDoc.
4. Set a new threshold from the observed stable behavior plus explicit guardrail headroom. Do not turn a currently passing observation into a tighter or looser number without stating why that metric is suitable as a catastrophic-regression signal.
5. Update `regression-thresholds.json` provenance so `representativeRunId` points to the representative complete run used for the new baseline. Record the other corroborating run IDs in the pull-request description or commit body.
6. In the threshold-change review, state the intentional product/harness change, old threshold, new threshold, representative measurement, why the new headroom is appropriate, and explicitly accept the performance/security trade-off being made.
7. Never weaken unrelated runtimes or metrics as part of the same rebaseline. A performance improvement is not permission to widen another guardrail.
8. Require the updated threshold file to pass a fresh complete Host Impact workflow before merge. Changes to `performance-policy.json` also trigger that workflow.

If a change improves performance but the existing threshold still passes, **leave the threshold alone** unless there is a concrete maintenance reason to rebaseline it. Guardrails are safety limits, not targets that must track every improvement.

## Reading the summary

The generated Markdown intentionally reports direct-path controls next to host-execution results. Compare within the same runtime/run first. Cross-run and cross-runtime absolute numbers on shared CI infrastructure are contextual, not deterministic benchmarks.

The aggregate summary and `check-regressions.mjs` must continue to label these limits as catastrophic-regression-only. Product SLOs, capacity plans, and customer-facing latency commitments belong in separately controlled performance specifications, not this CI guardrail file.
