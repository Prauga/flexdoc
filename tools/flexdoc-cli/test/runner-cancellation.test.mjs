import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { runRunnerCli } from '../src/runner.js';

async function withArtifact(callback) {
  const directory = await mkdtemp(join(tmpdir(), 'flexdoc-runner-cancel-'));
  const path = join(directory, 'cancel.flexdoc.json');
  const artifact = {
    kind: 'flexdoc-runner',
    version: 1,
    exportedAt: '2026-09-08T12:00:00.000Z',
    scope: { type: 'collection', collectionId: 'collection-1' },
    workspace: {
      version: 6,
      collections: [{
        id: 'collection-1',
        name: 'Cancellation',
        auth: { type: 'none' },
        variables: [],
        createdAt: '2026-09-08T00:00:00.000Z',
        updatedAt: '2026-09-08T00:00:00.000Z',
      }],
      folders: [],
      requests: [{
        id: 'request-1',
        collectionId: 'collection-1',
        name: 'Slow request',
        request: { method: 'GET', url: 'https://api.example.test/slow' },
        createdAt: '2026-09-08T00:00:00.000Z',
        updatedAt: '2026-09-08T00:00:00.000Z',
      }],
      environments: [],
      history: [],
    },
  };
  try {
    await writeFile(path, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
    return await callback(path);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test('external abort cancels the active transport and returns the Runner interrupt code', async () => {
  const controller = new AbortController();
  const output = [];
  let transportAborted = false;
  let markTransportStarted;
  const transportStarted = new Promise((resolve) => {
    markTransportStarted = resolve;
  });

  const exitCodePromise = withArtifact((path) => runRunnerCli([path, '--json'], {
    signal: controller.signal,
    disableProcessSignals: true,
    log: (line) => output.push(line),
    fetchImpl: async (_url, init = {}) => new Promise((_resolve, reject) => {
      const signal = init.signal;
      if (!signal) return reject(new Error('Runner did not forward its abort signal to fetch'));
      const rejectAbort = () => {
        transportAborted = true;
        reject(signal.reason instanceof Error ? signal.reason : new Error('aborted'));
      };
      if (signal.aborted) return rejectAbort();
      signal.addEventListener('abort', rejectAbort, { once: true });
      markTransportStarted();
    }),
  }));

  let startupTimeout;
  try {
    await Promise.race([
      transportStarted,
      new Promise((_, reject) => {
        startupTimeout = setTimeout(() => reject(new Error('Runner transport did not start')), 1_000);
      }),
    ]);
  } finally {
    clearTimeout(startupTimeout);
  }
  controller.abort(new Error('CI cancelled'));
  const exitCode = await exitCodePromise;

  assert.equal(exitCode, 130);
  assert.equal(transportAborted, true);
  const report = JSON.parse(output[0]);
  assert.equal(report.status, 'cancelled');
  assert.equal(report.cancelled, 1);
  assert.equal(report.completed, 1);
  assert.equal(report.items[0].cancelled, true);
  assert.equal(report.items[0].executor, 'direct');
});

test('an already-aborted signal reports cancellation without starting transport', async () => {
  const controller = new AbortController();
  const output = [];
  controller.abort(new Error('CI cancelled before start'));

  await withArtifact(async (path) => {
    const exitCode = await runRunnerCli([path, '--json'], {
      signal: controller.signal,
      disableProcessSignals: true,
      log: (line) => output.push(line),
      fetchImpl: async () => {
        throw new Error('transport must not start for an already-aborted run');
      },
    });
    assert.equal(exitCode, 130);
  });

  const report = JSON.parse(output[0]);
  assert.equal(report.status, 'cancelled');
  assert.equal(report.total, 1);
  assert.equal(report.completed, 0);
  assert.equal(report.passed, 0);
  assert.equal(report.failed, 0);
  assert.equal(report.cancelled, 0);
  assert.equal(report.stopped, true);
  assert.deepEqual(report.items, []);
});
