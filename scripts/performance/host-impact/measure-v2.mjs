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
const settleMs = Math.max(100, Number(args['settle-ms'] || 750));
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

async function load(makeRequest) {
  const latencies = new Array(requestCount);
  let cursor = 0;
  const started = performance.now();
  async function worker() {
    while (true) {
      const index = cursor++;
      if (index >= requestCount) return;
      latencies[index] = await makeRequest(index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, requestCount) }, worker));
  const elapsedMs = performance.now() - started;
  return {
    count: requestCount,
    concurrency: Math.min(concurrency, requestCount),
    elapsedMs: round(elapsedMs),
    throughputRps: round(requestCount * 1000 / Math.max(elapsedMs, 0.001)),
    p50Ms: round(percentile(latencies, 0.50)),
    p95Ms: round(percentile(latencies, 0.95)),
    p99Ms: round(percentile(latencies, 0.99)),
    maxMs: round(Math.max(...latencies)),
  };
}

async function measuredLoad(rootPid, makeRequest) {
  for (let i = 0; i < Math.min(10, requestCount); i += 1) await makeRequest(i);
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
  const timings = await load(makeRequest);
  sampling = false;
  await sampler;
  const after = await snapshot(rootPid);
  const cpuMs = (after.cpuTicks - before.cpuTicks) * 1000 / clockTicks;
  return {
    ...timings,
    cpuMs: round(cpuMs),
    cpuMsPerRequest: round(cpuMs / requestCount, 4),
    peakRssKiB,
    peakPssKiB,
    peakHighWaterKiB,
  };
}

function terminate(child) {
  if (child.exitCode !== null) return;
  try { process.kill(-child.pid, 'SIGTERM'); }
  catch { try { child.kill('SIGTERM'); } catch {} }
}

async function runScenario(mode, port) {
  const appOrigin = `http://127.0.0.1:${port}`;
  let stdout = '';
  let stderr = '';
  const started = performance.now();
  const child = spawn(command[0], command.slice(1), {
    cwd: process.cwd(),
    env: {
      ...process.env,
      FLEXDOC_BENCH_MODE: mode,
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
    const docsPrimeMs = mode === 'baseline' ? null : await timedFetch(`${appOrigin}/docs`);
    await sleep(settleMs);
    const idle = await idleSample(child.pid);
    const direct = await measuredLoad(child.pid, () => timedFetch(`${appOrigin}/target`));
    let hostExecution = null;
    if (mode === 'host') {
      const body = JSON.stringify({ request: { method: 'GET', url: `${targetOrigin}/target` } });
      hostExecution = await measuredLoad(child.pid, () => timedFetch(`${appOrigin}/docs/__flexdoc/execute`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-flexdoc-execute': '1' },
        body,
      }));
    }
    await sleep(settleMs);
    const retained = await idleSample(child.pid);
    return { mode, startupMs: round(startupMs), docsPrimeMs: docsPrimeMs == null ? null : round(docsPrimeMs), idle, direct, hostExecution, retained };
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

const scenarios = {};
for (const [index, mode] of ['baseline', 'flexdoc', 'host'].entries()) {
  process.stdout.write(`Benchmarking ${label} / ${mode}... `);
  scenarios[mode] = await runScenario(mode, basePort + index);
  console.log('done');
}

const h = scenarios.host;
const result = {
  schemaVersion: 2,
  generatedAt: new Date().toISOString(),
  label,
  targetOrigin,
  system: { platform: process.platform, arch: process.arch, release: os.release(), cpuCount: os.cpus().length, node: process.version },
  workload: { requestCount, concurrency, settleMs },
  scenarios,
  deltas: {
    flexdocIdleRssKiB: scenarios.flexdoc.idle.rssKiB - scenarios.baseline.idle.rssKiB,
    flexdocIdlePssKiB: scenarios.flexdoc.idle.pssKiB - scenarios.baseline.idle.pssKiB,
    hostIdleRssKiB: h.idle.rssKiB - scenarios.flexdoc.idle.rssKiB,
    hostIdlePssKiB: h.idle.pssKiB - scenarios.flexdoc.idle.pssKiB,
    hostActivePeakOverIdleRssKiB: h.hostExecution.peakRssKiB - h.idle.rssKiB,
    hostActivePeakOverIdlePssKiB: h.hostExecution.peakPssKiB - h.idle.pssKiB,
    hostRetainedOverIdleRssKiB: h.retained.rssKiB - h.idle.rssKiB,
    hostRetainedOverIdlePssKiB: h.retained.pssKiB - h.idle.pssKiB,
    flexdocDirectP95OverheadMs: round(scenarios.flexdoc.direct.p95Ms - scenarios.baseline.direct.p95Ms),
    hostEnabledDirectP95OverheadMs: round(h.direct.p95Ms - scenarios.baseline.direct.p95Ms),
    hostExecutionP95Ms: h.hostExecution.p95Ms,
    hostExecutionThroughputRps: h.hostExecution.throughputRps,
    hostExecutionCpuMsPerRequest: h.hostExecution.cpuMsPerRequest,
  },
};

await writeFile(output, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ label, deltas: result.deltas }, null, 2));
