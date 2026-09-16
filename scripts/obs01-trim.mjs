import { readFileSync, writeFileSync } from 'node:fs';

function edit(path, transform) {
  const before = readFileSync(path, 'utf8');
  const after = transform(before);
  if (after === before) throw new Error(`No change applied to ${path}`);
  writeFileSync(path, after);
}
function once(source, from, to, label) {
  const index = source.indexOf(from);
  if (index < 0) throw new Error(`Missing ${label}`);
  if (source.indexOf(from, index + from.length) >= 0) throw new Error(`Ambiguous ${label}`);
  return source.slice(0, index) + to + source.slice(index + from.length);
}

edit('packages/client/src/utils/api-client-ui-preferences.ts', (source) => {
  source = once(source, "  historyBodies?: boolean;\n", '', 'UI privacy field');
  source = once(source, "    if (parsed.historyBodies !== undefined && typeof parsed.historyBodies !== 'boolean') return { version: 1 };\n", '', 'UI privacy validation');
  source = once(source, "      ...(typeof parsed.historyBodies === 'boolean' ? { historyBodies: parsed.historyBodies } : {}),\n", '', 'UI privacy readback');
  return source;
});

edit('packages/client/src/utils/api-client-ui-preferences.test.ts', (source) => {
  source = once(source, "    writeApiClientUiPreferences('workspace-a', { historyBodies: false }, storage);\n", '', 'UI privacy write test');
  source = once(source, "      historyBodies: false,\n", '', 'UI privacy expectation');
  return source;
});

edit('packages/client/src/utils/api-client-workspace.ts', (source) => {
  source = once(source,
    "  /** Currently active environment id, when one is selected. */ activeEnvironmentId?: string;\n  /** Most-recent-first execution history, capped by the workspace implementation. */ history: ApiClientHistoryEntry[];",
    "  /** Currently active environment id, when one is selected. */ activeEnvironmentId?: string;\n  /** Whether API-host request/response bodies may be persisted in history. Defaults to true. */ historyBodies?: boolean;\n  /** Most-recent-first execution history, capped by the workspace implementation. */ history: ApiClientHistoryEntry[];",
    'workspace privacy field');
  source = once(source,
    "    activeEnvironmentId,\n    history: historyValues,",
    "    activeEnvironmentId,\n    historyBodies: typeof value.historyBodies === 'boolean' ? value.historyBodies : undefined,\n    history: historyValues,",
    'workspace privacy normalization');
  return source;
});

edit('packages/client/src/utils/api-client-history-privacy.ts', (source) => {
  source = once(source,
    "export function createApiClientWorkspacePersistenceSnapshot(\n  workspace: ApiClientWorkspaceState,\n  historyBodies = true,\n): ApiClientWorkspaceState {",
    "export function createApiClientWorkspacePersistenceSnapshot(workspace: ApiClientWorkspaceState): ApiClientWorkspaceState {",
    'privacy snapshot signature');
  source = once(source,
    "      const omitBody = !historyBodies && entry.transport !== 'browser';",
    "      const omitBody = workspace.historyBodies === false && entry.transport !== 'browser';",
    'privacy workspace mode');
  return source;
});

edit('packages/client/src/components/ApiClientWorkspace.tsx', (source) => {
  source = once(source, "  const [historyBodies, setHistoryBodies] = useState(initialUiPreferences.historyBodies ?? true);\n", '', 'privacy React state');
  source = once(source,
    "    const preferences = readApiClientUiPreferences(persistenceKey);\n    let cancelled = false;\n    queueMicrotask(() => {\n      if (!cancelled) setHistoryBodies(preferences.historyBodies ?? true);\n    });\n    loadApiClientWorkspace(persistenceKey)",
    "    let cancelled = false;\n    loadApiClientWorkspace(persistenceKey)",
    'privacy preference hydration');
  source = once(source,
    "    const snapshot = createApiClientWorkspacePersistenceSnapshot(workspace, historyBodies);\n    void saveApiClientWorkspace(persistenceKey, snapshot).catch(() => undefined);\n  }, [hydrated, historyBodies, persistenceKey, workspace]);",
    "    const snapshot = createApiClientWorkspacePersistenceSnapshot(workspace);\n    void saveApiClientWorkspace(persistenceKey, snapshot).catch(() => undefined);\n  }, [hydrated, persistenceKey, workspace]);",
    'privacy persistence effect');
  source = once(source,
    "  const handleHistoryBodiesChange = (value: boolean) => {\n    setHistoryBodies(value);\n    if (persistenceKey !== false) writeApiClientUiPreferences(persistenceKey, { historyBodies: value });\n  };\n\n",
    '',
    'privacy preference handler');
  source = once(source,
    "          onViewAll={() => openHistory()}\n          historyBodies={historyBodies}\n          onHistoryBodiesChange={handleHistoryBodiesChange}\n          theme={activeTheme}",
    "          onViewAll={() => openHistory()}\n          theme={activeTheme}",
    'privacy history props');
  return source;
});

edit('packages/client/src/components/ApiClientHistory.tsx', (source) => {
  source = once(source,
    "  onViewAll?: () => void;\n  historyBodies: boolean;\n  onHistoryBodiesChange: (value: boolean) => void;\n  theme: 'light' | 'dark';",
    "  onViewAll?: () => void;\n  theme: 'light' | 'dark';",
    'privacy history prop types');
  source = once(source,
    "export const ApiClientHistory: React.FC<Props> = ({ workspace, onWorkspaceChange, onLoadRequest, onViewAll, historyBodies, onHistoryBodiesChange, theme }) => {",
    "export const ApiClientHistory: React.FC<Props> = ({ workspace, onWorkspaceChange, onLoadRequest, onViewAll, theme }) => {",
    'privacy history destructure');
  source = once(source,
    "      <input type='checkbox' checked={historyBodies} onChange={(event) => onHistoryBodiesChange(event.target.checked)} />",
    "      <input type='checkbox' checked={workspace.historyBodies !== false} onChange={(event) => onWorkspaceChange((current) => ({ ...current, historyBodies: event.target.checked }))} />",
    'privacy workspace toggle');
  return source;
});

edit('packages/client/src/utils/api-client-history-privacy.test.ts', (source) => {
  source = once(source,
    "import { addApiClientHistoryEntry, createDefaultApiClientWorkspace } from './api-client-workspace';",
    "import { addApiClientHistoryEntry, createDefaultApiClientWorkspace, normalizeApiClientWorkspace } from './api-client-workspace';",
    'privacy normalization import');
  source = source.replaceAll(
    'createApiClientWorkspacePersistenceSnapshot(workspace, false)',
    'createApiClientWorkspacePersistenceSnapshot({ ...workspace, historyBodies: false })',
  );
  source = once(source,
    "  it('always redacts sensitive request and response headers before persistence', () => {",
    "  it('persists the history-body privacy mode with workspace state', () => {\n    const workspace = normalizeApiClientWorkspace({ ...createDefaultApiClientWorkspace(), historyBodies: false });\n    expect(workspace.historyBodies).toBe(false);\n  });\n\n  it('always redacts sensitive request and response headers before persistence', () => {",
    'privacy workspace persistence test');
  return source;
});

console.log('Applied workspace-backed OBS-01 privacy mode.');
