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
  if (parsed.schemaVersion !== 4 || !parsed.label || !parsed.deltas) {
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
  `Each runtime is measured in five fresh processes: baseline application, FlexDoc mounted with host execution disabled, host execution enabled but idle, host-enabled sustained direct traffic, and sustained FlexDoc host-execution traffic. The two sustained processes receive the same warm-up shape, ${sustainedSeconds}s at concurrency 1 and ${sustainedSeconds}s at concurrency 12, followed by cooldown retention sampling.`,
  '',
  'PSS is the primary memory comparison because it proportionally accounts for shared pages across worker processes. The active-memory control subtracts matched sustained-direct process growth from host-execution process growth so ordinary runtime/JIT/GC/allocator expansion is visible instead of being attributed wholesale to FlexDoc. Raw RSS/PSS and both sustained scenarios remain in the per-runtime JSON.',
  '',
  'The attributable columns are a directional within-run control, not a live-object accounting identity. Direct and host paths run for equal time/concurrency but can complete different request counts, and managed runtimes can make different GC, heap-commit, JIT/code-cache, allocator, thread-stack, and mapped-page decisions. Large managed-runtime deltas therefore require repeat runs and heap/native diagnostics before being described as retained FlexDoc memory.',
  '',
  '## Incremental FlexDoc memory control',
  '',
  '| Runtime | FlexDoc idle PSS Δ MiB | Host-idle PSS Δ MiB | Attributable warm PSS Δ MiB | Attributable c1 peak PSS Δ MiB | Attributable c12 peak PSS Δ MiB | Attributable cooldown PSS Δ MiB |',
  '| --- | ---: | ---: | ---: | ---: | ---: | ---: |',
];

for (const result of ordered) {
  const d = result.deltas;
  lines.push(`| ${result.label} | ${mib(d.flexdocIdlePssKiB)} | ${mib(d.hostIdlePssKiB)} | ${mib(d.hostAttributableWarmPssKiB)} | ${mib(d.hostAttributableC1PeakPssKiB)} | ${mib(d.hostAttributableC12PeakPssKiB)} | ${mib(d.hostAttributableCooldownPssKiB)} |`);
}

lines.push(
  '',
  '## Sustained working-set context',
  '',
  'These values are process growth during equal-duration sustained traffic and are shown to make runtime warm-up, GC/allocator behavior, and heap/page commitment visible rather than attributing all active-process growth to FlexDoc.',
  '',
  '| Runtime | Direct c1 peak PSS Δ MiB | Host c1 peak PSS Δ MiB | Direct c12 peak PSS Δ MiB | Host c12 peak PSS Δ MiB | Direct cooldown PSS Δ MiB | Host cooldown PSS Δ MiB |',
  '| --- | ---: | ---: | ---: | ---: | ---: | ---: |',
);

for (const result of ordered) {
  const d = result.deltas;
  lines.push(`| ${result.label} | ${mib(d.directActiveC1PeakOverIdlePssKiB)} | ${mib(d.hostActiveC1PeakOverIdlePssKiB)} | ${mib(d.directActiveC12PeakOverIdlePssKiB)} | ${mib(d.hostActiveC12PeakOverIdlePssKiB)} | ${mib(d.directActiveCooldownPssKiB)} | ${mib(d.hostActiveCooldownPssKiB)} |`);
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
  '## Sustained direct-path control',
  '',
  '| Runtime | c1 direct p95 ms | c1 direct req/s | c1 direct CPU ms/req | c12 direct p95 ms | c12 direct req/s | c12 direct CPU ms/req |',
  '| --- | ---: | ---: | ---: | ---: | ---: | ---: |',
);

for (const result of ordered) {
  const d = result.deltas;
  lines.push(`| ${result.label} | ${ms(d.directSustainedC1P95Ms)} | ${rps(d.directSustainedC1ThroughputRps)} | ${cpu(d.directSustainedC1CpuMsPerRequest)} | ${ms(d.directSustainedC12P95Ms)} | ${rps(d.directSustainedC12ThroughputRps)} | ${cpu(d.directSustainedC12CpuMsPerRequest)} |`);
}

lines.push(
  '',
  'Small or negative attributable memory deltas can occur from GC/allocator timing and hosted-run variance and must not be interpreted as FlexDoc reducing memory. Likewise, a large positive managed-runtime delta from one run must not be called a live FlexDoc leak without repeatability plus heap/native evidence. These are within-runtime controls; GitHub-hosted jobs are not absolute cross-runtime rankings.',
  '',
  'Raw per-runtime JSON includes startup/docs-prime time, direct-traffic checks, RSS/PSS/high-water RSS, matched sustained-direct and host-execution states, warm-up state, c1/c12 latency distributions, throughput, CPU, active peaks, and 1-second/final cooldown retention.',
  '',
);

const summary = {
  schemaVersion: 3,
  generatedAt: new Date().toISOString(),
  results,
};

await writeFile(markdownPath, `${lines.join('\n')}\n`, 'utf8');
await writeFile(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
console.log(lines.join('\n'));
