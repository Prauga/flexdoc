#!/usr/bin/env node

import { readFile } from 'node:fs/promises';

const summaryPath = process.argv[2] || 'host-impact-summary.json';
const policyPath = process.argv[3] || 'scripts/performance/host-impact/regression-thresholds.json';

const summary = JSON.parse(await readFile(summaryPath, 'utf8'));
const policy = JSON.parse(await readFile(policyPath, 'utf8'));

if (summary.schemaVersion !== 3 || !Array.isArray(summary.results)) {
  throw new Error(`Unexpected host-impact summary shape in ${summaryPath}`);
}
if (policy.schemaVersion !== 1 || !policy.runtimes || typeof policy.runtimes !== 'object') {
  throw new Error(`Unexpected host-impact regression policy shape in ${policyPath}`);
}

const checks = [
  ['sustainedC1P95Ms', 'maxC1P95Ms', '<=', 'c1 p95 ms'],
  ['sustainedC12P95Ms', 'maxC12P95Ms', '<=', 'c12 p95 ms'],
  ['sustainedC1ThroughputRps', 'minC1ThroughputRps', '>=', 'c1 req/s'],
  ['sustainedC12ThroughputRps', 'minC12ThroughputRps', '>=', 'c12 req/s'],
  ['sustainedC1CpuMsPerRequest', 'maxC1CpuMsPerRequest', '<=', 'c1 CPU ms/req'],
  ['sustainedC12CpuMsPerRequest', 'maxC12CpuMsPerRequest', '<=', 'c12 CPU ms/req'],
  ['hostAttributableCooldownPssKiB', 'maxHostAttributableCooldownPssKiB', '<=', 'attributable cooldown PSS delta KiB'],
];

const failures = [];
const rows = [];
const seen = new Set();

for (const result of summary.results) {
  const threshold = policy.runtimes[result.label];
  if (!threshold) throw new Error(`No host-impact regression thresholds are defined for ${result.label}`);
  seen.add(result.label);
  const runtimeFailures = [];

  for (const [metricKey, policyKey, operator, label] of checks) {
    const actual = Number(result.deltas?.[metricKey]);
    const limit = Number(threshold[policyKey]);
    if (!Number.isFinite(actual) || !Number.isFinite(limit)) {
      throw new Error(`Invalid ${label} value for ${result.label}: actual=${actual}, limit=${limit}`);
    }
    const ok = operator === '<=' ? actual <= limit : actual >= limit;
    if (!ok) {
      runtimeFailures.push(`${label} ${actual} ${operator === '<=' ? '>' : '<'} ${limit}`);
    }
  }

  rows.push({ label: result.label, failures: runtimeFailures });
  for (const failure of runtimeFailures) failures.push(`${result.label}: ${failure}`);
}

for (const label of Object.keys(policy.runtimes)) {
  if (!seen.has(label)) throw new Error(`Regression policy contains ${label}, but the aggregate benchmark did not produce it`);
}

console.log('Host-impact regression guardrails:');
for (const row of rows.sort((a, b) => a.label.localeCompare(b.label))) {
  console.log(`- ${row.label}: ${row.failures.length ? `FAIL (${row.failures.join('; ')})` : 'pass'}`);
}

if (failures.length) {
  console.error('\nHost-impact regression guardrails failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  console.error('\nThresholds are intentionally coarse. Investigate the regression before changing the policy; do not relax it merely to make CI green.');
  process.exit(1);
}

console.log('\nAll host-impact regression guardrails passed.');
