import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { runRunnerCli } from '../src/runner.js';

const timestamp = '2026-09-08T00:00:00.000Z';

function collection() {
  return {
    id: 'collection-1',
    name: 'Scoped CI',
    auth: { type: 'none' },
    variables: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

async function withRunnerFiles(artifact, callback) {
  const directory = await mkdtemp(join(tmpdir(), 'flexdoc-runner-scope-'));
  const artifactPath = join(directory, 'scope.flexdoc.json');
  const reportPath = join(directory, 'report.json');
  try {
    await writeFile(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
    return await callback({ artifactPath, reportPath });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test('request scope executes exactly one request with inherited folder auth and writes the stable report', async () => {
  const artifact = {
    kind: 'flexdoc-runner',
    version: 1,
    exportedAt: '2026-09-08T12:00:00.000Z',
    scope: { type: 'request', collectionId: 'collection-1', requestId: 'request-1' },
    workspace: {
      version: 6,
      collections: [collection()],
      folders: [{
        id: 'folder-1',
        collectionId: 'collection-1',
        name: 'Protected',
        auth: { type: 'bearer', token: 'folder-token' },
        createdAt: timestamp,
        updatedAt: timestamp,
      }],
      requests: [{
        id: 'request-1',
        collectionId: 'collection-1',
        folderId: 'folder-1',
        name: 'One request',
        request: { method: 'GET', url: 'https://api.example.test/one', auth: { type: 'inherit' } },
        createdAt: timestamp,
        updatedAt: timestamp,
      }],
      environments: [],
      history: [],
    },
  };

  await withRunnerFiles(artifact, async ({ artifactPath, reportPath }) => {
    const output = [];
    const calls = [];
    const exitCode = await runRunnerCli([artifactPath, '--json', '--report', reportPath], {
      fetchImpl: async (input, init = {}) => {
        calls.push(String(input));
        assert.equal(new Headers(init.headers || {}).get('Authorization'), 'Bearer folder-token');
        return new Response('{"ok":true}', { status: 200 });
      },
      log: (line) => output.push(line),
      disableProcessSignals: true,
    });

    assert.equal(exitCode, 0);
    assert.deepEqual(calls, ['https://api.example.test/one']);
    const stdoutReport = JSON.parse(output[0]);
    const fileReport = JSON.parse(await readFile(reportPath, 'utf8'));
    assert.deepEqual(fileReport, stdoutReport);
    assert.equal(fileReport.artifact.scope.type, 'request');
    assert.equal(fileReport.items.length, 1);
    assert.equal(fileReport.items[0].requestId, 'request-1');
    assert.equal(fileReport.items[0].itemId, `${fileReport.runId}:1`);
    assert.equal(fileReport.items[0].executor, 'direct');
  });
});

test('folder scope executes the declared subtree in saved-request order', async () => {
  const artifact = {
    kind: 'flexdoc-runner',
    version: 1,
    exportedAt: '2026-09-08T12:00:00.000Z',
    scope: { type: 'folder', collectionId: 'collection-1', folderId: 'root' },
    workspace: {
      version: 6,
      collections: [collection()],
      folders: [
        { id: 'root', collectionId: 'collection-1', name: 'Root', auth: { type: 'inherit' }, createdAt: timestamp, updatedAt: timestamp },
        { id: 'child', collectionId: 'collection-1', parentFolderId: 'root', name: 'Child', auth: { type: 'inherit' }, createdAt: timestamp, updatedAt: timestamp },
      ],
      requests: [
        { id: 'request-root', collectionId: 'collection-1', folderId: 'root', name: 'Root request', request: { method: 'GET', url: 'https://api.example.test/root' }, createdAt: timestamp, updatedAt: timestamp },
        { id: 'request-child', collectionId: 'collection-1', folderId: 'child', name: 'Child request', request: { method: 'GET', url: 'https://api.example.test/child' }, createdAt: timestamp, updatedAt: timestamp },
      ],
      environments: [],
      history: [],
    },
  };

  await withRunnerFiles(artifact, async ({ artifactPath }) => {
    const calls = [];
    const exitCode = await runRunnerCli([artifactPath], {
      fetchImpl: async (input) => {
        calls.push(String(input));
        return new Response('ok', { status: 200 });
      },
      log: () => {},
      disableProcessSignals: true,
    });
    assert.equal(exitCode, 0);
    assert.deepEqual(calls, ['https://api.example.test/root', 'https://api.example.test/child']);
  });
});
