#!/usr/bin/env node

import { execFileSync, spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import { performance } from 'node:perf_hooks';
import process from 'node:process';
import { setTimeout as sleep } from 'node:timers/promises';

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) values[key] = true;
    else { values[key] = value; index += 1; }
  }
  return values;
}

const args = parseArgs(process.argv.slice(2));
const label = String(args.label || process.env.FLEXDOC_BENCH_LABEL || '').trim();
const output = String(args.output || process.env.FLEXDOC_BENCH_OUTPUT || '').trim();
const commandJson = String(args['command-json'] || process.env.FLEXDOC_BENCH_COMMAND || '').trim();
if (!label || !output || !commandJson) {
  throw new Error('Usage: measure-http.mjs --label <name> --command-json <json-array> --output <file>');
}

const command = JSON.parse(commandJson);
if (!Array.isArray(command) || command.length === 0 || command.some((part) => typeof part !== 'string')) {
  throw new Error('Benchmark command must be a non-empty JSON string array.');
}

const requestCount = Math.max(20, Number(args.requests || process.env.FLEXDOC_BENCH_REQUESTS || 120));
const concurrency = Math.max(1, Number(args.concurrency || process.env.FLEXDOC_BENCH_CONCURRENCY || 12));
const settleMs = Math.max(100, Number(args['settle-ms'] || process.env.FLEXDOC_BENCH_SETTLE_MS || 750));
const startupTimeoutMs = Math.max(5000, Number(args['startup-timeout-ms'] || process.env.FLEXDOC_BENCH_STARTUP_TIMEOUT_MS || 60000));
const basePort = Math.max(1024, Number(args.port || process.env.FLEXDOC_BENCH_PORT || 5810));
const clockTicks = Number(execFileSync('getconf', ['CLK_TCK'], { encoding: 'utf8' }).trim()) || 100;

function percentile(values, fraction) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1));
  return sorted[index];
}

function rounded(value, digits = 3) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

async function procChildren(pid) {
  try {
    const text = await readFile(`/proc/${pid}/task/${pid}/children`, 'utf8');
    return text.trim() ? text.trim().split(/\s+/).map(Number).filter(Number.isFinite) : [];
  } catch {
    return [];
  }
}

async function processTreePids(rootPid) {
  const seen = new Set();
  const pending = [rootPid];
  while (pending.length) {
    const pid = pending.pop();
    if (!pid || seen.has(pid)) continue;
    seen.add(pid);
    pending.push(...await procChildren(pid));
  }
  return [...seen];
}

async function processSnapshot(rootPid) {
  const pids = await processTreePids(rootPid);
  let rssKiB = 0;
  let pssKiB = 0;
  let highWaterKiB = 0;
  let cpuTicks = 0;
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

async function sampleIdle(rootPid, samples = 8) {
  const rss = [];
  const pss = [];
  let highWaterKiB = 0;
  for (let index = 0; index < samples; index += 1) {
    const snapshot = await processSnapshot(rootPid);
    rss.push(snapshot.rssKiB);
    pss.push(snapshot.pssKiB);
    highWaterKiB = Math.max(highWaterKiB, snapshot.highWaterKiB);
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

async function fetchChecked(url, init = {}) {
  const started = performance.now();
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(15000) });
  const body = await response.arrayBuffer();
  if (!response.ok) {
    throw new Error(`${init.method || 'GET'} ${url} returned ${response.status}: ${Buffer.from(body).toString('utf8').slice(0, 500)}`);
  }
  return performance.now() - started;
}

async function waitUntilReady(origin, child, stderr) {
  const deadline = performance.now() + startupTimeoutMs;
  while (performance.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Benchmark process exited before readiness (${child.exitCode}).\n${stderr()}`);
    }
    try {
      await fetchChecked(`${origin}/health`);
      return;
    } catch {
      await sleep(75);
    }
  }
  throw new Error(`Benchmark process did not become ready within ${startupTimeoutMs}ms.\n${stderr()}`);
}

async function requestLoad(makeRequest, total, parallelism) {
  const latencies = new Array(total);
  let cursor = 0;
  const started = performance.now();
  async function worker() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= total) return;
      latencies[index] = await makeRequest(index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(parallelism, total) }, worker));
  const elapsedMs = performance.now() - started;
  return {
    count: total,
    concurrency: Math.min(parallelism, total),
    elapsedMs: rounded(elapsedMs),
    throughputRps: rounded((total * 1000) / Math.max(elapsedMs, 0.001)),
    p50Ms: rounded(percentile(latencies, 0.50)),
    p95Ms: rounded(percentile(latencies, 0.95)),
    p99Ms: rounded(percentile(latencies, 0.99)),
    maxMs: rounded(Math.max(...latencies)),
  };
}

async function measureLoad(rootPid, makeRequest) {
  for (let index = 0; index < Math.min(10, requestCount); index += 1) await makeRequest(index);
  const before = await processSnapshot(rootPid);
  let peakRssKiB = before.rssKiB;
  let peakPssKiB = before.pssKiB;
  let peakHighWaterKiB = before.highWaterKiB;
  let sampling = true;
  const sampler = (async () => {
    while (sampling) {
      const snapshot = await processSnapshot(rootPid);
      peakRssKiB = Math.max(peakRssKiB, snapshot.rssKiB);
      peakPssKiB = Math.max(peakPssKiB, snapshot.pssKiB);
      peakHighWaterKiB = Math.max(peakHighWaterKiB, snapshot.highWaterKiB);
      await sleep(20);
    }
  })();
  const result = await requestLoad(makeRequest, requestCount, concurrency);
  sampling = false;
  await sampler;
  const after = await processSnapshot(rootPid);
  return {
    ...result,
    cpuMs: rounded(((after.cpuTicks - before.cpuTicks) * 1000) / clockTicks),
    cpuMsPerRequest: rounded((((after.cpuTicks - before.cpuTicks) * 1000) / clockTicks) / requestCount, 4),
    peakRssKiB,
    peakPssKiB,
    peakHighWaterKiB,
  };
}

function terminate(child) {
  if (child.exitCode !== null) return;
  try { process.kill(-child.pid, 'SIGTERM'); } catch { try { child.kill('SIGTERM'); } catch {} }
}

async function runScenario(mode, port) {
  const origin = `http://127.0.0.1:${port}`;
  let stdoutText = '';
  let stderrText = '';
  const started = performance.now();
  const child = spawn(command[0], command.slice(1), {
    cwd: process.cwd(),
    env: {
      ...process.env,
      FLEXDOC_BENCH_MODE: mode,
      FLEXDOC_BENCH_PORT: String(port),
      FLEXDOC_BENCH_ORIGIN: origin,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });
  child.stdout.on('data', (chunk) => { stdoutText += chunk; });
  child.stderr.on('data', (chunk) => { stderrText += chunk; });
  const logs = () => `${stdoutText}\n${stderrText}`.trim().slice(-8000);
  try {
    await waitUntilReady(origin, child, logs);
    const startupMs = performance.now() - started;
    const docsPrimeMs = mode === 'baseline' ? null : await fetchChecked(`${origin}/docs`);
    await sleep(settleMs);
    const idle = await sampleIdle(child.pid);
    const direct = await measureLoad(child.pid, () => fetchChecked(`${origin}/target`));
    let hostExecution = null;
    if (mode === 'host') {
      const body = JSON.stringify({ request: { method: 'GET', url: `${origin}/target` } });
      hostExecution = await measureLoad(child.pid, () => fetchChecked(`${origin}/docs/__flexdoc/execute`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-flexdoc-execute': '1' },
        body,
      }));
    }
    await sleep(settleMs);
    const retained = await sampleIdle(child.pid);
    return {
      mode,
      startupMs: rounded(startupMs),
      docsPrimeMs: docsPrimeMs == null ? null : rounded(docsPrimeMs),
      idle,
      direct,
      hostExecution,
      retained,
    };
  } catch (error) {
    error.message += `\nFixture output:\n${logs()}`;
    throw error;
  } finally {
    terminate(child);
    await Promise.race([
      new Promise((resolve) => child.once('exit', resolve)),
      sleep(3000).then(() => {
        try { process.kill(-child.pid, 'SIGKILL'); } catch {}
      }),
    ]);
  }
}

const scenarios = {};
for (const [index, mode] of ['baseline', 'flexdoc', 'host'].entries()) {
  process.stdout.write(`Benchmarking ${label} / ${mode}... `);
  scenarios[mode] = await runScenario(mode, basePort + index);
  console.log('done');
}

const result = {
  schemaVersion: 2,
  generatedAt: new Date().toISOString(),
  label,
  system: {
    platform: process.platform,
    arch: process.arch,
    release: os.release(),
    cpuCount: os.cpus().length,
    node: process.version,
  },
  workload: { requestCount, concurrency, settleMs },
  scenarios,
  deltas: {
    flexdocIdleRssKiB: scenarios.flexdoc.idle.rssKiB - scenarios.baseline.idle.rssKiB,
    flexdocIdlePssKiB: scenarios.flexdoc.idle.pssKiB - scenarios.baseline.idle.pssKiB,
    hostIdleRssKiB: scenarios.host.idle.rssKiB - scenarios.flexdoc.idle.rssKiB,
    hostIdlePssKiB: scenarios.host.idle.pssKiB - scenarios.flexdoc.idle.pssKiB,
    hostActivePeakOverIdleRssKiB: scenarios.host.hostExecution.peakRssKiB - scenarios.host.idle.rssKiB,
    hostActivePeakOverIdlePssKiB: scenarios.host.hostExecution.peakPssKiB - scenarios.host.idle.pssKiB,
    hostRetainedOverIdleRssKiB: scenarios.host.retained.rssKiB - scenarios.host.idle.rssKiB,
    hostRetainedOverIdlePssKiB: scenarios.host.retained.pssKiB - scenarios.host.idle.pssKiB,
    flexdocDirectP95OverheadMs: rounded(scenarios.flexdoc.direct.p95Ms - scenarios.baseline.direct.p95Ms),
    hostEnabledDirectP95OverheadMs: rounded(scenarios.host.direct.p95Ms - scenarios.baseline.direct.p95Ms),
    hostExecutionP95Ms: scenarios.host.hostExecution.p95Ms,
    hostExecutionThroughputRps: scenarios.host.hostExecution.throughputRps,
    hostExecutionCpuMsPerRequest: scenarios.host.hostExecution.cpuMsPerRequest,
  },
};

await writeFile(output, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ label, deltas: result.deltas }, null, 2));
