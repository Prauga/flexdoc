import {
  API_CLIENT_RUNNER_ARTIFACT_KIND,
  API_CLIENT_RUNNER_ARTIFACT_VERSION,
  exportApiClientRunnerArtifact,
  parseApiClientRunnerArtifact,
  serializeApiClientRunnerArtifact,
} from './api-client-runner-artifact';
import type { ApiClientWorkspaceState } from './api-client-workspace';

function workspace(): ApiClientWorkspaceState {
  return {
    version: 6,
    collections: [{
      id: 'collection-1',
      name: 'Pets',
      auth: { type: 'basic', username: 'root', password: 'secret' },
      variables: [{ id: 'collection-variable', key: 'tenant', value: 'acme' }],
      createdAt: '2026-09-08T00:00:00.000Z',
      updatedAt: '2026-09-08T00:00:00.000Z',
    }],
    folders: [
      { id: 'root', collectionId: 'collection-1', name: 'Root', auth: { type: 'inherit' }, createdAt: '2026-09-08T00:00:00.000Z', updatedAt: '2026-09-08T00:00:00.000Z' },
      { id: 'child', collectionId: 'collection-1', parentFolderId: 'root', name: 'Child', auth: { type: 'bearer', token: 'folder-token' }, createdAt: '2026-09-08T00:00:00.000Z', updatedAt: '2026-09-08T00:00:00.000Z' },
      { id: 'grandchild', collectionId: 'collection-1', parentFolderId: 'child', name: 'Grandchild', auth: { type: 'inherit' }, createdAt: '2026-09-08T00:00:00.000Z', updatedAt: '2026-09-08T00:00:00.000Z' },
      { id: 'sibling', collectionId: 'collection-1', parentFolderId: 'root', name: 'Sibling', auth: { type: 'inherit' }, createdAt: '2026-09-08T00:00:00.000Z', updatedAt: '2026-09-08T00:00:00.000Z' },
    ],
    requests: [
      { id: 'top-request', collectionId: 'collection-1', name: 'Top', request: { method: 'GET', url: '{{baseUrl}}/top', auth: { type: 'inherit' } }, createdAt: '2026-09-08T00:00:00.000Z', updatedAt: '2026-09-08T00:00:00.000Z' },
      { id: 'root-request', collectionId: 'collection-1', folderId: 'root', name: 'Root request', request: { method: 'GET', url: '{{baseUrl}}/root', auth: { type: 'inherit' } }, createdAt: '2026-09-08T00:00:00.000Z', updatedAt: '2026-09-08T00:00:00.000Z' },
      { id: 'child-request', collectionId: 'collection-1', folderId: 'child', name: 'Child request', request: { method: 'POST', url: '{{baseUrl}}/child', auth: { type: 'inherit' } }, scripts: { preRequest: "flex.variables.set('seen', 'yes')", tests: "flex.test('created', () => flex.expect(flex.response?.code).to.equal(201));" }, createdAt: '2026-09-08T00:00:00.000Z', updatedAt: '2026-09-08T00:00:00.000Z' },
      { id: 'grandchild-request', collectionId: 'collection-1', folderId: 'grandchild', name: 'Grandchild request', request: { method: 'GET', url: '{{baseUrl}}/grandchild', auth: { type: 'inherit' } }, createdAt: '2026-09-08T00:00:00.000Z', updatedAt: '2026-09-08T00:00:00.000Z' },
      { id: 'sibling-request', collectionId: 'collection-1', folderId: 'sibling', name: 'Sibling request', request: { method: 'GET', url: '{{baseUrl}}/sibling', auth: { type: 'inherit' } }, createdAt: '2026-09-08T00:00:00.000Z', updatedAt: '2026-09-08T00:00:00.000Z' },
    ],
    environments: [
      { id: 'environment-1', name: 'CI', variables: [{ id: 'base-url', key: 'baseUrl', value: 'https://api.example.test' }], createdAt: '2026-09-08T00:00:00.000Z', updatedAt: '2026-09-08T00:00:00.000Z' },
      { id: 'environment-2', name: 'Local', variables: [{ id: 'local-url', key: 'baseUrl', value: 'http://127.0.0.1:3000' }], createdAt: '2026-09-08T00:00:00.000Z', updatedAt: '2026-09-08T00:00:00.000Z' },
    ],
    activeEnvironmentId: 'environment-1',
    history: [{
      id: 'history-1',
      request: { method: 'GET', url: 'https://api.example.test/old' },
      executedMethod: 'GET',
      resolvedUrl: 'https://api.example.test/old',
      createdAt: '2026-09-08T00:00:00.000Z',
    }],
  };
}

describe('FlexDoc Runner artifacts', () => {
  it('exports a folder subtree with auth ancestors, saved order, and only the active environment', () => {
    const artifact = exportApiClientRunnerArtifact(
      workspace(),
      { type: 'folder', collectionId: 'collection-1', folderId: 'child' },
      { exportedAt: '2026-09-08T12:00:00.000Z' },
    );

    expect(artifact.kind).toBe(API_CLIENT_RUNNER_ARTIFACT_KIND);
    expect(artifact.version).toBe(API_CLIENT_RUNNER_ARTIFACT_VERSION);
    expect(artifact.workspace.collections.map((collection) => collection.id)).toEqual(['collection-1']);
    expect(artifact.workspace.folders.map((folder) => folder.id)).toEqual(['root', 'child', 'grandchild']);
    expect(artifact.workspace.requests.map((request) => request.id)).toEqual(['child-request', 'grandchild-request']);
    expect(artifact.workspace.environments.map((environment) => environment.id)).toEqual(['environment-1']);
    expect(artifact.workspace.activeEnvironmentId).toBe('environment-1');
    expect(artifact.workspace.history).toEqual([]);
    expect(artifact.workspace.requests[0].scripts?.tests).toContain("flex.test('created'");

    const reparsed = parseApiClientRunnerArtifact(JSON.parse(serializeApiClientRunnerArtifact(artifact)));
    expect(reparsed).toEqual(artifact);
  });

  it('exports one request plus only the folder chain required for inherited auth', () => {
    const artifact = exportApiClientRunnerArtifact(
      workspace(),
      { type: 'request', collectionId: 'collection-1', requestId: 'grandchild-request' },
      { environmentId: false, exportedAt: '2026-09-08T12:00:00.000Z' },
    );

    expect(artifact.workspace.requests.map((request) => request.id)).toEqual(['grandchild-request']);
    expect(artifact.workspace.folders.map((folder) => folder.id)).toEqual(['root', 'child', 'grandchild']);
    expect(artifact.workspace.environments).toEqual([]);
    expect(artifact.workspace.activeEnvironmentId).toBeUndefined();
  });

  it('rejects malformed scopes instead of silently normalizing them into another workspace', () => {
    const artifact = exportApiClientRunnerArtifact(
      workspace(),
      { type: 'collection', collectionId: 'collection-1' },
      { exportedAt: '2026-09-08T12:00:00.000Z' },
    );
    expect(() => parseApiClientRunnerArtifact({ ...artifact, scope: { type: 'folder', collectionId: 'collection-1', folderId: 'missing' } })).toThrow('missing folder');
    expect(() => parseApiClientRunnerArtifact({ ...artifact, kind: 'something-else' })).toThrow('Invalid FlexDoc Runner artifact');
  });

  it('rejects legacy workspace versions and persisted history in portable artifacts', () => {
    const artifact = exportApiClientRunnerArtifact(
      workspace(),
      { type: 'collection', collectionId: 'collection-1' },
      { exportedAt: '2026-09-08T12:00:00.000Z' },
    );
    expect(() => parseApiClientRunnerArtifact({
      ...artifact,
      workspace: { ...artifact.workspace, version: 5 },
    })).toThrow('canonical workspace version 6 with empty history');
    expect(() => parseApiClientRunnerArtifact({
      ...artifact,
      workspace: { ...artifact.workspace, history: workspace().history },
    })).toThrow('canonical workspace version 6 with empty history');
  });

  it('rejects malformed entities that workspace normalization would otherwise remove or repair', () => {
    const artifact = exportApiClientRunnerArtifact(
      workspace(),
      { type: 'collection', collectionId: 'collection-1' },
      { exportedAt: '2026-09-08T12:00:00.000Z' },
    );
    const malformedRequest = {
      ...artifact.workspace.requests[0],
      request: { method: 42, url: 'https://api.example.test/broken' },
    };
    expect(() => parseApiClientRunnerArtifact({
      ...artifact,
      workspace: { ...artifact.workspace, requests: [malformedRequest, ...artifact.workspace.requests.slice(1)] },
    })).toThrow('must not require workspace migration or normalization repairs');

    expect(() => parseApiClientRunnerArtifact({
      ...artifact,
      workspace: { ...artifact.workspace, activeEnvironmentId: 'missing-environment' },
    })).toThrow('must not require workspace migration or normalization repairs');
  });

  it('rejects executable entities outside the declared request or folder scope', () => {
    const state = workspace();
    const requestArtifact = exportApiClientRunnerArtifact(
      state,
      { type: 'request', collectionId: 'collection-1', requestId: 'grandchild-request' },
      { environmentId: false, exportedAt: '2026-09-08T12:00:00.000Z' },
    );
    expect(() => parseApiClientRunnerArtifact({
      ...requestArtifact,
      workspace: {
        ...requestArtifact.workspace,
        requests: [...requestArtifact.workspace.requests, state.requests[0]],
      },
    })).toThrow('outside its declared request scope');

    const folderArtifact = exportApiClientRunnerArtifact(
      state,
      { type: 'folder', collectionId: 'collection-1', folderId: 'child' },
      { environmentId: false, exportedAt: '2026-09-08T12:00:00.000Z' },
    );
    expect(() => parseApiClientRunnerArtifact({
      ...folderArtifact,
      workspace: {
        ...folderArtifact.workspace,
        folders: [...folderArtifact.workspace.folders, state.folders.find((folder) => folder.id === 'sibling')],
        requests: [...folderArtifact.workspace.requests, state.requests.find((request) => request.id === 'sibling-request')],
      },
    })).toThrow('outside its declared folder scope');
  });

  it('rejects duplicate entity ids before execution evidence becomes ambiguous', () => {
  const artifact = exportApiClientRunnerArtifact(
    workspace(),
    { type: 'collection', collectionId: 'collection-1' },
    { exportedAt: '2026-09-08T12:00:00.000Z' },
  );
  const duplicateRequest = { ...artifact.workspace.requests[0], name: 'Duplicate request id' };
  expect(() => parseApiClientRunnerArtifact({
    ...artifact,
    workspace: {
      ...artifact.workspace,
      requests: [artifact.workspace.requests[0], duplicateRequest, ...artifact.workspace.requests.slice(1)],
    },
  })).toThrow('duplicate request id');
});

  it('rejects multiple collections or environments behind a single scoped artifact', () => {
    const artifact = exportApiClientRunnerArtifact(
      workspace(),
      { type: 'collection', collectionId: 'collection-1' },
      { exportedAt: '2026-09-08T12:00:00.000Z' },
    );
    const secondCollection = {
      ...artifact.workspace.collections[0],
      id: 'collection-2',
      name: 'Hidden collection',
    };
    expect(() => parseApiClientRunnerArtifact({
      ...artifact,
      workspace: { ...artifact.workspace, collections: [...artifact.workspace.collections, secondCollection] },
    })).toThrow('exactly the scoped collection');

    const secondEnvironment = workspace().environments[1];
    expect(() => parseApiClientRunnerArtifact({
      ...artifact,
      workspace: { ...artifact.workspace, environments: [...artifact.workspace.environments, secondEnvironment] },
    })).toThrow('at most one selected environment');
  });

  it('fails explicitly when an IndexedDB request still contains a non-portable file payload', () => {
    const state = workspace();
    state.requests[0].request = {
      method: 'POST',
      url: 'https://api.example.test/upload',
      bodyMode: 'binary',
      binary: { fileName: 'payload.bin', file: {} as File },
    };
    expect(() => exportApiClientRunnerArtifact(state, { type: 'request', collectionId: 'collection-1', requestId: 'top-request' })).toThrow('file payload export is not supported yet');
  });
});
