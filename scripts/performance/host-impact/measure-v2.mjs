#!/usr/bin/env node

import { execFileSync, spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import { performance } from 'node:perf_hooks';
import process from 'node:process';
import { setTimeout as sleep } from 'node:timers/promises';

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) out[key] = true;
    else { out[key] = next; i += 1; }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const label = String(args.label || '').trim();
const output = String(args.output || '').trim();
const command = JSON.parse(String(args['command-json'] || '[]'));
if (!label || !output || !Array.isArray(command) || command.length === 0) {
  throw new Error('Usage: measure-v2.mjs --label <name> --command-json <json-array> --output <file>');
}

const requestCount = Math.max(20, Number(args.requests || 120));
const concurrency = Math.max(1, Number(args.concurrency || 12));
const sustainedSeconds = Math.max(10, Number(args['sustained-seconds'] || 30));
const activeWarmupRequests = Math.max(20, Number(args['active-warmup-requests'] || 100));
const settleMs = Math.max(100, Number(args['settle-ms'] || 750));
const cooldownMs = Math.max(1000, Number(args['cooldown-ms'] || 5000));
const startupTimeoutMs = Math.max(5000, Number(args['startup-timeout-ms'] || 60000));
const basePort = Math.max(1024, Number(args.port || 5810));
const targetOrigin = process.env.FLEXDOC_BENCH_TARGET_ORIGIN || 'http://127.0.0.1:5899';
const clockTicks = Number(execFileSync('getconf', ['CLK_TCK'], { encoding: 'utf8' }).trim()) || 100;

function percentile(values, fraction) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1))];
}

function round(value, digits = 3) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

async function children(pid) {
  try {
    const text = await readFile(`/proc/${pid}/task/${pid}/children`, 'utf8');
    return text.trim() ? text.trim().split(/\s+/).map(Number).filter(Number.isFinite) : [];
  } catch { return []; }
}

async function processTree(rootPid) {
  const seen = new Set();
  const pending = [rootPid];
  while (pending.length) {
    const pid = pending.pop();
    if (!pid || seen.has(pid)) continue;
    seen.add(pid);
    pending.push(...await children(pid));
  }
  return [...seen];
}

async function snapshot(rootPid) {
  let rssKiB = 0;
  let pssKiB = 0;
  let highWaterKiB = 0;
  let cpuTicks = 0;
  const pids = await processTree(rootPid);
  for (const pid of pids) {
    try {
      const status = await readFile(`/proc/${pid}/status`, 'utf8');
      rssKiB += Number(/^VmRSS:\s+(\d+)\s+kB$/m.exec(status)?.[1] || 0);
      highWaterKiB += Number(/^VmHWM:\s+(\d+)\s+kB$/m.exec(status)?.[1] || 0);
    } catch {}
    try {
      const smaps = await readFile(`/proc/${pid}/smaps_rollup`, 'utf8');
      pssKiB += Number(/^Pss:\s+(\d+)\s+kB$/m.exec(smaps)?.[1] || 0);
    } catch {}
    try {
      const stat = await readFile(`/proc/${pid}/stat`, 'utf8');
      const tail = stat.slice(stat.lastIndexOf(') ') + 2).trim().split(/\s+/);
      cpuTicks += Number(tail[11] || 0) + Number(tail[12] || 0);
    } catch {}
  }
  return { pids, rssKiB, pssKiB, highWaterKiB, cpuTicks };
}

async function idleSample(rootPid, count = 8) {
  const rss = [];
  const pss = [];
  let highWaterKiB = 0;
  for (let i = 0; i < count; i += 1) {
    const sample = await snapshot(rootPid);
    rss.push(sample.rssKiB);
    pss.push(sample.pssKiB);
    highWaterKiB = Math.max(highWaterKiB, sample.highWaterKiB);
    await sleep(50);
  }
  rss.sort((a, b) => a - b);
  pss.sort((a, b) => a - b);
  return {
    rssKiB: rss[Math.floor(rss.length / 2)] || 0,
    pssKiB: pss[Math.floor(pss.length / 2)] || 0,
    minRssKiB: rss[0] || 0,
    maxRssKiB: rss.at(-1) || 0,
    minPssKiB: pss[0] || 0,
    maxPssKiB: pss.at(-1) || 0,
    highWaterKiB,
  };
}

async function timedFetch(url, init = {}) {
  const started = performance.now();
  let response;
  try {
    response = await fetch(url, { ...init, signal: AbortSignal.timeout(15000) });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`${init.method || 'GET'} ${url} failed: ${detail}`, { cause: error });
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!response.ok) {
    throw new Error(`${init.method || 'GET'} ${url} returned ${response.status}: ${bytes.toString('utf8').slice(0, 500)}`);
  }
  return performance.now() - started;
}

async function waitReady(origin, child, logs) {
  const deadline = performance.now() + startupTimeoutMs;
  while (performance.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Fixture exited before readiness (${child.exitCode}).\n${logs()}`);
    try { await timedFetch(`${origin}/health`); return; }
    catch { await sleep(75); }
  }
  throw new Error(`Fixture did not become ready within ${startupTimeoutMs}ms.\n${logs()}`);
}

function stats(latencies, count, elapsedMs, parallelism) {
  return {
    count,
    concurrency: parallelism,
    elapsedMs: round(elapsedMs),
    throughputRps: round(count * 1000 / Math.max(elapsedMs, 0.001)),
    p50Ms: round(percentile(latencies, 0.50)),
    p95Ms: round(percentile(latencies, 0.95)),
    p99Ms: round(percentile(latencies, 0.99)),
    maxMs: round(latencies.length ? Math.max(...latencies) : 0),
  };
}

async function countLoad(makeRequest, total = requestCount, parallelism = concurrency) {
  const latencies = new Array(total);
  let cursor = 0;
  const started = performance.now();
  async function worker() {
    while (true) {
      const index = cursor++;
      if (index >= total) return;
      latencies[index] = await makeRequest(index);
    }
  }
  const workers = Math.min(parallelism, total);
  await Promise.all(Array.from({ length: workers }, worker));
  return stats(latencies, total, performance.now() - started, workers);
}

async function durationLoad(makeRequest, durationMs, parallelism) {
  const latencies = [];
  let count = 0;
  const started = performance.now();
  const deadline = started + durationMs;
  async function worker() {
    while (performance.now() < deadline) {
      latencies.push(await makeRequest(count));
      count += 1;
    }
  }
  await Promise.all(Array.from({ length: parallelism }, worker));
  return stats(latencies, count, performance.now() - started, parallelism);
}

async function measureLoad(rootPid, runner) {
  const before = await snapshot(rootPid);
  let peakRssKiB = before.rssKiB;
  let peakPssKiB = before.pssKiB;
  let peakHighWaterKiB = before.highWaterKiB;
  let sampling = true;
  const sampler = (async () => {
    while (sampling) {
      const current = await snapshot(rootPid);
      peakRssKiB = Math.max(peakRssKiB, current.rssKiB);
      peakPssKiB = Math.max(peakPssKiB, current.pssKiB);
      peakHighWaterKiB = Math.max(peakHighWaterKiB, current.highWaterKiB);
      await sleep(20);
    }
  })();
  let timings;
  try {
    timings = await runner();
  } finally {
    sampling = false;
    await sampler;
  }
  const after = await snapshot(rootPid);
  const cpuMs = (after.cpuTicks - before.cpuTicks) * 1000 / clockTicks;
  return {
    ...timings,
    cpuMs: round(cpuMs),
    cpuMsPerRequest: round(cpuMs / Math.max(timings.count, 1), 4),
    peakRssKiB,
    peakPssKiB,
    peakHighWaterKiB,
  };
}

async function measuredCountLoad(rootPid, makeRequest, total = requestCount, parallelism = concurrency) {
  for (let i = 0; i < Math.min(10, total); i += 1) await makeRequest(i);
  return measureLoad(rootPid, () => countLoad(makeRequest, total, parallelism));
}

async function measuredDurationLoad(rootPid, makeRequest, durationMs, parallelism) {
  return measureLoad(rootPid, () => durationLoad(makeRequest, durationMs, parallelism));
}

function terminate(child) {
  if (child.exitCode !== null) return;
  try { process.kill(-child.pid, 'SIGTERM'); }
  catch { try { child.kill('SIGTERM'); } catch {} }
}

function hostRequest(appOrigin) {
  const body = JSON.stringify({ request: { method: 'GET', url: `${targetOrigin}/target` } });
  return () => timedFetch(`${appOrigin}/docs/__flexdoc/execute`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-flexdoc-execute': '1' },
    body,
  });
}

async function withFixture(scenario, fixtureMode, port, run) {
  const appOrigin = `http://127.0.0.1:${port}`;
  let stdout = '';
  let stderr = '';
  const started = performance.now();
  const child = spawn(command[0], command.slice(1), {
    cwd: process.cwd(),
    env: {
      ...process.env,
      FLEXDOC_BENCH_MODE: fixtureMode,
      FLEXDOC_BENCH_PORT: String(port),
      FLEXDOC_BENCH_ORIGIN: targetOrigin,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  const logs = () => `${stdout}\n${stderr}`.trim().slice(-10000);

  try {
    await waitReady(appOrigin, child, logs);
    const startupMs = performance.now() - started;
    const docsPrimeMs = fixtureMode === 'baseline' ? null : await timedFetch(`${appOrigin}/docs`);
    await sleep(settleMs);
    return await run({ scenario, appOrigin, child, startupMs, docsPrimeMs });
  } catch (error) {
    const detail = error instanceof Error ? error.stack || error.message : String(error);
    throw new Error(`${detail}\nFixture output:\n${logs()}`, { cause: error });
  } finally {
    terminate(child);
    await Promise.race([
      new Promise((resolve) => child.once('exit', resolve)),
      sleep(3000).then(() => { try { process.kill(-child.pid, 'SIGKILL'); } catch {} }),
    ]);
  }
}

async function runPassiveScenario(scenario, fixtureMode, port) {
  return withFixture(scenario, fixtureMode, port, async ({ appOrigin, child, startupMs, docsPrimeMs }) => {
    const idle = await idleSample(child.pid);
    const direct = await measuredCountLoad(child.pid, () => timedFetch(`${appOrigin}/target`));
    await sleep(settleMs);
    const retained = await idleSample(child.pid);
    return {
      scenario,
      fixtureMode,
      startupMs: round(startupMs),
      docsPrimeMs: docsPrimeMs == null ? null : round(docsPrimeMs),
      idle,
      direct,
      retained,
    };
  });
}

async function runActiveScenario(port) {
  return withFixture('hostActive', 'host', port, async ({ appOrigin, child, startupMs, docsPrimeMs }) => {
    const preActiveIdle = await idleSample(child.pid);
    const execute = hostRequest(appOrigin);

    await countLoad(execute, activeWarmupRequests, Math.min(12, concurrency));
    await sleep(settleMs);
    const warmedIdle = await idleSample(child.pid);

    const sustainedConcurrency1 = await measuredDurationLoad(child.pid, execute, sustainedSeconds * 1000, 1);
    await sleep(settleMs);
    const afterConcurrency1 = await idleSample(child.pid);

    const sustainedConcurrency12 = await measuredDurationLoad(child.pid, execute, sustainedSeconds * 1000, 12);
    const activeComplete = await snapshot(child.pid);

    await sleep(1000);
    const cooldown1s = await idleSample(child.pid);
    if (cooldownMs > 1000) await sleep(cooldownMs - 1000);
    const cooldownFinal = await idleSample(child.pid);

    return {
      scenario: 'hostActive',
      fixtureMode: 'host',
      startupMs: round(startupMs),
      docsPrimeMs: round(docsPrimeMs),
      preActiveIdle,
      warmup: { requests: activeWarmupRequests, concurrency: Math.min(12, concurrency) },
      warmedIdle,
      sustainedConcurrency1,
      afterConcurrency1,
      sustainedConcurrency12,
      activeComplete,
      cooldown1s,
      cooldownFinal,
      cooldownMs,
    };
  });
}

const scenarios = {};
const definitions = [
  ['baseline', 'baseline'],
  ['flexdoc', 'flexdoc'],
  ['hostIdle', 'host'],
];
for (const [index, [scenario, fixtureMode]] of definitions.entries()) {
  process.stdout.write(`Benchmarking ${label} / ${scenario}... `);
  scenarios[scenario] = await runPassiveScenario(scenario, fixtureMode, basePort + index);
  console.log('done');
}

process.stdout.write(`Benchmarking ${label} / hostActive (${sustainedSeconds}s @ c1 + ${sustainedSeconds}s @ c12)... `);
scenarios.hostActive = await runActiveScenario(basePort + definitions.length);
console.log('done');

const baseline = scenarios.baseline;
const flexdoc = scenarios.flexdoc;
const hostIdle = scenarios.hostIdle;
const hostActive = scenarios.hostActive;

const result = {
  schemaVersion: 3,
  generatedAt: new Date().toISOString(),
  label,
  targetOrigin,
  system: {
    platform: process.platform,
    arch: process.arch,
    release: os.release(),
    cpuCount: os.cpus().length,
    node: process.version,
  },
  workload: {
    requestCount,
    concurrency,
    settleMs,
    activeWarmupRequests,
    sustainedSeconds,
    sustainedConcurrencies: [1, 12],
    cooldownMs,
  },
  scenarios,
  deltas: {
    flexdocIdleRssKiB: flexdoc.idle.rssKiB - baseline.idle.rssKiB,
    flexdocIdlePssKiB: flexdoc.idle.pssKiB - baseline.idle.pssKiB,
    hostIdleRssKiB: hostIdle.idle.rssKiB - flexdoc.idle.rssKiB,
    hostIdlePssKiB: hostIdle.idle.pssKiB - flexdoc.idle.pssKiB,
    hostActiveWarmRssKiB: hostActive.warmedIdle.rssKiB - hostActive.preActiveIdle.rssKiB,
    hostActiveWarmPssKiB: hostActive.warmedIdle.pssKiB - hostActive.preActiveIdle.pssKiB,
    hostActiveC1PeakOverIdleRssKiB: hostActive.sustainedConcurrency1.peakRssKiB - hostActive.preActiveIdle.rssKiB,
    hostActiveC1PeakOverIdlePssKiB: hostActive.sustainedConcurrency1.peakPssKiB - hostActive.preActiveIdle.pssKiB,
    hostActiveC12PeakOverIdleRssKiB: hostActive.sustainedConcurrency12.peakRssKiB - hostActive.preActiveIdle.rssKiB,
    hostActiveC12PeakOverIdlePssKiB: hostActive.sustainedConcurrency12.peakPssKiB - hostActive.preActiveIdle.pssKiB,
    hostActiveCooldownRssKiB: hostActive.cooldownFinal.rssKiB - hostActive.preActiveIdle.rssKiB,
    hostActiveCooldownPssKiB: hostActive.cooldownFinal.pssKiB - hostActive.preActiveIdle.pssKiB,
    flexdocDirectP95OverheadMs: round(flexdoc.direct.p95Ms - baseline.direct.p95Ms),
    hostEnabledDirectP95OverheadMs: round(hostIdle.direct.p95Ms - baseline.direct.p95Ms),
    sustainedC1P95Ms: hostActive.sustainedConcurrency1.p95Ms,
    sustainedC1ThroughputRps: hostActive.sustainedConcurrency1.throughputRps,
    sustainedC1CpuMsPerRequest: hostActive.sustainedConcurrency1.cpuMsPerRequest,
    sustainedC12P95Ms: hostActive.sustainedConcurrency12.p95Ms,
    sustainedC12ThroughputRps: hostActive.sustainedConcurrency12.throughputRps,
    sustainedC12CpuMsPerRequest: hostActive.sustainedConcurrency12.cpuMsPerRequest,
  },
};

await writeFile(output, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ label, deltas: result.deltas }, null, 2));
