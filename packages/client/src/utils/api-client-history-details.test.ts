import { addApiClientHistoryEntry, createDefaultApiClientWorkspace, normalizeApiClientWorkspace } from './api-client-workspace';

describe('api-client history response details', () => {
  it('persists response headers and body on history entries', () => {
    const workspace = addApiClientHistoryEntry(createDefaultApiClientWorkspace(), {
      request: { method: 'GET', url: 'https://api.example.test/pets' },
      executedMethod: 'GET',
      resolvedUrl: 'https://api.example.test/pets',
      status: 200,
      responseHeaders: [['content-type', 'application/json']],
      responseBody: '{"ok":true}',
    });

    expect(workspace.history[0]).toMatchObject({
      responseHeaders: [['content-type', 'application/json']],
      responseBody: '{"ok":true}',
    });
  });

  it('caps large response bodies and marks them as truncated', () => {
    const largeBody = 'x'.repeat((256 * 1024) + 17);
    const workspace = addApiClientHistoryEntry(createDefaultApiClientWorkspace(), {
      request: { method: 'GET', url: 'https://api.example.test/large' },
      executedMethod: 'GET',
      resolvedUrl: 'https://api.example.test/large',
      responseBody: largeBody,
    });

    expect(workspace.history[0].responseBody).toHaveLength(256 * 1024);
    expect(workspace.history[0].responseBodyTruncated).toBe(true);
  });

  it('normalizes response details from persisted v6 workspaces', () => {
    const base = createDefaultApiClientWorkspace();
    const normalized = normalizeApiClientWorkspace({
      ...base,
      history: [{
        id: 'history-1',
        request: { method: 'GET', url: 'https://api.example.test' },
        executedMethod: 'GET',
        resolvedUrl: 'https://api.example.test',
        responseHeaders: [['x-test', 'yes']],
        responseBody: 'hello',
        responseBodyTruncated: true,
        createdAt: '2026-09-05T10:00:00.000Z',
      }],
    });

    expect(normalized.history[0]).toMatchObject({
      responseHeaders: [['x-test', 'yes']],
      responseBody: 'hello',
      responseBodyTruncated: true,
    });
  });
});
