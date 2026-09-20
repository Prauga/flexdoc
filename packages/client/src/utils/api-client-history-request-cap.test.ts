import { addApiClientHistoryEntry, createDefaultApiClientWorkspace, normalizeApiClientWorkspace } from './api-client-workspace';
import { createApiClientWorkspacePersistenceSnapshot } from './api-client-history-privacy';
import type { HttpRequestDraft } from './http-client';

const LIMIT = 256 * 1024;

function historyFor(request: Partial<HttpRequestDraft>) {
  const workspace = addApiClientHistoryEntry(createDefaultApiClientWorkspace(), {
    request: { method: 'POST', url: 'https://api.example.test/pets', ...request } as HttpRequestDraft,
    executedMethod: 'POST',
    resolvedUrl: 'https://api.example.test/pets',
    status: 200,
  });
  return workspace.history[0];
}

describe('history request body cap', () => {
  it('keeps bodies under the cap untouched', () => {
    const entry = historyFor({ body: 'x'.repeat(1024) });
    expect(entry.request.body).toHaveLength(1024);
    expect(entry.requestBodyTruncated).toBeUndefined();
  });

  it('truncates an oversized raw body and marks it', () => {
    const entry = historyFor({ body: 'x'.repeat(LIMIT + 5000) });
    expect(entry.request.body).toHaveLength(LIMIT);
    expect(entry.requestBodyTruncated).toBe(true);
  });

  it('shares one budget across every body field', () => {
    // Host execution accepts 32 MiB envelopes, so a per-field cap would still let a single
    // entry persist several times the intended ceiling.
    const entry = historyFor({
      body: 'a'.repeat(LIMIT),
      graphql: { query: 'b'.repeat(LIMIT), variables: 'c'.repeat(LIMIT) },
      urlencoded: [{ key: 'd', value: 'd'.repeat(LIMIT) }],
      formData: [{ key: 'e', value: 'e'.repeat(LIMIT) }],
    });

    const persisted = (entry.request.body?.length || 0)
      + (entry.request.graphql?.query.length || 0)
      + (entry.request.graphql?.variables.length || 0)
      + (entry.request.urlencoded?.[0].value.length || 0)
      + (entry.request.formData?.[0].value.length || 0);

    expect(persisted).toBe(LIMIT);
    expect(entry.requestBodyTruncated).toBe(true);
  });

  it('round-trips the truncation marker through normalization', () => {
    const workspace = addApiClientHistoryEntry(createDefaultApiClientWorkspace(), {
      request: { method: 'POST', url: 'https://api.example.test/pets', body: 'x'.repeat(LIMIT + 1) } as HttpRequestDraft,
      executedMethod: 'POST',
      resolvedUrl: 'https://api.example.test/pets',
      status: 200,
    });
    const restored = normalizeApiClientWorkspace(JSON.parse(JSON.stringify(workspace)));
    expect(restored.history[0].requestBodyTruncated).toBe(true);
  });

  it('drops the marker when the snapshot omits bodies', () => {
    const workspace = addApiClientHistoryEntry(
      { ...createDefaultApiClientWorkspace(), historyBodies: false },
      {
        request: { method: 'POST', url: 'https://api.example.test/pets', body: 'x'.repeat(LIMIT + 1) } as HttpRequestDraft,
        executedMethod: 'POST',
        resolvedUrl: 'https://api.example.test/pets',
        status: 200,
        transport: 'api-host',
      },
    );
    const snapshot = createApiClientWorkspacePersistenceSnapshot(workspace);
    expect(snapshot.history[0].request.body).toBeUndefined();
    expect(snapshot.history[0].requestBodyTruncated).toBeUndefined();
  });
});

describe('persistence snapshot history reuse', () => {
  it('reuses redacted history while the history array is unchanged', () => {
    const workspace = addApiClientHistoryEntry(createDefaultApiClientWorkspace(), {
      request: { method: 'GET', url: 'https://api.example.test/pets?token=secret' } as HttpRequestDraft,
      executedMethod: 'GET',
      resolvedUrl: 'https://api.example.test/pets?token=secret',
      status: 200,
    });

    const first = createApiClientWorkspacePersistenceSnapshot(workspace);
    // An environment edit replaces the workspace object but keeps the history array.
    const edited = { ...workspace, environments: [{ id: 'env', name: 'Local', variables: [{ key: 'host', value: 'x' }] }] };
    const second = createApiClientWorkspacePersistenceSnapshot(edited);

    expect(second.history).toBe(first.history);
  });

  it('recomputes when history changes', () => {
    const workspace = addApiClientHistoryEntry(createDefaultApiClientWorkspace(), {
      request: { method: 'GET', url: 'https://api.example.test/pets' } as HttpRequestDraft,
      executedMethod: 'GET',
      resolvedUrl: 'https://api.example.test/pets',
      status: 200,
    });
    const first = createApiClientWorkspacePersistenceSnapshot(workspace);
    const withMore = addApiClientHistoryEntry(workspace, {
      request: { method: 'GET', url: 'https://api.example.test/tags' } as HttpRequestDraft,
      executedMethod: 'GET',
      resolvedUrl: 'https://api.example.test/tags',
      status: 200,
    });

    const second = createApiClientWorkspacePersistenceSnapshot(withMore);
    expect(second.history).not.toBe(first.history);
    expect(second.history).toHaveLength(2);
  });

  it('recomputes when the body-persistence setting changes', () => {
    const workspace = addApiClientHistoryEntry(createDefaultApiClientWorkspace(), {
      request: { method: 'POST', url: 'https://api.example.test/pets', body: '{"a":1}' } as HttpRequestDraft,
      executedMethod: 'POST',
      resolvedUrl: 'https://api.example.test/pets',
      status: 200,
      transport: 'api-host',
    });

    expect(createApiClientWorkspacePersistenceSnapshot(workspace).history[0].request.body).toBe('{"a":1}');
    expect(createApiClientWorkspacePersistenceSnapshot({ ...workspace, historyBodies: false }).history[0].request.body).toBeUndefined();
  });
});
