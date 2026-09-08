import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fetchHostExecutionAdvertisement, runRunnerCli } from '../src/runner.js';

function artifact(requests, overrides = {}) {
  return {
    kind: 'flexdoc-runner',
    version: 1,
    exportedAt: '2026-09-08T12:00:00.000Z',
    scope: { type: 'collection', collectionId: 'collection-1' },
    workspace: {
      version: 6,
      collections: [{
        id: 'collection-1',
        name: 'CI collection',
        auth: { type: 'none' },
        variables: [{ id: 'collection-var', key: 'petId', value: '1' }],
        createdAt: '2026-09-08T00:00:00.000Z',
        updatedAt: '2026-09-08T00:00:00.000Z',
      }],
      folders: [],
      requests: requests.map((request, index) => ({
        id: `request-${index + 1}`,
        collectionId: 'collection-1',
        name: request.name || `Request ${index + 1}`,
        request: request.request,
        ...(request.scripts ? { scripts: request.scripts } : {}),
        createdAt: '2026-09-08T00:00:00.000Z',
        updatedAt: '2026-09-08T00:00:00.000Z',
      })),
      environments: [{
        id: 'environment-1',
        name: 'CI',
        variables: [{ id: 'base-url', key: 'baseUrl', value: 'https://api.example.test' }],
        createdAt: '2026-09-08T00:00:00.000Z',
        updatedAt: '2026-09-08T00:00:00.000Z',
      }],
      activeEnvironmentId: 'environment-1',
      history: [],
      ...overrides,
    },
  };
}

async function withArtifact(value, callback) {
  const directory = await mkdtemp(join(tmpdir(), 'flexdoc-runner-test-'));
  const path = join(directory, 'run.flexdoc.json');
  try {
    await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    return await callback(path);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function docsHtml(endpoint = '/docs/__flexdoc/execute') {
  return `<script>\n    window.__FLEXDOC_OPTIONS__ = ${JSON.stringify({ tryIt: { hostExecution: { available: true, endpoint, capabilities: ['digest'] } } })};\n  </script>`;
}

function compactDocsHtml({ available = false, endpoint = '/docs/__flexdoc/execute' } = {}) {
  return `<script>window.__FLEXDOC_OPTIONS__=${JSON.stringify({ tryIt: { hostExecution: { available, endpoint, capabilities: available ? ['digest'] : [] } } })};</script>`;
}

test('runs a portable artifact directly with workspace variables and the same flex.* scripts/tests', async () => {
  const calls = [];
  const output = [];
  const value = artifact([{
    name: 'Get pet',
    request: { method: 'GET', url: '{{baseUrl}}/pets/{{petId}}' },
    scripts: {
      preRequest: "flex.variables.set('petId', '42');",
      tests: "flex.test('status is 200', () => flex.expect(flex.response.code).to.equal(200));",
    },
  }]);

  await withArtifact(value, async (path) => {
    const exitCode = await runRunnerCli([path, '--json'], {
      fetchImpl: async (url, init) => {
        calls.push({ url: String(url), init });
        return new Response('{"id":42}', { status: 200, headers: { 'content-type': 'application/json' } });
      },
      log: (line) => output.push(line),
      disableProcessSignals: true,
    });
    assert.equal(exitCode, 0);
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.example.test/pets/42');
  const report = JSON.parse(output[0]);
  assert.equal(report.kind, 'flexdoc-run-report');
  assert.equal(report.status, 'pass');
  assert.equal(report.items[0].executor, 'direct');
  assert.equal(report.items[0].status, 200);
  assert.deepEqual(report.items[0].tests, [{ name: 'status is 200', passed: true }]);
  assert.equal('responseBody' in report.items[0], false);
});

test('parses compact native-adapter host advertisements without assignment whitespace or trailing newlines', async () => {
  const docsUrl = 'https://docs.example.test/docs';
  const advertisement = await fetchHostExecutionAdvertisement(docsUrl, {
    fetchImpl: async (input, init = {}) => {
      assert.equal(String(input), docsUrl);
      assert.equal(init.redirect, 'manual');
      return { ok: true, status: 200, url: docsUrl, headers: new Headers(), text: async () => compactDocsHtml() };
    },
  });
  assert.deepEqual(advertisement, {
    available: false,
    endpoint: 'https://docs.example.test/docs/__flexdoc/execute',
    capabilities: [],
  });
});

test('fails explicit --host discovery when the page has no FlexDoc host-execution advertisement', async () => {
  const docsUrl = 'https://docs.example.test/docs';
  let targetStarted = false;
  const value = artifact([{ name: 'Public request', request: { method: 'GET', url: 'https://api.example.test/public' } }]);
  await withArtifact(value, async (path) => {
    await assert.rejects(
      () => runRunnerCli([path, '--host', docsUrl], {
        fetchImpl: async (input) => {
          if (String(input) === docsUrl) {
            return { ok: true, status: 200, url: docsUrl, headers: new Headers(), text: async () => '<html><body>Sign in</body></html>' };
          }
          targetStarted = true;
          throw new Error('target transport must not start after failed host discovery');
        },
        log: () => {},
        disableProcessSignals: true,
      }),
      /did not advertise a valid FlexDoc tryIt\.hostExecution capability/,
    );
  });
  assert.equal(targetStarted, false);
});

test('follows docs discovery redirects only on the original origin while retaining docs authentication', async () => {
  const calls = [];
  const advertisement = await fetchHostExecutionAdvertisement('https://docs.example.test/docs', {
    headers: { Authorization: 'Bearer docs-token', 'X-CI-Run': 'build-42' },
    fetchImpl: async (input, init = {}) => {
      const url = String(input);
      calls.push(url);
      assert.equal(init.redirect, 'manual');
      assert.equal(init.headers.get('Authorization'), 'Bearer docs-token');
      assert.equal(init.headers.get('X-CI-Run'), 'build-42');
      if (url === 'https://docs.example.test/docs') {
        return { ok: false, status: 302, headers: new Headers({ location: '/docs/' }) };
      }
      assert.equal(url, 'https://docs.example.test/docs/');
      return { ok: true, status: 200, url, headers: new Headers(), text: async () => docsHtml() };
    },
  });

  assert.deepEqual(calls, ['https://docs.example.test/docs', 'https://docs.example.test/docs/']);
  assert.equal(advertisement.endpoint, 'https://docs.example.test/docs/__flexdoc/execute');
});

test('rejects cross-origin docs redirects before authenticated headers can be forwarded', async () => {
  const calls = [];
  await assert.rejects(
    () => fetchHostExecutionAdvertisement('https://docs.example.test/docs', {
      headers: { Authorization: 'Bearer docs-token' },
      fetchImpl: async (input, init = {}) => {
        calls.push(String(input));
        assert.equal(init.headers.get('Authorization'), 'Bearer docs-token');
        return { ok: false, status: 302, headers: new Headers({ location: 'https://evil.example.test/docs' }) };
      },
    }),
    /redirect must remain on the original origin/,
  );
  assert.deepEqual(calls, ['https://docs.example.test/docs']);
});

test('consumes the existing docs-page host advertisement and reuses docs auth without leaking it to target APIs', async () => {
  const calls = [];
  const output = [];
  const docsUrl = 'https://docs.example.test/docs';
  const executeUrl = 'https://docs.example.test/docs/__flexdoc/execute';
  const html = docsHtml();
  const value = artifact([{
    name: 'Digest request',
    request: {
      method: 'GET',
      url: '{{baseUrl}}/private',
      auth: { type: 'digest', username: 'api-user', password: 'api-pass' },
    },
    scripts: { preRequest: '', tests: "flex.test('host status', () => flex.expect(flex.response.code).to.equal(201));" },
  }]);

  await withArtifact(value, async (path) => {
    const exitCode = await runRunnerCli([
      path,
      '--host', docsUrl,
      '--bearer', 'docs-token',
      '--header', 'X-CI-Run: build-42',
      '--json',
    ], {
      fetchImpl: async (input, init = {}) => {
        const url = String(input);
        calls.push({ url, init });
        if (url === docsUrl) {
          assert.equal(init.headers.get('Authorization'), 'Bearer docs-token');
          assert.equal(init.headers.get('X-CI-Run'), 'build-42');
          assert.equal(init.redirect, 'manual');
          return { ok: true, status: 200, url: docsUrl, headers: new Headers(), text: async () => html };
        }
        if (url === executeUrl) {
          assert.equal(init.headers.get('Authorization'), 'Bearer docs-token');
          assert.equal(init.headers.get('X-CI-Run'), 'build-42');
          assert.equal(init.headers.get('X-FlexDoc-Execute'), '1');
          assert.equal(init.redirect, 'manual');
          const envelope = JSON.parse(init.body);
          assert.equal(envelope.request.url, 'https://api.example.test/private');
          assert.equal(envelope.request.auth.type, 'digest');
          return new Response(JSON.stringify({
            status: 201,
            statusText: 'Created',
            headers: [['content-type', 'application/json']],
            body: '{"ok":true}',
            responseTime: 9,
          }), { status: 200 });
        }
        throw new Error(`Unexpected fetch ${url}`);
      },
      log: (line) => output.push(line),
      disableProcessSignals: true,
    });
    assert.equal(exitCode, 0);
  });

  assert.deepEqual(calls.map((call) => call.url), [docsUrl, executeUrl]);
  const report = JSON.parse(output[0]);
  assert.equal(report.items[0].executor, 'host');
  assert.equal(report.items[0].status, 201);
  assert.equal(report.items[0].responseTime, 9);
});

test('fails capability-gated requests before transport when host execution is unavailable', async () => {
  const output = [];
  let transportStarted = false;
  const value = artifact([{
    name: 'Digest request',
    request: {
      method: 'GET',
      url: '{{baseUrl}}/private',
      auth: { type: 'digest', username: 'api-user', password: 'api-pass' },
    },
  }]);

  await withArtifact(value, async (path) => {
    const exitCode = await runRunnerCli([path, '--json'], {
      fetchImpl: async () => {
        transportStarted = true;
        throw new Error('transport must not start without an advertised host capability');
      },
      log: (line) => output.push(line),
      disableProcessSignals: true,
    });
    assert.equal(exitCode, 1);
  });

  assert.equal(transportStarted, false);
  const report = JSON.parse(output[0]);
  assert.equal(report.status, 'fail');
  assert.equal(report.items[0].executor, null);
  assert.match(report.items[0].error, /Host execution is disabled/);
  assert.equal(report.items[0].status, undefined);
});

test('does not copy docs-host authentication onto direct requests when a host is advertised', async () => {
  const docsUrl = 'https://docs.example.test/docs';
  const targetUrl = 'https://api.example.test/public';
  const html = docsHtml();
  const value = artifact([{ name: 'Public request', request: { method: 'GET', url: targetUrl } }]);

  await withArtifact(value, async (path) => {
    const exitCode = await runRunnerCli([path, '--host', docsUrl, '--bearer', 'docs-token'], {
      fetchImpl: async (input, init = {}) => {
        const url = String(input);
        if (url === docsUrl) return { ok: true, status: 200, url: docsUrl, headers: new Headers(), text: async () => html };
        assert.equal(url, targetUrl);
        const headers = new Headers(init.headers || {});
        assert.equal(headers.has('Authorization'), false);
        return new Response('ok', { status: 200 });
      },
      log: () => {},
      disableProcessSignals: true,
    });
    assert.equal(exitCode, 0);
  });
});

test('preserves canonical stop-on-failure and runner pass/fail semantics', async () => {
  const calls = [];
  const output = [];
  const value = artifact([
    {
      name: 'Expected created',
      request: { method: 'GET', url: '{{baseUrl}}/first' },
      scripts: { preRequest: '', tests: "flex.test('created', () => flex.expect(flex.response.code).to.equal(201));" },
    },
    { name: 'Never reached', request: { method: 'GET', url: '{{baseUrl}}/second' } },
  ]);

  await withArtifact(value, async (path) => {
    const exitCode = await runRunnerCli([path, '--stop-on-failure', '--json'], {
      fetchImpl: async (url) => {
        calls.push(String(url));
        return new Response('ok', { status: 200 });
      },
      log: (line) => output.push(line),
      disableProcessSignals: true,
    });
    assert.equal(exitCode, 1);
  });

  assert.deepEqual(calls, ['https://api.example.test/first']);
  const report = JSON.parse(output[0]);
  assert.equal(report.total, 2);
  assert.equal(report.completed, 1);
  assert.equal(report.failed, 1);
  assert.equal(report.stopped, true);
  assert.equal(report.items[0].status, 200);
  assert.equal(report.items[0].passed, false);
});

test('pre-request failures do not execute transport and report no invented executor', async () => {
  const output = [];
  const value = artifact([{
    name: 'Broken setup',
    request: { method: 'GET', url: '{{baseUrl}}/never' },
    scripts: { preRequest: "throw new Error('setup exploded');", tests: '' },
  }]);

  await withArtifact(value, async (path) => {
    const exitCode = await runRunnerCli([path, '--json'], {
      fetchImpl: async () => { throw new Error('transport must not run'); },
      log: (line) => output.push(line),
      disableProcessSignals: true,
    });
    assert.equal(exitCode, 1);
  });

  const report = JSON.parse(output[0]);
  assert.equal(report.items[0].executor, null);
  assert.match(report.items[0].scriptError, /Pre-request script: setup exploded/);
  assert.equal(report.items[0].status, undefined);
});
