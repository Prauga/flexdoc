#!/usr/bin/env node

import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const inputDir = process.argv[2] || '.';
const markdownPath = process.argv[3] || 'host-impact-summary.md';
const jsonPath = process.argv[4] || 'host-impact-summary.json';
const files = (await readdir(inputDir))
  .filter((name) => /^host-impact-.+\.json$/.test(name) && name !== path.basename(jsonPath))
  .sort();

if (!files.length) throw new Error(`No host-impact result JSON files found in ${inputDir}`);

const results = [];
for (const file of files) {
  const parsed = JSON.parse(await readFile(path.join(inputDir, file), 'utf8'));
  if (parsed.schemaVersion !== 3 || !parsed.label || !parsed.deltas) {
    throw new Error(`Unexpected benchmark result shape in ${file}`);
  }
  results.push(parsed);
}

const mib = (kib) => (kib / 1024).toFixed(2);
const ms = (value) => Number(value).toFixed(3);
const rps = (value) => Number(value).toFixed(1);
const cpu = (value) => Number(value).toFixed(4);

const ordered = results.sort((a, b) => a.label.localeCompare(b.label));
const sustainedSeconds = ordered[0]?.workload?.sustainedSeconds ?? 30;

const lines = [
  '# FlexDoc 3.3 host-execution impact baseline',
  '',
  `Each runtime is measured in four fresh processes: baseline application, FlexDoc mounted with host execution disabled, host execution enabled but idle, and host execution enabled/warm/active. The active process is warmed first, then executes ${sustainedSeconds}s at concurrency 1 and ${sustainedSeconds}s at concurrency 12 before a cooldown retention sample.`,
  '',
  'PSS is the primary memory comparison because it proportionally accounts for shared pages across worker processes. RSS remains in the raw JSON. Values are within-runtime deltas; GitHub-hosted jobs must not be interpreted as absolute cross-runtime rankings.',
  '',
  '## Memory impact',
  '',
  '| Runtime | FlexDoc idle PSS Δ MiB | Host-idle PSS Δ MiB | Warm-up retained PSS Δ MiB | c1 active peak PSS Δ MiB | c12 active peak PSS Δ MiB | Cooldown retained PSS Δ MiB |',
  '| --- | ---: | ---: | ---: | ---: | ---: | ---: |',
];

for (const result of ordered) {
  const d = result.deltas;
  lines.push(`| ${result.label} | ${mib(d.flexdocIdlePssKiB)} | ${mib(d.hostIdlePssKiB)} | ${mib(d.hostActiveWarmPssKiB)} | ${mib(d.hostActiveC1PeakOverIdlePssKiB)} | ${mib(d.hostActiveC12PeakOverIdlePssKiB)} | ${mib(d.hostActiveCooldownPssKiB)} |`);
}

lines.push(
  '',
  '## Sustained host-execution performance',
  '',
  '| Runtime | c1 p95 ms | c1 req/s | c1 CPU ms/req | c12 p95 ms | c12 req/s | c12 CPU ms/req |',
  '| --- | ---: | ---: | ---: | ---: | ---: | ---: |',
);

for (const result of ordered) {
  const d = result.deltas;
  lines.push(`| ${result.label} | ${ms(d.sustainedC1P95Ms)} | ${rps(d.sustainedC1ThroughputRps)} | ${cpu(d.sustainedC1CpuMsPerRequest)} | ${ms(d.sustainedC12P95Ms)} | ${rps(d.sustainedC12ThroughputRps)} | ${cpu(d.sustainedC12CpuMsPerRequest)} |`);
}

lines.push(
  '',
  'Raw per-runtime JSON includes startup/docs-prime time, direct-traffic checks, RSS/PSS/high-water RSS, warm-up state, c1/c12 sustained latency distributions, throughput, CPU, active peaks, and 1-second/final cooldown retention.',
  '',
);

const summary = {
  schemaVersion: 2,
  generatedAt: new Date().toISOString(),
  results,
};

await writeFile(markdownPath, `${lines.join('\n')}\n`, 'utf8');
await writeFile(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
console.log(lines.join('\n'));
