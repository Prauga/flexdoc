import React from 'react';
import { render, screen } from '@testing-library/react';
import { ApiClientRunnerPage } from './ApiClientRunnerPage';
import type { ApiClientWorkspaceState } from '../utils/api-client-workspace';

function fixture(): ApiClientWorkspaceState {
  const timestamp = '2026-09-06T00:00:00.000Z';
  return {
    version: 6,
    collections: [{ id: 'collection', name: 'Runner UI', auth: { type: 'none' }, variables: [], createdAt: timestamp, updatedAt: timestamp }],
    folders: [],
    requests: [
      { id: 'one', collectionId: 'collection', name: 'First', request: { method: 'GET', url: 'https://example.test/one' }, createdAt: timestamp, updatedAt: timestamp },
      { id: 'two', collectionId: 'collection', name: 'Second', request: { method: 'POST', url: 'https://example.test/two' }, createdAt: timestamp, updatedAt: timestamp },
    ],
    environments: [{ id: 'env', name: 'Local', variables: [], createdAt: timestamp, updatedAt: timestamp }],
    activeEnvironmentId: 'env',
    history: [],
  };
}

describe('ApiClientRunnerPage', () => {
  it('renders the exact saved-request execution order and runner configuration before a run', () => {
    const { container } = render(<ApiClientRunnerPage workspace={fixture()} onWorkspaceChange={jest.fn()} collectionId='collection' theme='light' onOpenHistory={jest.fn()} onBack={jest.fn()} fetcher={jest.fn()} />);
    const rows = Array.from(container.querySelectorAll('[data-runner-request-id]'));
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('First');
    expect(rows[0]).toHaveTextContent('GET');
    expect(rows[0]).toHaveTextContent('Pending');
    expect(rows[1]).toHaveTextContent('Second');
    expect(rows[1]).toHaveTextContent('POST');
    expect(rows[1]).toHaveTextContent('Pending');
    expect(screen.getByText(/Environment: Local/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start run' })).toBeEnabled();
    expect(screen.getByText(/Runner failure means transport\/script\/test failure/)).toBeInTheDocument();
  });
});
