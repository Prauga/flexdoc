import {
  activeApiClientEnvironmentVariables,
  cloneRequestDraft,
  createDefaultApiClientWorkspace,
  deleteApiClientCollection,
  deleteApiClientEnvironment,
  deleteApiClientFolder,
  normalizeApiClientWorkspace,
} from './api-client-workspace';

describe('api-client-workspace', () => {
  it('clones editable request state without sharing nested values', () => {
    const source = {
      method: 'POST',
      url: 'https://api.example.test/pets',
      query: [{ key: 'limit', value: '10' }],
      headers: [{ key: 'X-Trace', value: 'one' }],
      auth: { type: 'bearer' as const, token: 'secret' },
    };

    const clone = cloneRequestDraft(source);
    clone.query![0].value = '20';
    clone.headers![0].value = 'two';
    if (clone.auth?.type === 'bearer') clone.auth.token = 'changed';

    expect(source.query[0].value).toBe('10');
    expect(source.headers[0].value).toBe('one');
    expect(source.auth.token).toBe('secret');
  });

  it('migrates version 1 workspaces without losing saved requests', () => {
    const migrated = normalizeApiClientWorkspace({
      version: 1,
      collections: [{ id: 'collection-1', name: 'Legacy', createdAt: '2026-01-01', updatedAt: '2026-01-01' }],
      folders: [],
      requests: [{
        id: 'request-1',
        collectionId: 'collection-1',
        name: 'List pets',
        request: { method: 'GET', url: '{{baseUrl}}/pets' },
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      }],
    });

    expect(migrated.version).toBe(2);
    expect(migrated.collections[0].name).toBe('Legacy');
    expect(migrated.requests[0].request.url).toBe('{{baseUrl}}/pets');
    expect(migrated.environments).toEqual([]);
  });

  it('builds a prototype-safe active environment variable map from enabled named values', () => {
    const workspace = createDefaultApiClientWorkspace();
    workspace.environments.push({
      id: 'environment-1',
      name: 'Local',
      createdAt: '2026-09-01',
      updatedAt: '2026-09-01',
      variables: [
        { id: 'variable-1', key: 'baseUrl', value: 'http://localhost:3000' },
        { id: 'variable-2', key: 'token', value: 'secret', enabled: false },
        { id: 'variable-3', key: 'baseUrl', value: 'http://localhost:4000' },
        { id: 'variable-4', key: '   ', value: 'ignored' },
        { id: 'variable-5', key: '__proto__', value: 'safe-proto' },
        { id: 'variable-6', key: 'constructor', value: 'safe-constructor' },
      ],
    });
    workspace.activeEnvironmentId = 'environment-1';

    const variables = activeApiClientEnvironmentVariables(workspace);
    expect(Object.getPrototypeOf(variables)).toBeNull();
    expect(variables.baseUrl).toBe('http://localhost:4000');
    expect(variables.__proto__).toBe('safe-proto');
    expect(variables.constructor).toBe('safe-constructor');
    expect(Object.prototype.hasOwnProperty.call(variables, 'token')).toBe(false);
  });

  it('clears the active selection when an environment is deleted', () => {
    const workspace = createDefaultApiClientWorkspace();
    workspace.environments.push({ id: 'environment-1', name: 'Local', variables: [], createdAt: '2026-09-01', updatedAt: '2026-09-01' });
    workspace.activeEnvironmentId = 'environment-1';

    const next = deleteApiClientEnvironment(workspace, 'environment-1');
    expect(next.environments).toHaveLength(0);
    expect(next.activeEnvironmentId).toBeUndefined();
  });

  it('moves requests to unfiled when a folder is deleted', () => {
    const workspace = createDefaultApiClientWorkspace();
    const collectionId = workspace.collections[0].id;
    workspace.folders.push({
      id: 'folder-1',
      collectionId,
      name: 'Pets',
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    });
    workspace.requests.push({
      id: 'request-1',
      collectionId,
      folderId: 'folder-1',
      name: 'List pets',
      request: { method: 'GET', url: 'https://api.example.test/pets' },
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    });

    const next = deleteApiClientFolder(workspace, 'folder-1');
    expect(next.folders).toHaveLength(0);
    expect(next.requests[0].folderId).toBeUndefined();
  });

  it('cascades collection contents while always keeping one collection and environments', () => {
    const workspace = createDefaultApiClientWorkspace();
    const firstId = workspace.collections[0].id;
    workspace.environments.push({ id: 'environment-1', name: 'Local', variables: [], createdAt: '2026-09-01', updatedAt: '2026-09-01' });
    workspace.activeEnvironmentId = 'environment-1';
    const next = deleteApiClientCollection(workspace, firstId);

    expect(next.collections).toHaveLength(1);
    expect(next.collections[0].name).toBe('My Collection');
    expect(next.collections[0].id).not.toBe(firstId);
    expect(next.environments).toHaveLength(1);
    expect(next.activeEnvironmentId).toBe('environment-1');
  });
});
