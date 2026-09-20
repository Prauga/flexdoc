import { exportApiClientRunnerArtifact } from './api-client-runner-artifact';
import { createDefaultApiClientWorkspace } from './api-client-workspace';

function workspaceWithCredentials() {
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

describe('Runner artifact credential scope', () => {
  it.each(['session', 'never'] as const)('does not export %s credentials', (credentialStorage) => {
    const workspace = workspaceWithCredentials();
    workspace.credentialStorage = credentialStorage;
    const artifact = exportApiClientRunnerArtifact(workspace, { type: 'collection', collectionId: workspace.collections[0].id }, { exportedAt: '2026-01-01T00:00:00.000Z' });
    expect((artifact.workspace.collections[0].auth as { token: string }).token).toBe('');
    expect((artifact.workspace.requests[0].request.auth as { password: string }).password).toBe('');
    expect(artifact.workspace.credentialStorage).toBeUndefined();
  });

  it('keeps explicitly remembered credentials in exports', () => {
    const workspace = workspaceWithCredentials();
    workspace.credentialStorage = 'remember';
    const artifact = exportApiClientRunnerArtifact(workspace, { type: 'collection', collectionId: workspace.collections[0].id }, { exportedAt: '2026-01-01T00:00:00.000Z' });
    expect((artifact.workspace.collections[0].auth as { token: string }).token).toBe('collection-secret');
    expect((artifact.workspace.requests[0].request.auth as { password: string }).password).toBe('request-secret');
  });
});
