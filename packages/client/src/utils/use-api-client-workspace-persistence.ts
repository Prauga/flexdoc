import { useEffect, useRef, useState } from 'react';
import { saveApiClientWorkspace } from './api-client-workspace';
import type { ApiClientWorkspaceState } from './api-client-workspace';

/**
 * Trailing debounce for workspace writes.
 *
 * Environment and collection editors pass `setWorkspace` straight through, so every keystroke
 * produced a new workspace object and an immediate persist: a full privacy snapshot plus an
 * IndexedDB structured clone of the whole workspace.
 */
const WORKSPACE_PERSIST_DEBOUNCE_MS = 300;

/**
 * Whether a workspace change is confined to the containers holding free-text variable editors.
 *
 * Only those edits are keystroke-driven and worth delaying. Everything else, including adding a
 * folder, saving a request and recording history, is a discrete action that may be followed
 * immediately by a reload, so it has to reach storage without waiting out the debounce.
 */
function isVariableOnlyChange(previous: ApiClientWorkspaceState, next: ApiClientWorkspaceState): boolean {
  return previous.requests === next.requests
    && previous.folders === next.folders
    && previous.history === next.history
    && previous.version === next.version
    && previous.activeEnvironmentId === next.activeEnvironmentId
    && previous.credentialStorage === next.credentialStorage
    && previous.historyBodies === next.historyBodies;
}

/**
 * Persist a workspace to IndexedDB and report write failures.
 *
 * Keystroke-driven variable edits are written on a trailing debounce; every other change is
 * written immediately so a reload straight after a discrete action cannot lose it. Pending
 * debounced writes are also flushed on unmount and on `pagehide`.
 *
 * @param persistenceKey Workspace persistence key, or `false` when persistence is disabled.
 * @param workspace Current workspace state.
 * @param enabled Whether the workspace has finished hydrating; writes are skipped until then.
 * @returns Whether the most recent write attempt failed, for example on `QuotaExceededError`.
 */
export function useApiClientWorkspacePersistence(
  persistenceKey: string | false,
  workspace: ApiClientWorkspaceState,
  enabled: boolean,
): boolean {
  const [failed, setFailed] = useState(false);
  const latest = useRef(workspace);
  const target = useRef(persistenceKey);
  const active = useRef(enabled);
  const unsaved = useRef(false);
  const persisted = useRef<ApiClientWorkspaceState | null>(null);

  // Kept current for the unmount/pagehide flush, which runs outside this render.
  useEffect(() => {
    latest.current = workspace;
    target.current = persistenceKey;
    active.current = enabled;
  });

  useEffect(() => {
    if (!enabled || persistenceKey === false) return;
    const write = () => {
      unsaved.current = false;
      void saveApiClientWorkspace(persistenceKey, workspace)
        .then(() => setFailed(false))
        .catch(() => setFailed(true));
    };

    const previous = persisted.current;
    persisted.current = workspace;
    if (previous && isVariableOnlyChange(previous, workspace)) {
      unsaved.current = true;
      const timer = setTimeout(write, WORKSPACE_PERSIST_DEBOUNCE_MS);
      return () => clearTimeout(timer);
    }
    write();
    return undefined;
  }, [enabled, persistenceKey, workspace]);

  useEffect(() => {
    const flush = () => {
      const key = target.current;
      if (!unsaved.current || !active.current || key === false) return;
      unsaved.current = false;
      void saveApiClientWorkspace(key, latest.current).catch(() => undefined);
    };
    if (typeof window !== 'undefined') window.addEventListener('pagehide', flush);
    return () => {
      if (typeof window !== 'undefined') window.removeEventListener('pagehide', flush);
      flush();
    };
  }, []);

  return failed;
}
