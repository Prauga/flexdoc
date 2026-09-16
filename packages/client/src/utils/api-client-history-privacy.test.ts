import { createApiClientWorkspacePersistenceSnapshot, isSensitiveApiClientHistoryHeader } from './api-client-history-privacy';
import { addApiClientHistoryEntry, createDefaultApiClientWorkspace, normalizeApiClientWorkspace } from './api-client-workspace';

function workspaceWithHistory(transport?: 'browser' | 'api-host') {
  return addApiClientHistoryEntry(createDefaultApiClientWorkspace(), {
    request: {
      method: 'POST',
      url: 'https://api.example.test/pets',
      headers: [
        { key: 'Authorization', value: 'Bearer secret' },
        { key: 'X-Trace-Id', value: 'trace-123' },
      ],
      bodyMode: 'graphql',
      body: '{"secret":"raw"}',
      urlencoded: [{ key: 'password', value: 'secret' }],
      formData: [{ key: 'note', value: 'secret' }],
      binary: { fileName: 'secret.bin', contentType: 'application/octet-stream' },
      graphql: { query: 'query Secret { secret }', variables: '{"token":"secret"}' },
    },
    scripts: { preRequest: '', tests: '' },
    executedMethod: 'POST',
    resolvedUrl: 'https://api.example.test/pets',
    status: 200,
    transport,
    responseHeaders: [
      ['Set-Cookie', 'sid=secret'],
      ['X-Request-Id', 'req-123'],
    ],
    responseBody: '{"token":"secret"}',
  });
}

describe('API Client history persistence privacy', () => {
  it('recognizes the sensitive header names used by request history', () => {
    expect(isSensitiveApiClientHistoryHeader('Authorization')).toBe(true);
    expect(isSensitiveApiClientHistoryHeader(' x-api-key ')).toBe(true);
    expect(isSensitiveApiClientHistoryHeader('X-Amz-Security-Token')).toBe(true);
    expect(isSensitiveApiClientHistoryHeader('X-Trace-Id')).toBe(false);
  });

  it('persists the history-body privacy mode with workspace state', () => {
    const workspace = normalizeApiClientWorkspace({ ...createDefaultApiClientWorkspace(), historyBodies: false });
    expect(workspace.historyBodies).toBe(false);
  });

  it('always redacts sensitive request and response headers before persistence', () => {
    const workspace = workspaceWithHistory();
    const snapshot = createApiClientWorkspacePersistenceSnapshot(workspace);
    expect(snapshot.history[0].request.headers).toEqual([
      { key: 'Authorization', value: '[REDACTED]' },
      { key: 'X-Trace-Id', value: 'trace-123' },
    ]);
    expect(snapshot.history[0].responseHeaders).toEqual([
      ['Set-Cookie', '[REDACTED]'],
      ['X-Request-Id', 'req-123'],
    ]);
    expect(workspace.history[0].request.headers?.[0].value).toBe('Bearer secret');
    expect(workspace.history[0].responseHeaders?.[0][1]).toBe('sid=secret');
  });

  it('omits API-host request and response bodies without mutating live history', () => {
    const workspace = workspaceWithHistory('api-host');
    const snapshot = createApiClientWorkspacePersistenceSnapshot({ ...workspace, historyBodies: false });
    const persisted = snapshot.history[0];
    expect(persisted.request.body).toBeUndefined();
    expect(persisted.request.urlencoded).toBeUndefined();
    expect(persisted.request.formData).toBeUndefined();
    expect(persisted.request.binary).toBeUndefined();
    expect(persisted.request.graphql).toBeUndefined();
    expect(persisted.responseBody).toBeUndefined();
    expect(workspace.history[0].request.graphql?.query).toContain('Secret');
    expect(workspace.history[0].responseBody).toContain('secret');
  });

  it('preserves positively identified browser bodies in privacy mode', () => {
    const workspace = workspaceWithHistory('browser');
    const snapshot = createApiClientWorkspacePersistenceSnapshot({ ...workspace, historyBodies: false });
    expect(snapshot.history[0].request.graphql?.query).toContain('Secret');
    expect(snapshot.history[0].responseBody).toContain('secret');
  });

  it('treats legacy entries with unknown transport as private when the mode is enabled', () => {
    const workspace = workspaceWithHistory();
    const snapshot = createApiClientWorkspacePersistenceSnapshot({ ...workspace, historyBodies: false });
    expect(snapshot.history[0].request.body).toBeUndefined();
    expect(snapshot.history[0].responseBody).toBeUndefined();
  });
});
