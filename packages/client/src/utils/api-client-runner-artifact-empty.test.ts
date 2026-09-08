import { exportApiClientRunnerArtifact, parseApiClientRunnerArtifact } from './api-client-runner-artifact';
import type { ApiClientWorkspaceState } from './api-client-workspace';

const timestamp = '2026-09-08T00:00:00.000Z';

function emptyWorkspace(): ApiClientWorkspaceState {
  return {
    version: 6,
    collections: [{
      id: 'collection-1',
      name: 'Empty',
      auth: { type: 'none' },
      variables: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    }],
    folders: [],
    requests: [],
    environments: [],
    history: [],
  };
}

describe('FlexDoc Runner empty scopes', () => {
  it('rejects programmatic exports with no executable requests', () => {
    expect(() => exportApiClientRunnerArtifact(
      emptyWorkspace(),
      { type: 'collection', collectionId: 'collection-1' },
    )).toThrow('contains no executable saved requests');
  });

  it('rejects hand-authored empty artifacts before CI can report 0/0 pass', () => {
    expect(() => parseApiClientRunnerArtifact({
      kind: 'flexdoc-runner',
      version: 1,
      exportedAt: '2026-09-08T12:00:00.000Z',
      scope: { type: 'collection', collectionId: 'collection-1' },
      workspace: emptyWorkspace(),
    })).toThrow('contains no executable saved requests');
  });
});
