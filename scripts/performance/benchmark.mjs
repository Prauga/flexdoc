import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';
import { gzipSync, brotliCompressSync } from 'node:zlib';

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '../..');
const { generateFlexDocHTML } = require(path.join(root, 'packages/backend/dist/template.js'));
const { createCachedFlexDocPage } = require(path.join(root, 'packages/backend/dist/page-cache.js'));

function percentile(values, fraction) {
  const ordered = [...values].sort((a, b) => a - b);
  const index = Math.min(ordered.length - 1, Math.floor((ordered.length - 1) * fraction));
  return ordered[index] || 0;
}

function stats(values) {
  return {
    minMs: Math.min(...values),
    p50Ms: percentile(values, 0.50),
    p95Ms: percentile(values, 0.95),
    p99Ms: percentile(values, 0.99),
    maxMs: Math.max(...values),
  };
}

function buildSpec(targetBytes) {
  const operation = {
    get: {
      summary: 'Benchmark endpoint',
      description: 'Representative endpoint used by the FlexDoc performance harness.',
      parameters: [
        { name: 'id', in: 'query', schema: { type: 'string' } },
        { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
      ],
      responses: {
        200: {
          description: 'OK',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  payload: { type: 'string', example: 'x'.repeat(256) },
                },
              },
            },
          },
        },
      },
    },
  };
  const base = { openapi: '3.1.0', info: { title: 'FlexDoc benchmark', version: '1.0.0' }, paths: {} };
  const sampleBytes = Buffer.byteLength(JSON.stringify({ '/benchmark/0': operation }));
  const baseBytes = Buffer.byteLength(JSON.stringify(base));
  const count = Math.max(1, Math.ceil((targetBytes - baseBytes) / sampleBytes));
  for (let i = 0; i < count; i += 1) base.paths[`/benchmark/${i}`] = operation;
  return base;
}

async function measure(fn, iterations) {
  const timings = [];
  for (let i = 0; i < iterations; i += 1) {
    const start = performance.now();
    await fn();
    timings.push(performance.now() - start);
  }
  return stats(timings);
}

function bundleMetric(file) {
  const body = fs.readFileSync(file);
  return {
    rawBytes: body.length,
    gzipBytes: gzipSync(body).length,
    brotliBytes: brotliCompressSync(body).length,
  };
}

function childSample(script) {
  const started = performance.now();
  const child = spawnSync(process.execPath, ['-e', script], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, NODE_ENV: 'production' },
  });
  const elapsedMs = performance.now() - started;
  if (child.status !== 0) {
    throw new Error(`child benchmark failed: ${child.stderr || child.stdout}`);
  }
  const line = child.stdout.trim().split(/\r?\n/).at(-1);
  return { elapsedMs, payload: JSON.parse(line) };
}

function childProcessSeries(script, iterations = 7) {
  const samples = Array.from({ length: iterations }, () => childSample(script));
  const elapsed = samples.map((sample) => sample.elapsedMs);
  const rss = samples.map((sample) => sample.payload.rssBytes);
  const importTimes = samples
    .map((sample) => sample.payload.importMs)
    .filter((value) => typeof value === 'number');
  const setupTimes = samples
    .map((sample) => sample.payload.setupMs)
    .filter((value) => typeof value === 'number');
  return {
    processElapsed: stats(elapsed),
    rssP50Bytes: percentile(rss, 0.50),
    import: importTimes.length ? stats(importTimes) : undefined,
    setup: setupTimes.length ? stats(setupTimes) : undefined,
  };
}

const targets = [100 * 1024, 1024 * 1024, 5 * 1024 * 1024, 10 * 1024 * 1024];
const cases = [];
for (const targetBytes of targets) {
  const spec = buildSpec(targetBytes);
  const actualSpecBytes = Buffer.byteLength(JSON.stringify(spec));
  const uncachedIterations = targetBytes >= 5 * 1024 * 1024 ? 5 : 12;
  const uncached = await measure(
    () => generateFlexDocHTML(spec, { rendererBasePath: '/docs/__flexdoc', rendererVersion: 'benchmark' }),
    uncachedIterations,
  );
  const getPage = createCachedFlexDocPage(() => generateFlexDocHTML(spec, {
    rendererBasePath: '/docs/__flexdoc',
    rendererVersion: 'benchmark',
  }));
  const first = await measure(() => getPage(), 1);
  const page = await getPage();
  const warm = await measure(() => getPage(), 500);

  const concurrentPage = createCachedFlexDocPage(() => generateFlexDocHTML(spec, {
    rendererBasePath: '/docs/__flexdoc',
    rendererVersion: 'benchmark',
  }));
  const concurrentStarted = performance.now();
  const concurrentResults = await Promise.all(Array.from({ length: 100 }, () => concurrentPage()));
  const concurrentColdMs = performance.now() - concurrentStarted;
  if (!concurrentResults.every((entry) => entry === concurrentResults[0])) {
    throw new Error('concurrent cold page requests did not coalesce to one cached page');
  }

  cases.push({
    targetSpecBytes: targetBytes,
    actualSpecBytes,
    htmlBytes: Buffer.byteLength(page.body),
    uncachedRender: uncached,
    cachedFirstRender: first,
    cachedWarmLookup: warm,
    concurrentCold100TotalMs: concurrentColdMs,
  });
}

const backendEntry = JSON.stringify(path.join(root, 'packages/backend/dist/index.js'));
const setupEntry = JSON.stringify(path.join(root, 'packages/backend/dist/setup.js'));
const baselineProcess = childProcessSeries("console.log(JSON.stringify({rssBytes: process.memoryUsage().rss}))");
const backendProcess = childProcessSeries(`
  const { performance } = require('node:perf_hooks');
  const started = performance.now();
  require(${backendEntry});
  const importMs = performance.now() - started;
  console.log(JSON.stringify({rssBytes: process.memoryUsage().rss, importMs}));
`);
const setupProcess = childProcessSeries(`
  const { performance } = require('node:perf_hooks');
  const importStarted = performance.now();
  const { setupFlexDoc } = require(${setupEntry});
  const importMs = performance.now() - importStarted;
  const app = { use() {} };
  const setupStarted = performance.now();
  setupFlexDoc(app, '/docs', { spec: { openapi: '3.1.0', info: { title: 'Benchmark', version: '1' }, paths: {} } });
  const setupMs = performance.now() - setupStarted;
  console.log(JSON.stringify({rssBytes: process.memoryUsage().rss, importMs, setupMs}));
`);

const standaloneDir = path.join(root, 'packages/client/dist/standalone');
const results = {
  generatedAt: new Date().toISOString(),
  node: process.version,
  platform: `${process.platform}/${process.arch}`,
  benchmarkProcessMemory: process.memoryUsage(),
  processCost: {
    baseline: baselineProcess,
    backendImport: backendProcess,
    backendSetup: setupProcess,
    backendImportRssDeltaP50Bytes: backendProcess.rssP50Bytes - baselineProcess.rssP50Bytes,
    backendSetupRssDeltaP50Bytes: setupProcess.rssP50Bytes - baselineProcess.rssP50Bytes,
  },
  bundles: {
    javascript: bundleMetric(path.join(standaloneDir, 'flexdoc.standalone.js')),
    css: bundleMetric(path.join(standaloneDir, 'flexdoc.standalone.css')),
  },
  hostPageCases: cases,
};

console.log('FlexDoc performance baseline');
console.log(`Node ${results.node} on ${results.platform}`);
console.table(cases.map((entry) => ({
  specMiB: (entry.actualSpecBytes / 1024 / 1024).toFixed(2),
  htmlMiB: (entry.htmlBytes / 1024 / 1024).toFixed(2),
  uncachedP50Ms: entry.uncachedRender.p50Ms.toFixed(2),
  uncachedP95Ms: entry.uncachedRender.p95Ms.toFixed(2),
  uncachedP99Ms: entry.uncachedRender.p99Ms.toFixed(2),
  cachedWarmP99Ms: entry.cachedWarmLookup.p99Ms.toFixed(4),
  coldConcurrent100Ms: entry.concurrentCold100TotalMs.toFixed(2),
})));
console.table(Object.entries(results.bundles).map(([name, metric]) => ({
  asset: name,
  rawKiB: (metric.rawBytes / 1024).toFixed(1),
  gzipKiB: (metric.gzipBytes / 1024).toFixed(1),
  brotliKiB: (metric.brotliBytes / 1024).toFixed(1),
})));
console.table([
  {
    process: 'node baseline',
    elapsedP50Ms: baselineProcess.processElapsed.p50Ms.toFixed(2),
    rssMiB: (baselineProcess.rssP50Bytes / 1024 / 1024).toFixed(2),
    importP50Ms: '-',
    setupP50Ms: '-',
  },
  {
    process: 'FlexDoc backend import',
    elapsedP50Ms: backendProcess.processElapsed.p50Ms.toFixed(2),
    rssMiB: (backendProcess.rssP50Bytes / 1024 / 1024).toFixed(2),
    importP50Ms: backendProcess.import.p50Ms.toFixed(2),
    setupP50Ms: '-',
  },
  {
    process: 'FlexDoc setup',
    elapsedP50Ms: setupProcess.processElapsed.p50Ms.toFixed(2),
    rssMiB: (setupProcess.rssP50Bytes / 1024 / 1024).toFixed(2),
    importP50Ms: setupProcess.import.p50Ms.toFixed(2),
    setupP50Ms: setupProcess.setup.p50Ms.toFixed(4),
  },
]);

const jsonIndex = process.argv.indexOf('--json');
if (jsonIndex >= 0) {
  const output = process.argv[jsonIndex + 1];
  if (!output) throw new Error('--json requires an output path');
  fs.writeFileSync(output, `${JSON.stringify(results, null, 2)}\n`);
  console.log(`Wrote ${output}`);
}
