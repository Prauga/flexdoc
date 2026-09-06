import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { ApiClientHistoryPage } from './ApiClientHistoryPage';
import { filterApiClientHistoryEntries } from '../utils/api-client-history';
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
        createdAt: '2026-09-05T10:00:00.000Z',
      },
      {
        id: 'history-old',
        request: { method: 'POST', url: 'https://api.example.test/login' },
        executedMethod: 'POST',
        resolvedUrl: 'https://api.example.test/login',
        status: 500,
        statusText: 'Server Error',
        responseBody: 'boom',
        createdAt: '2026-09-05T09:00:00.000Z',
      },
    ],
  };
}

describe('ApiClientHistoryPage', () => {
  it('shows captured response details and opens an entry back in the client', () => {
    const onLoadRequest = jest.fn();
    const onBack = jest.fn();
    render(<ApiClientHistoryPage workspace={workspaceFixture()} onWorkspaceChange={jest.fn()} onLoadRequest={onLoadRequest} onBack={onBack} theme='light' />);

    expect(screen.getByText('{"pets":[]}')).toBeInTheDocument();
    expect(screen.getByText('content-type')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Open in client/i }));
    expect(onLoadRequest).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'GET', url: '{{baseUrl}}/pets' }),
      expect.objectContaining({ tests: expect.stringContaining("flex.test('ok'") }),
      expect.any(String),
      undefined,
    );
    expect(onBack).toHaveBeenCalled();
  });

  it('filters by search text, collection metadata, method, outcome, and tests', () => {
    const workspace = workspaceFixture();

    expect(filterApiClientHistoryEntries(workspace, { query: 'login', method: 'all', outcome: 'all' }).map((entry) => entry.id)).toEqual(['history-old']);
    expect(filterApiClientHistoryEntries(workspace, { query: 'My Collection', method: 'all', outcome: 'all' }).map((entry) => entry.id)).toEqual(['history-new']);
    expect(filterApiClientHistoryEntries(workspace, { query: '', method: 'GET', outcome: 'all' }).map((entry) => entry.id)).toEqual(['history-new']);
    expect(filterApiClientHistoryEntries(workspace, { query: '', method: 'all', outcome: 'failed' }).map((entry) => entry.id)).toEqual(['history-old']);
    expect(filterApiClientHistoryEntries(workspace, { query: '', method: 'all', outcome: 'success' }).map((entry) => entry.id)).toEqual(['history-new']);
    expect(filterApiClientHistoryEntries(workspace, { query: '', method: 'all', outcome: 'tests' }).map((entry) => entry.id)).toEqual(['history-new']);

    const deletedCollectionWorkspace = { ...workspace, collections: [] };
    expect(filterApiClientHistoryEntries(deletedCollectionWorkspace, { query: 'deleted collection', method: 'all', outcome: 'all' }).map((entry) => entry.id)).toEqual(['history-new']);
  });
});
