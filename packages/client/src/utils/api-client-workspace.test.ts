import {
  cloneRequestDraft,
  createDefaultApiClientWorkspace,
  deleteApiClientCollection,
  deleteApiClientFolder,
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

  it('cascades collection contents while always keeping one collection', () => {
    const workspace = createDefaultApiClientWorkspace();
    const firstId = workspace.collections[0].id;
    const next = deleteApiClientCollection(workspace, firstId);

    expect(next.collections).toHaveLength(1);
    expect(next.collections[0].name).toBe('My Collection');
    expect(next.collections[0].id).not.toBe(firstId);
  });
});
