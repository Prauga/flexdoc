import { apiClientCollectionRunRequests, runApiClientCollection } from './api-client-runner';
import type { ApiClientWorkspaceState } from './api-client-workspace';

function response(body = '{}', status = 200): Response {
  return {
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: new Headers({ 'content-type': 'application/json' }),
    text: async () => body,
  } as Response;
}

function workspace(): ApiClientWorkspaceState {
  const timestamp = '2026-09-05T00:00:00.000Z';
  return {
    version: 6,
    collections: [{
      id: 'collection',
      name: 'Runner',
      auth: { type: 'bearer', token: 'collection-token' },
      variables: [
        { id: 'v-base', key: 'baseUrl', value: 'https://api.example.test', enabled: true },
        { id: 'v-seed', key: 'seed', value: 'initial', enabled: true },
      ],
      createdAt: timestamp,
      updatedAt: timestamp,
    }],
    folders: [
      { id: 'parent', collectionId: 'collection', name: 'Parent', auth: { type: 'apiKey', key: 'X-Folder', value: 'folder-key', in: 'header' }, createdAt: timestamp, updatedAt: timestamp },
      { id: 'child', collectionId: 'collection', parentFolderId: 'parent', name: 'Child', auth: { type: 'inherit' }, createdAt: timestamp, updatedAt: timestamp },
      { id: 'other', collectionId: 'collection', name: 'Other', auth: { type: 'inherit' }, createdAt: timestamp, updatedAt: timestamp },
    ],
    requests: [
      {
        id: 'first', collectionId: 'collection', folderId: 'parent', name: 'Set variables',
        request: { method: 'GET', url: '{{baseUrl}}/first', auth: { type: 'inherit' } },
        scripts: {
          preRequest: "flex.collection.set('seed', 'next'); flex.environment.set('runId', '42');",
          tests: "flex.test('first passed', () => flex.expect(flex.response.code).to.equal(200));",
        },
        createdAt: timestamp, updatedAt: timestamp,
      },
      {
        id: 'second', collectionId: 'collection', folderId: 'child', name: 'Use variables',
        request: { method: 'GET', url: '{{baseUrl}}/second/{{seed}}/{{runId}}', auth: { type: 'inherit' } },
        scripts: { preRequest: '', tests: "flex.test('second passed', () => flex.expect(flex.response.code).to.equal(200));" },
        createdAt: timestamp, updatedAt: timestamp,
      },
      {
        id: 'third', collectionId: 'collection', folderId: 'other', name: 'Other folder',
        request: { method: 'GET', url: '{{baseUrl}}/third', auth: { type: 'inherit' } },
        createdAt: timestamp, updatedAt: timestamp,
      },
    ],
    environments: [{
      id: 'environment', name: 'Local', variables: [], createdAt: timestamp, updatedAt: timestamp,
    }],
    activeEnvironmentId: 'environment',
    history: [],
  };
}

describe('api-client-runner', () => {
  it('selects a folder and all of its descendants in saved request order', () => {
    expect(apiClientCollectionRunRequests(workspace(), 'collection', 'parent').map((request) => request.id)).toEqual(['first', 'second']);
    expect(apiClientCollectionRunRequests(workspace(), 'collection').map((request) => request.id)).toEqual(['first', 'second', 'third']);
    expect(apiClientCollectionRunRequests(workspace(), 'collection', 'missing')).toEqual([]);
  });

  it('runs sequentially through the shared executor and carries script mutations into later requests', async () => {
    const urls: string[] = [];
    const folderHeaders: Array<string | null> = [];
    const fetcher: typeof fetch = async (input, init) => {
      urls.push(String(input));
      folderHeaders.push(new Headers(init?.headers).get('x-folder'));
      return response('{"ok":true}');
    };

    const result = await runApiClientCollection({
      workspace: workspace(),
      collectionId: 'collection',
      folderId: 'parent',
      fetcher,
    });

    expect(urls).toEqual([
      'https://api.example.test/first',
      'https://api.example.test/second/next/42',
    ]);
    expect(folderHeaders).toEqual(['folder-key', 'folder-key']);
    expect(result).toMatchObject({ total: 2, completed: 2, passed: 2, failed: 0, stopped: false });
    expect(result.items.map((item) => item.requestId)).toEqual(['first', 'second']);
    expect(result.workspace.collections[0].variables.find((variable) => variable.key === 'seed')?.value).toBe('next');
    expect(result.workspace.environments[0].variables.find((variable) => variable.key === 'runId')?.value).toBe('42');
    expect(result.workspace.history).toHaveLength(2);
    expect(result.workspace.history[0].resolvedUrl).toBe('https://api.example.test/second/next/42');
  });

  it('marks test failures without treating HTTP status alone as a failed run item', async () => {
    const state = workspace();
    state.requests = [{
      ...state.requests[0],
      id: 'expected-404',
      scripts: { preRequest: '', tests: "flex.test('expected', () => flex.expect(flex.response.code).to.equal(404));" },
    }];
    const result = await runApiClientCollection({
      workspace: state,
      collectionId: 'collection',
      fetcher: async () => response('{"missing":true}', 404),
    });
    expect(result.items[0].passed).toBe(true);
    expect(result.passed).toBe(1);
    expect(result.failed).toBe(0);
  });

  it('can stop after a transport failure and leaves later requests unexecuted', async () => {
    let calls = 0;
    const result = await runApiClientCollection({
      workspace: workspace(),
      collectionId: 'collection',
      stopOnFailure: true,
      fetcher: async () => {
        calls += 1;
        throw new Error('offline');
      },
    });
    expect(calls).toBe(1);
    expect(result).toMatchObject({ total: 3, completed: 1, passed: 0, failed: 1, stopped: true });
    expect(result.items[0].outcome.error).toBe('offline');
    expect(result.workspace.history).toHaveLength(1);
  });
});
