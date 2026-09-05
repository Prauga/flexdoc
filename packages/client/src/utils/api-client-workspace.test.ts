import {
  activeApiClientEnvironmentVariables,
  addApiClientHistoryEntry,
  cloneRequestDraft,
  createDefaultApiClientPersistenceKey,
  createDefaultApiClientWorkspace,
  deleteApiClientCollection,
  deleteApiClientEnvironment,
  deleteApiClientFolder,
  normalizeApiClientWorkspace,
  resolveApiClientAuth,
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

  it('derives distinct default persistence keys from the page host and spec title', () => {
    expect(createDefaultApiClientPersistenceKey('Pets API', 'docs.example.test')).toBe('flexdoc:docs.example.test:Pets%20API');
    expect(createDefaultApiClientPersistenceKey('Billing API', 'docs.example.test')).toBe('flexdoc:docs.example.test:Billing%20API');
    expect(createDefaultApiClientPersistenceKey('Pets API', 'internal.example.test')).toBe('flexdoc:internal.example.test:Pets%20API');
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

    expect(migrated.version).toBe(6);
    expect(migrated.collections[0].name).toBe('Legacy');
    expect(migrated.requests[0].request.url).toBe('{{baseUrl}}/pets');
    expect(migrated.requests[0].scripts).toBeUndefined();
    expect(migrated.environments).toEqual([]);
    expect(migrated.history).toEqual([]);
  });

  it('migrates version 2 workspaces while preserving environments', () => {
    const migrated = normalizeApiClientWorkspace({
      version: 2,
      collections: [{ id: 'collection-1', name: 'Existing', createdAt: '2026-01-01', updatedAt: '2026-01-01' }],
      folders: [],
      requests: [],
      environments: [{ id: 'environment-1', name: 'Local', variables: [], createdAt: '2026-01-01', updatedAt: '2026-01-01' }],
      activeEnvironmentId: 'environment-1',
    });

    expect(migrated.version).toBe(6);
    expect(migrated.environments).toHaveLength(1);
    expect(migrated.activeEnvironmentId).toBe('environment-1');
    expect(migrated.history).toEqual([]);
  });

  it('migrates version 3 workspaces while preserving scripts and starting empty history', () => {
    const migrated = normalizeApiClientWorkspace({
      version: 3,
      collections: [{ id: 'collection-1', name: 'Scripts', createdAt: '2026-09-01', updatedAt: '2026-09-01' }],
      folders: [],
      requests: [{
        id: 'request-1',
        collectionId: 'collection-1',
        name: 'List pets',
        request: { method: 'GET', url: '/pets' },
        scripts: { preRequest: 'console.log(1)', tests: "flex.test('ok', () => {})" },
        createdAt: '2026-09-01',
        updatedAt: '2026-09-01',
      }],
      environments: [],
    });

    expect(migrated.version).toBe(6);
    expect(migrated.requests[0].scripts?.preRequest).toBe('console.log(1)');
    expect(migrated.history).toEqual([]);
  });

  it('migrates flat version 4 folders as root folders', () => {
    const migrated = normalizeApiClientWorkspace({
      version: 4,
      collections: [{ id: 'collection-1', name: 'Legacy folders', variables: [], createdAt: '2026-09-01', updatedAt: '2026-09-01' }],
      folders: [{ id: 'folder-1', collectionId: 'collection-1', name: 'Pets', createdAt: '2026-09-01', updatedAt: '2026-09-01' }],
      requests: [],
      environments: [],
      history: [],
    });

    expect(migrated.version).toBe(6);
    expect(migrated.folders).toEqual([
      { id: 'folder-1', collectionId: 'collection-1', parentFolderId: undefined, name: 'Pets', auth: { type: 'inherit' }, createdAt: '2026-09-01', updatedAt: '2026-09-01' },
    ]);
  });

  it('preserves valid nested folders while repairing invalid parents and cycles', () => {
    const normalized = normalizeApiClientWorkspace({
      version: 5,
      collections: [
        { id: 'collection-1', name: 'One', variables: [], createdAt: '2026-09-01', updatedAt: '2026-09-01' },
        { id: 'collection-2', name: 'Two', variables: [], createdAt: '2026-09-01', updatedAt: '2026-09-01' },
      ],
      folders: [
        { id: 'root', collectionId: 'collection-1', name: 'Root', createdAt: '2026-09-01', updatedAt: '2026-09-01' },
        { id: 'child', collectionId: 'collection-1', parentFolderId: 'root', name: 'Child', createdAt: '2026-09-01', updatedAt: '2026-09-01' },
        { id: 'cross', collectionId: 'collection-1', parentFolderId: 'other-root', name: 'Cross', createdAt: '2026-09-01', updatedAt: '2026-09-01' },
        { id: 'missing', collectionId: 'collection-1', parentFolderId: 'missing-id', name: 'Missing', createdAt: '2026-09-01', updatedAt: '2026-09-01' },
        { id: 'self', collectionId: 'collection-1', parentFolderId: 'self', name: 'Self', createdAt: '2026-09-01', updatedAt: '2026-09-01' },
        { id: 'other-root', collectionId: 'collection-2', name: 'Other', createdAt: '2026-09-01', updatedAt: '2026-09-01' },
        { id: 'cycle-a', collectionId: 'collection-1', parentFolderId: 'cycle-b', name: 'A', createdAt: '2026-09-01', updatedAt: '2026-09-01' },
        { id: 'cycle-b', collectionId: 'collection-1', parentFolderId: 'cycle-a', name: 'B', createdAt: '2026-09-01', updatedAt: '2026-09-01' },
      ],
      requests: [],
      environments: [],
      history: [],
    });

    expect(normalized.folders.find((folder) => folder.id === 'child')?.parentFolderId).toBe('root');
    expect(normalized.folders.find((folder) => folder.id === 'cross')?.parentFolderId).toBeUndefined();
    expect(normalized.folders.find((folder) => folder.id === 'missing')?.parentFolderId).toBeUndefined();
    expect(normalized.folders.find((folder) => folder.id === 'self')?.parentFolderId).toBeUndefined();
    const cycleA = normalized.folders.find((folder) => folder.id === 'cycle-a');
    const cycleB = normalized.folders.find((folder) => folder.id === 'cycle-b');
    expect(cycleA?.parentFolderId === undefined || cycleB?.parentFolderId === undefined).toBe(true);
  });

  it('preserves valid saved scripts and strips malformed script payloads', () => {
    const normalized = normalizeApiClientWorkspace({
      version: 3,
      collections: [{ id: 'collection-1', name: 'Scripts', createdAt: '2026-09-01', updatedAt: '2026-09-01' }],
      folders: [],
      requests: [
        {
          id: 'request-good',
          collectionId: 'collection-1',
          name: 'Good',
          request: { method: 'GET', url: '/pets' },
          scripts: { preRequest: 'console.log(1)', tests: "flex.test('ok', () => {})" },
          createdAt: '2026-09-01',
          updatedAt: '2026-09-01',
        },
        {
          id: 'request-bad-scripts',
          collectionId: 'collection-1',
          name: 'Still valid request',
          request: { method: 'GET', url: '/owners' },
          scripts: { preRequest: 42, tests: null },
          createdAt: '2026-09-01',
          updatedAt: '2026-09-01',
        },
      ],
      environments: [],
    });

    expect(normalized.requests[0].scripts).toEqual({ preRequest: 'console.log(1)', tests: "flex.test('ok', () => {})" });
    expect(normalized.requests[1].scripts).toBeUndefined();
  });

  it('normalizes valid request history and filters malformed entries', () => {
    const normalized = normalizeApiClientWorkspace({
      version: 4,
      collections: [{ id: 'collection-1', name: 'History', createdAt: '2026-09-01', updatedAt: '2026-09-01' }],
      folders: [],
      requests: [],
      environments: [],
      history: [
        {
          id: 'history-good',
          collectionId: 'deleted-collection',
          folderId: 'deleted-folder',
          request: { method: 'GET', url: '{{baseUrl}}/pets' },
          scripts: { preRequest: '', tests: '' },
          executedMethod: 'GET',
          resolvedUrl: 'https://api.example.test/pets',
          status: 200,
          statusText: 'OK',
          responseTime: 18,
          createdAt: '2026-09-01T10:00:00.000Z',
        },
        {
          id: 'history-bad',
          request: { method: 'GET', url: '/pets' },
          executedMethod: 'GET',
          resolvedUrl: 42,
          createdAt: '2026-09-01T10:00:00.000Z',
        },
      ],
    });

    expect(normalized.history).toHaveLength(1);
    expect(normalized.history[0]).toMatchObject({
      id: 'history-good',
      collectionId: 'deleted-collection',
      folderId: 'deleted-folder',
      executedMethod: 'GET',
      resolvedUrl: 'https://api.example.test/pets',
      status: 200,
      responseTime: 18,
    });
  });

  it('persists and normalizes script test outcomes in history', () => {
    const workspace = createDefaultApiClientWorkspace();
    const next = addApiClientHistoryEntry(workspace, {
      request: { method: 'GET', url: 'https://api.example.test/pets' },
      executedMethod: 'GET',
      resolvedUrl: 'https://api.example.test/pets',
      status: 200,
      scriptTests: [
        { name: 'status is 200', passed: true },
        { name: 'body matches', passed: false, error: 'expected mismatch' },
      ],
      scriptLogs: ['prepared 77', 'tested 200'],
      scriptError: 'Test script: late failure',
    });

    expect(next.history[0]).toMatchObject({
      scriptTests: [
        { name: 'status is 200', passed: true },
        { name: 'body matches', passed: false, error: 'expected mismatch' },
      ],
      scriptLogs: ['prepared 77', 'tested 200'],
      scriptError: 'Test script: late failure',
    });

    const normalized = normalizeApiClientWorkspace(JSON.parse(JSON.stringify(next)));
    expect(normalized.history[0].scriptTests).toEqual(next.history[0].scriptTests);
    expect(normalized.history[0].scriptLogs).toEqual(['prepared 77', 'tested 200']);
  });

  it('keeps only the 100 most recent request history entries', () => {
    let workspace = createDefaultApiClientWorkspace();
    for (let index = 0; index < 105; index += 1) {
      workspace = addApiClientHistoryEntry(workspace, {
        collectionId: 'collection-history',
        request: { method: 'GET', url: `/pets/${index}` },
        executedMethod: 'GET',
        resolvedUrl: `https://api.example.test/pets/${index}`,
        status: 200,
      });
    }

    expect(workspace.history).toHaveLength(100);
    expect(workspace.history[0].collectionId).toBe('collection-history');
    expect(workspace.history[0].resolvedUrl).toBe('https://api.example.test/pets/104');
    expect(workspace.history[99].resolvedUrl).toBe('https://api.example.test/pets/5');
  });

  it('filters corrupt IndexedDB entries while preserving valid environments and variables', () => {
    const normalized = normalizeApiClientWorkspace({
      version: 2,
      collections: [
        null,
        { id: 'collection-1', name: 'Valid', createdAt: '2026-09-01', updatedAt: '2026-09-01' },
      ],
      folders: [
        'bad-folder',
        { id: 'folder-1', collectionId: 'missing', name: 'Orphan', createdAt: '2026-09-01', updatedAt: '2026-09-01' },
      ],
      requests: [
        { id: 'request-bad', collectionId: 'collection-1', name: 'Broken', request: { url: '/pets' }, createdAt: '2026-09-01', updatedAt: '2026-09-01' },
        { id: 'request-good', collectionId: 'collection-1', name: 'List pets', request: { method: 'GET', url: '/pets' }, createdAt: '2026-09-01', updatedAt: '2026-09-01' },
      ],
      environments: [
        {
          id: 'environment-local',
          name: 'Local',
          variables: [
            null,
            { id: 'variable-good', key: 'baseUrl', value: 'http://localhost:3000' },
          ],
          createdAt: '2026-09-01',
          updatedAt: '2026-09-01',
        },
        { id: 'environment-broken', variables: [], createdAt: '2026-09-01', updatedAt: '2026-09-01' },
      ],
      activeEnvironmentId: 'environment-broken',
    });

    expect(normalized.collections.map((collection) => collection.id)).toEqual(['collection-1']);
    expect(normalized.folders).toEqual([]);
    expect(normalized.requests.map((request) => request.id)).toEqual(['request-good']);
    expect(normalized.environments.map((environment) => environment.id)).toEqual(['environment-local']);
    expect(normalized.environments[0].variables).toEqual([
      { id: 'variable-good', key: 'baseUrl', value: 'http://localhost:3000' },
    ]);
    expect(normalized.activeEnvironmentId).toBeUndefined();
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

  it('moves requests to unfiled when a root folder is deleted', () => {
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

  it('promotes child folders and direct requests when a nested folder is deleted', () => {
    const workspace = createDefaultApiClientWorkspace();
    const collectionId = workspace.collections[0].id;
    workspace.folders.push(
      { id: 'parent', collectionId, name: 'Parent', createdAt: '2026-09-01', updatedAt: '2026-09-01' },
      { id: 'middle', collectionId, parentFolderId: 'parent', name: 'Middle', createdAt: '2026-09-01', updatedAt: '2026-09-01' },
      { id: 'child', collectionId, parentFolderId: 'middle', name: 'Child', createdAt: '2026-09-01', updatedAt: '2026-09-01' },
    );
    workspace.requests.push({
      id: 'request-1',
      collectionId,
      folderId: 'middle',
      name: 'List pets',
      request: { method: 'GET', url: '/pets' },
      createdAt: '2026-09-01',
      updatedAt: '2026-09-01',
    });

    const next = deleteApiClientFolder(workspace, 'middle');
    expect(next.folders.find((folder) => folder.id === 'child')?.parentFolderId).toBe('parent');
    expect(next.requests[0].folderId).toBe('parent');
  });

  it('cascades collection contents while always keeping one collection, environments, and history', () => {
    let workspace = createDefaultApiClientWorkspace();
    const firstId = workspace.collections[0].id;
    workspace.environments.push({ id: 'environment-1', name: 'Local', variables: [], createdAt: '2026-09-01', updatedAt: '2026-09-01' });
    workspace.activeEnvironmentId = 'environment-1';
    workspace = addApiClientHistoryEntry(workspace, {
      request: { method: 'GET', url: '/pets' },
      executedMethod: 'GET',
      resolvedUrl: 'https://api.example.test/pets',
      status: 200,
    });
    const next = deleteApiClientCollection(workspace, firstId);

    expect(next.collections).toHaveLength(1);
    expect(next.collections[0].name).toBe('My Collection');
    expect(next.collections[0].id).not.toBe(firstId);
    expect(next.environments).toHaveLength(1);
    expect(next.activeEnvironmentId).toBe('environment-1');
    expect(next.history).toHaveLength(1);
  });

  it('migrates pre-auth workspaces with behavior-preserving auth defaults', () => {
    const normalized = normalizeApiClientWorkspace({
      version: 5,
      collections: [{ id: 'collection-1', name: 'Legacy', variables: [], createdAt: '2026-09-01', updatedAt: '2026-09-01' }],
      folders: [{ id: 'folder-1', collectionId: 'collection-1', name: 'Pets', createdAt: '2026-09-01', updatedAt: '2026-09-01' }],
      requests: [{
        id: 'request-1',
        collectionId: 'collection-1',
        folderId: 'folder-1',
        name: 'List pets',
        request: { method: 'GET', url: '/pets', auth: { type: 'none' } },
        createdAt: '2026-09-01',
        updatedAt: '2026-09-01',
      }],
      environments: [],
      history: [],
    });

    expect(normalized.version).toBe(6);
    expect(normalized.collections[0].auth).toEqual({ type: 'none' });
    expect(normalized.folders[0].auth).toEqual({ type: 'inherit' });
    expect(normalized.requests[0].request.auth).toEqual({ type: 'none' });
  });

  it('resolves request, nearest-folder, ancestor-folder, and collection auth in order', () => {
    const workspace = createDefaultApiClientWorkspace();
    const collectionId = workspace.collections[0].id;
    workspace.collections[0].auth = { type: 'bearer', token: 'collection-token' };
    workspace.folders.push(
      { id: 'root', collectionId, name: 'Root', auth: { type: 'basic', username: 'root', password: 'secret' }, createdAt: '2026-09-01', updatedAt: '2026-09-01' },
      { id: 'child', collectionId, parentFolderId: 'root', name: 'Child', auth: { type: 'inherit' }, createdAt: '2026-09-01', updatedAt: '2026-09-01' },
      { id: 'leaf', collectionId, parentFolderId: 'child', name: 'Leaf', auth: { type: 'apiKey', key: 'X-Key', value: 'leaf', in: 'header' }, createdAt: '2026-09-01', updatedAt: '2026-09-01' },
    );

    expect(resolveApiClientAuth(workspace, collectionId, 'leaf', { type: 'bearer', token: 'request-token' })).toEqual({ type: 'bearer', token: 'request-token' });
    expect(resolveApiClientAuth(workspace, collectionId, 'leaf', { type: 'inherit' })).toEqual({ type: 'apiKey', key: 'X-Key', value: 'leaf', in: 'header' });
    workspace.folders.find((folder) => folder.id === 'leaf')!.auth = { type: 'inherit' };
    expect(resolveApiClientAuth(workspace, collectionId, 'leaf', { type: 'inherit' })).toEqual({ type: 'basic', username: 'root', password: 'secret' });
    workspace.folders.find((folder) => folder.id === 'root')!.auth = { type: 'inherit' };
    expect(resolveApiClientAuth(workspace, collectionId, 'leaf', { type: 'inherit' })).toEqual({ type: 'bearer', token: 'collection-token' });
  });

  it('treats explicit no-auth as an override instead of inheriting', () => {
    const workspace = createDefaultApiClientWorkspace();
    const collectionId = workspace.collections[0].id;
    workspace.collections[0].auth = { type: 'bearer', token: 'collection-token' };
    expect(resolveApiClientAuth(workspace, collectionId, undefined, { type: 'none' })).toEqual({ type: 'none' });
  });

});
