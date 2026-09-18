import { createApiClientWorkspacePersistenceSnapshot } from './api-client-history-privacy';
import {
  createDefaultApiClientWorkspace,
  restoreApiClientSessionCredentials,
  syncApiClientSessionCredentials,
} from './api-client-workspace';

const KEY = 'credential-scope-test';

function credentialWorkspace() {
  const workspace = createDefaultApiClientWorkspace();
  const collection = workspace.collections[0];
  collection.auth = { type: 'bearer', token: 'collection-secret' };
  workspace.requests.push({
    id: 'request-1',
    collectionId: collection.id,
    name: 'Saved',
    request: { method: 'GET', url: 'https://api.example.test', auth: { type: 'basic', username: 'alice', password: 'request-secret' } },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });
  return workspace;
}

describe('API Client credential scope persistence', () => {
  beforeEach(() => sessionStorage.clear());

  it('defaults new workspaces to session-only while legacy normalized workspaces keep remember semantics', () => {
    const created = createDefaultApiClientWorkspace();
    expect(created.credentialStorage).toBe('session');
  });

  it('keeps session-only credentials out of IndexedDB snapshots and restores them from the tab vault', () => {
    const workspace = credentialWorkspace();
    workspace.credentialStorage = 'session';
    syncApiClientSessionCredentials(KEY, workspace);
    const persisted = createApiClientWorkspacePersistenceSnapshot(workspace);
    expect((persisted.collections[0].auth as { token: string }).token).toBe('');
    expect((persisted.requests[0].request.auth as { password: string }).password).toBe('');
    const restored = restoreApiClientSessionCredentials(KEY, persisted);
    expect((restored.collections[0].auth as { token: string }).token).toBe('collection-secret');
    expect((restored.requests[0].request.auth as { password: string }).password).toBe('request-secret');
  });

  it('never-store clears an existing tab vault and strips persisted credentials', () => {
    const workspace = credentialWorkspace();
    workspace.credentialStorage = 'session';
    syncApiClientSessionCredentials(KEY, workspace);
    workspace.credentialStorage = 'never';
    syncApiClientSessionCredentials(KEY, workspace);
    const persisted = createApiClientWorkspacePersistenceSnapshot(workspace);
    const restored = restoreApiClientSessionCredentials(KEY, persisted);
    expect((restored.collections[0].auth as { token: string }).token).toBe('');
  });

  it('remember preserves credential values in the browser workspace snapshot', () => {
    const workspace = credentialWorkspace();
    workspace.credentialStorage = 'remember';
    const persisted = createApiClientWorkspacePersistenceSnapshot(workspace);
    expect((persisted.collections[0].auth as { token: string }).token).toBe('collection-secret');
    expect((persisted.requests[0].request.auth as { password: string }).password).toBe('request-secret');
  });
});
