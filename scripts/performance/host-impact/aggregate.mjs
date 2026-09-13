#!/usr/bin/env node

import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const inputDir = process.argv[2] || '.';
const markdownPath = process.argv[3] || 'host-impact-summary.md';
const jsonPath = process.argv[4] || 'host-impact-summary.json';
const files = (await readdir(inputDir)).filter((name) => /^host-impact-.+\.json$/.test(name) && name !== path.basename(jsonPath)).sort();
if (!files.length) throw new Error(`No host-impact result JSON files found in ${inputDir}`);

const results = [];
for (const file of files) {
  const parsed = JSON.parse(await readFile(path.join(inputDir, file), 'utf8'));
  if (parsed.schemaVersion !== 2 || !parsed.label || !parsed.deltas) throw new Error(`Unexpected benchmark result shape in ${file}`);
  results.push(parsed);
}

const mib = (kib) => (kib / 1024).toFixed(2);
const ms = (value) => Number(value).toFixed(3);
const rps = (value) => Number(value).toFixed(1);

const lines = [
  '# FlexDoc 3.3 host-execution impact baseline',
  '',
  'Each runtime is measured in three fresh processes: baseline application, FlexDoc mounted with host execution disabled, and FlexDoc mounted with host execution enabled. `/docs` is primed before idle sampling. Direct application traffic and host-executed traffic are then measured separately.',
  '',
  'PSS is the primary memory comparison because it proportionally accounts for shared pages across worker processes. RSS is retained in the raw JSON for operational reference. Values below are deltas within one runtime/job; small cross-runtime differences should not be treated as rankings because GitHub-hosted jobs may run on different physical hosts.',
  '',
  '| Runtime | FlexDoc idle PSS Δ MiB | Host-enabled idle PSS Δ MiB | Host active peak PSS Δ MiB | Post-load retained PSS Δ MiB | Direct p95 Δ ms | Host p95 ms | Host req/s | Host CPU ms/req |',
  '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
];

for (const result of results.sort((a, b) => a.label.localeCompare(b.label))) {
  const d = result.deltas;
  lines.push(`| ${result.label} | ${mib(d.flexdocIdlePssKiB)} | ${mib(d.hostIdlePssKiB)} | ${mib(d.hostActivePeakOverIdlePssKiB)} | ${mib(d.hostRetainedOverIdlePssKiB)} | ${ms(d.hostEnabledDirectP95OverheadMs)} | ${ms(d.hostExecutionP95Ms)} | ${rps(d.hostExecutionThroughputRps)} | ${Number(d.hostExecutionCpuMsPerRequest).toFixed(4)} |`);
}

lines.push('', 'Raw per-runtime JSON includes startup time, docs-prime time, RSS/PSS, high-water RSS, p50/p95/p99/max latency, throughput, and CPU time for both direct and host-executed traffic.', '');

const summary = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  results,
};

await writeFile(markdownPath, `${lines.join('\n')}\n`, 'utf8');
await writeFile(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
console.log(lines.join('\n'));
