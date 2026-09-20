// The repo-wide react manual mock runs effects during render and returns inert
// state setters, which cannot express debounced effects or state updates.
jest.unmock('react');

import { act, render } from '@testing-library/react';
import { useApiClientWorkspacePersistence } from './use-api-client-workspace-persistence';
import { createDefaultApiClientWorkspace, saveApiClientWorkspace } from './api-client-workspace';
import type { ApiClientWorkspaceState } from './api-client-workspace';

jest.mock('./api-client-workspace', () => ({
  ...jest.requireActual('./api-client-workspace'),
  saveApiClientWorkspace: jest.fn(() => Promise.resolve()),
}));

const save = saveApiClientWorkspace as jest.MockedFunction<typeof saveApiClientWorkspace>;

function Harness({ workspace, hydrated = true }: { workspace: ApiClientWorkspaceState; hydrated?: boolean }) {
  const failed = useApiClientWorkspacePersistence('key', workspace, hydrated);
  return <span data-testid='state'>{failed ? 'failed' : 'ok'}</span>;
}

/** An environment-variable keystroke: only the environments container is replaced. */
function withVariable(workspace: ApiClientWorkspaceState, value: string): ApiClientWorkspaceState {
  return { ...workspace, environments: [{ id: 'env', name: 'Local', variables: [{ key: 'host', value }] }] };
}

describe('useApiClientWorkspacePersistence', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    save.mockReset();
    save.mockResolvedValue(undefined);
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('skips persistence until the workspace has hydrated', () => {
    render(<Harness workspace={createDefaultApiClientWorkspace()} hydrated={false} />);
    act(() => { jest.advanceTimersByTime(1000); });
    expect(save).not.toHaveBeenCalled();
  });

  it('coalesces a burst of variable keystrokes into one write', () => {
    const base = createDefaultApiClientWorkspace();
    const { rerender } = render(<Harness workspace={base} />);
    save.mockClear();

    for (let i = 0; i < 10; i += 1) {
      rerender(<Harness workspace={withVariable(base, `value-${i}`)} />);
      act(() => { jest.advanceTimersByTime(20); });
    }
    expect(save).not.toHaveBeenCalled();

    act(() => { jest.advanceTimersByTime(300); });
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][1].environments[0].variables[0].value).toBe('value-9');
  });

  it('writes structural changes immediately so a reload cannot lose them', () => {
    // Adding a folder or saving a request may be followed straight away by a reload.
    const base = createDefaultApiClientWorkspace();
    const { rerender } = render(<Harness workspace={base} />);
    save.mockClear();

    rerender(<Harness workspace={{ ...base, folders: [{ id: 'f1', collectionId: base.collections[0].id, name: 'Pets' }] }} />);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('writes the hydrated workspace without waiting for the debounce', () => {
    render(<Harness workspace={createDefaultApiClientWorkspace()} />);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('flushes a pending variable edit on unmount', () => {
    const base = createDefaultApiClientWorkspace();
    const { rerender, unmount } = render(<Harness workspace={base} />);
    rerender(<Harness workspace={withVariable(base, 'pending')} />);
    save.mockClear();

    unmount();
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][1].environments[0].variables[0].value).toBe('pending');
  });

  it('reports a failed write so the caller can warn', async () => {
    save.mockRejectedValueOnce(new Error('QuotaExceededError'));
    const { getByTestId } = render(<Harness workspace={createDefaultApiClientWorkspace()} />);

    await act(async () => { jest.advanceTimersByTime(300); });
    expect(getByTestId('state')).toHaveTextContent('failed');
  });

  it('clears the failure flag once a write succeeds', async () => {
    const base = createDefaultApiClientWorkspace();
    save.mockRejectedValueOnce(new Error('QuotaExceededError'));
    const { getByTestId, rerender } = render(<Harness workspace={base} />);
    await act(async () => { jest.advanceTimersByTime(300); });
    expect(getByTestId('state')).toHaveTextContent('failed');

    rerender(<Harness workspace={withVariable(base, 'ok')} />);
    await act(async () => { jest.advanceTimersByTime(300); });
    expect(getByTestId('state')).toHaveTextContent('ok');
  });
});
