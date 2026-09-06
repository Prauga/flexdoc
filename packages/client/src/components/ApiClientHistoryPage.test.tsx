
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { ApiClientHistoryPage } from './ApiClientHistoryPage';
import { filterApiClientHistoryEntries, groupApiClientHistoryEntries } from '../utils/api-client-history';
import { createDefaultApiClientWorkspace } from '../utils/api-client-workspace';
import type { ApiClientWorkspaceState } from '../utils/api-client-workspace';

function workspaceFixture(): ApiClientWorkspaceState {
  const workspace = createDefaultApiClientWorkspace();
  return {
    ...workspace,
    history: [
      {
        id: 'history-new',
        collectionId: workspace.collections[0].id,
        request: { method: 'GET', url: '{{baseUrl}}/pets' },
        scripts: { preRequest: '', tests: "flex.test('ok', () => flex.expect(flex.response.code).to.equal(200));" },
        executedMethod: 'GET',
        resolvedUrl: 'https://api.example.test/pets',
        status: 200,
        statusText: 'OK',
        responseTime: 23,
        responseHeaders: [['content-type', 'application/json']],
        responseBody: '{"pets":[]}',
        scriptTests: [{ name: 'ok', passed: true }],
        runId: 'run-1', runName: 'My Collection', runIndex: 1, runTotal: 2, runPassed: true,
        createdAt: '2026-09-05T10:00:00.000Z',
      },
      {
        id: 'history-old',
        collectionId: workspace.collections[0].id,
        request: { method: 'POST', url: 'https://api.example.test/login' },
        executedMethod: 'POST',
        resolvedUrl: 'https://api.example.test/login',
        status: 500,
        statusText: 'Server Error',
        responseBody: 'boom',
        runId: 'run-1', runName: 'My Collection', runIndex: 2, runTotal: 2, runPassed: true, runCancelled: true,
        createdAt: '2026-09-05T09:00:00.000Z',
      },
    ],
  };
}

describe('ApiClientHistoryPage', () => {
  it('shows captured response details and opens an entry back in the client', () => {
    const onLoadRequest = jest.fn();
    const onBack = jest.fn();
    render(<ApiClientHistoryPage workspace={workspaceFixture()} onWorkspaceChange={jest.fn()} onLoadRequest={onLoadRequest} onBack={onBack} theme='light' initialEntryId='history-new' />);
    expect(screen.getByText('{"pets":[]}')).toBeInTheDocument();
    expect(screen.getByText('content-type')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Open in client/i }));
    expect(onLoadRequest).toHaveBeenCalledWith(expect.objectContaining({ method: 'GET', url: '{{baseUrl}}/pets' }), expect.objectContaining({ tests: expect.stringContaining("flex.test('ok'") }), expect.any(String), undefined);
    expect(onBack).toHaveBeenCalled();
  });

  it('filters by search text, collection metadata, run metadata, method, outcome, and tests', () => {
    const workspace = workspaceFixture();
    expect(filterApiClientHistoryEntries(workspace, { query: 'login', method: 'all', outcome: 'all' }).map((entry) => entry.id)).toEqual(['history-old']);
    expect(filterApiClientHistoryEntries(workspace, { query: 'My Collection', method: 'all', outcome: 'all' })).toHaveLength(2);
    expect(filterApiClientHistoryEntries(workspace, { query: '', method: 'GET', outcome: 'all' }).map((entry) => entry.id)).toEqual(['history-new']);
    expect(filterApiClientHistoryEntries(workspace, { query: '', method: 'all', outcome: 'failed' }).map((entry) => entry.id)).toEqual(['history-old']);
    expect(filterApiClientHistoryEntries(workspace, { query: '', method: 'all', outcome: 'success' }).map((entry) => entry.id)).toEqual(['history-new']);
    expect(filterApiClientHistoryEntries(workspace, { query: '', method: 'all', outcome: 'tests' }).map((entry) => entry.id)).toEqual(['history-new']);
    const deletedCollectionWorkspace = { ...workspace, collections: [] };
    expect(filterApiClientHistoryEntries(deletedCollectionWorkspace, { query: 'deleted collection', method: 'all', outcome: 'all' })).toHaveLength(2);
  });

  it('groups a collection run and preserves runner semantics separately from HTTP status', () => {
    const workspace = workspaceFixture();
    const blocks = groupApiClientHistoryEntries(workspace.history);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ kind: 'run', group: { runId: 'run-1', total: 2, captured: 2, passed: 2, failed: 0, cancelled: 0 } });
    render(<ApiClientHistoryPage workspace={workspace} onWorkspaceChange={jest.fn()} onLoadRequest={jest.fn()} onBack={jest.fn()} theme='light' initialRunId='run-1' />);
    expect(screen.getByText('2 / 2 history entries captured · 2 runner passed · 0 runner failed')).toBeInTheDocument();
    expect(screen.getByText(/Runner pass · HTTP 500/)).toBeInTheDocument();
  });
});
