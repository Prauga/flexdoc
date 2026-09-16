import { readFileSync, writeFileSync } from 'node:fs';

function edit(path, transform) {
  const before = readFileSync(path, 'utf8');
  const after = transform(before);
  if (after === before) throw new Error(`No change applied to ${path}`);
  writeFileSync(path, after);
}

function replaceOnce(source, from, to, label) {
  const index = source.indexOf(from);
  if (index < 0) throw new Error(`Missing ${label}`);
  if (source.indexOf(from, index + from.length) >= 0) throw new Error(`Ambiguous ${label}`);
  return source.slice(0, index) + to + source.slice(index + from.length);
}

edit('packages/client/src/utils/api-client-ui-preferences.ts', (source) => {
  source = replaceOnce(source, "  persistHostHistoryBodies?: boolean;\n  historyTransports?: Record<string, 'browser' | 'api-host'>;\n", "  persistHostHistoryBodies?: boolean;\n", 'UI preference transport field');
  source = replaceOnce(source, "function historyTransports(value: unknown): Record<string, 'browser' | 'api-host'> | undefined {\n  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;\n  const entries = Object.entries(value as Record<string, unknown>);\n  if (!entries.every(([key, transport]) => key.length > 0 && (transport === 'browser' || transport === 'api-host'))) return undefined;\n  return Object.fromEntries(entries) as Record<string, 'browser' | 'api-host'>;\n}\n\n", '', 'UI preference transport validator');
  source = replaceOnce(source, "    const parsedHistoryTransports = parsed.historyTransports === undefined ? undefined : historyTransports(parsed.historyTransports);\n    if (parsed.historyTransports !== undefined && !parsedHistoryTransports) return { version: 1 };\n", '', 'UI preference transport parsing');
  source = replaceOnce(source, "      ...(typeof parsed.persistHostHistoryBodies === 'boolean' ? { persistHostHistoryBodies: parsed.persistHostHistoryBodies } : {}),\n      ...(parsedHistoryTransports ? { historyTransports: parsedHistoryTransports } : {}),\n", "      ...(typeof parsed.persistHostHistoryBodies === 'boolean' ? { persistHostHistoryBodies: parsed.persistHostHistoryBodies } : {}),\n", 'UI preference transport result');
  return source;
});

edit('packages/client/src/utils/api-client-ui-preferences.test.ts', (source) => {
  source = replaceOnce(source, "    writeApiClientUiPreferences('workspace-a', { persistHostHistoryBodies: false }, storage);\n    writeApiClientUiPreferences('workspace-a', { historyTransports: { 'history-1': 'api-host', 'history-2': 'browser' } }, storage);\n", "    writeApiClientUiPreferences('workspace-a', { persistHostHistoryBodies: false }, storage);\n", 'UI preference transport write test');
  source = replaceOnce(source, "      persistHostHistoryBodies: false,\n      historyTransports: { 'history-1': 'api-host', 'history-2': 'browser' },\n", "      persistHostHistoryBodies: false,\n", 'UI preference transport expectation');
  source = replaceOnce(source, "\n    storage.setItem('flexdoc:api-client-ui:bad', JSON.stringify({ version: 1, historyTransports: { 'history-1': 'unknown' } }));\n    expect(readApiClientUiPreferences('bad', storage)).toEqual({ version: 1 });\n", '', 'UI preference malformed transport test');
  return source;
});

edit('packages/client/src/utils/api-client-workspace.ts', (source) => {
  source = replaceOnce(source, "  /** Measured response time in milliseconds. */ responseTime?: number;\n  /** Ordered response headers retained in history. */", "  /** Measured response time in milliseconds. */ responseTime?: number;\n  /** Actual transport used for the execution when known. */ transport?: 'browser' | 'api-host';\n  /** Ordered response headers retained in history. */", 'history entry transport type');
  source = replaceOnce(source, "  /** Measured response time in milliseconds. */ responseTime?: number;\n  /** Ordered response headers to retain. */", "  /** Measured response time in milliseconds. */ responseTime?: number;\n  /** Actual transport used for the execution when known. */ transport?: 'browser' | 'api-host';\n  /** Ordered response headers to retain. */", 'history input transport type');
  source = replaceOnce(source, "    responseTime: value.responseTime as number | undefined,\n    responseHeaders:", "    responseTime: value.responseTime as number | undefined,\n    transport: value.transport === 'browser' || value.transport === 'api-host' ? value.transport : undefined,\n    responseHeaders:", 'normalized history transport');
  source = replaceOnce(source, "    responseTime: input.responseTime,\n    ...(input.responseHeaders?.length", "    responseTime: input.responseTime,\n    transport: input.transport,\n    ...(input.responseHeaders?.length", 'history transport persistence');
  return source;
});

edit('packages/client/src/components/ApiClientWorkspace.tsx', (source) => {
  source = replaceOnce(source, "import type { ApiClientTransport } from '../utils/api-client-execution';\n", '', 'workspace transport type import');
  source = replaceOnce(source, "  const initialUiPreferences = persistenceKey === false ? { version: 1 as const } : readApiClientUiPreferences(persistenceKey);\n  const initialHistoryTransports = Object.entries(initialUiPreferences.historyTransports || {}) as Array<[string, ApiClientTransport]>;\n", "  const initialUiPreferences = persistenceKey === false ? { version: 1 as const } : readApiClientUiPreferences(persistenceKey);\n", 'workspace initial transport map');
  source = replaceOnce(source, "  const executionFolderIdRef = useRef<string | undefined>(undefined);\n  const historyTransportByIdRef = useRef(new Map<string, ApiClientTransport>(initialHistoryTransports));\n", "  const executionFolderIdRef = useRef<string | undefined>(undefined);\n", 'workspace transport ref');
  source = replaceOnce(source, "    const preferences = readApiClientUiPreferences(persistenceKey);\n    historyTransportByIdRef.current = new Map(Object.entries(preferences.historyTransports || {}) as Array<[string, ApiClientTransport]>);\n", "    const preferences = readApiClientUiPreferences(persistenceKey);\n", 'workspace transport reload');
  source = replaceOnce(source, "    const historyIds = new Set(workspace.history.map((entry) => entry.id));\n    const transports = new Map(\n      [...historyTransportByIdRef.current].filter(([historyId]) => historyIds.has(historyId)),\n    );\n    historyTransportByIdRef.current = transports;\n    writeApiClientUiPreferences(persistenceKey, { historyTransports: Object.fromEntries(transports) });\n    const snapshot = createApiClientWorkspacePersistenceSnapshot(workspace, {\n      persistHostHistoryBodies,\n      transportByHistoryId: transports,\n    });\n", "    const snapshot = createApiClientWorkspacePersistenceSnapshot(workspace, { persistHostHistoryBodies });\n", 'workspace persistence transport map');
  source = replaceOnce(source, "  const handleExecutionComplete = (result: ApiClientExecutionResult) => {\n    setWorkspace((current) => {\n      const next = addApiClientHistoryEntry(current, { ...result, collectionId: executionCollectionIdRef.current, folderId: executionFolderIdRef.current });\n      const historyId = next.history[0]?.id;\n      if (historyId && result.transport) historyTransportByIdRef.current.set(historyId, result.transport);\n      return next;\n    });\n    onExecutionComplete?.(result);\n  };\n", "  const handleExecutionComplete = (result: ApiClientExecutionResult) => {\n    setWorkspace((current) => addApiClientHistoryEntry(current, { ...result, collectionId: executionCollectionIdRef.current, folderId: executionFolderIdRef.current }));\n    onExecutionComplete?.(result);\n  };\n", 'workspace execution history transport map');
  source = replaceOnce(source, "      onEnvironmentChanges={onEnvironmentChanges}\n      onHistoryTransport={(entryId, transport) => historyTransportByIdRef.current.set(entryId, transport)}\n      onOpenHistory={openHistory}\n", "      onEnvironmentChanges={onEnvironmentChanges}\n      onOpenHistory={openHistory}\n", 'runner transport callback');
  return source;
});

edit('packages/client/src/components/ApiClientRunnerPage.tsx', (source) => {
  source = replaceOnce(source, "import type { ApiClientTransport, ExecuteApiClientRequestOptions } from '../utils/api-client-execution';", "import type { ExecuteApiClientRequestOptions } from '../utils/api-client-execution';", 'runner transport import');
  source = replaceOnce(source, "  onEnvironmentChanges?: (changes: ApiClientScriptEnvironmentChange[]) => void;\n  onHistoryTransport?: (entryId: string, transport: ApiClientTransport) => void;\n  onOpenHistory:", "  onEnvironmentChanges?: (changes: ApiClientScriptEnvironmentChange[]) => void;\n  onOpenHistory:", 'runner transport prop');
  source = replaceOnce(source, "  onEnvironmentChanges,\n  onHistoryTransport,\n  onOpenHistory,", "  onEnvironmentChanges,\n  onOpenHistory,", 'runner transport destructuring');
  source = replaceOnce(source, "    for (const item of result.items) {\n      const transport = item.outcome.result?.transport;\n      if (item.historyEntryId && transport) onHistoryTransport?.(item.historyEntryId, transport);\n    }\n    onWorkspaceChange(result.workspace);", "    onWorkspaceChange(result.workspace);", 'runner transport callback loop');
  return source;
});

edit('packages/client/src/utils/api-client-history-privacy.ts', (source) => {
  source = replaceOnce(source, "import type { ApiClientTransport } from './api-client-execution';\n", '', 'privacy transport import');
  source = replaceOnce(source, "  /** Keep API-host request/response bodies in IndexedDB. Defaults to true. */\n  persistHostHistoryBodies?: boolean;\n  /** Exact transport observed for history entries created in the current session. */\n  transportByHistoryId?: ReadonlyMap<string, ApiClientTransport>;\n", "  /** Keep API-host request/response bodies in IndexedDB. Defaults to true. */\n  persistHostHistoryBodies?: boolean;\n", 'privacy transport map option');
  source = replaceOnce(source, "      const transport = options.transportByHistoryId?.get(entry.id);\n      const omitBody = !persistHostBodies && transport !== 'browser';\n", "      const omitBody = !persistHostBodies && entry.transport !== 'browser';\n", 'privacy history transport lookup');
  return source;
});

edit('packages/client/src/utils/api-client-history-privacy.test.ts', (source) => {
  source = replaceOnce(source, 'function workspaceWithHistory() {', "function workspaceWithHistory(transport?: 'browser' | 'api-host') {", 'privacy test helper transport');
  source = replaceOnce(source, "    status: 200,\n    responseHeaders:", "    status: 200,\n    transport,\n    responseHeaders:", 'privacy test history transport');
  source = replaceOnce(source, "    const workspace = workspaceWithHistory();\n    const id = workspace.history[0].id;\n    const snapshot = createApiClientWorkspacePersistenceSnapshot(workspace, {\n      persistHostHistoryBodies: false,\n      transportByHistoryId: new Map([[id, 'api-host']]),\n    });", "    const workspace = workspaceWithHistory('api-host');\n    const snapshot = createApiClientWorkspacePersistenceSnapshot(workspace, { persistHostHistoryBodies: false });", 'privacy host-body test');
  source = replaceOnce(source, "    const workspace = workspaceWithHistory();\n    const id = workspace.history[0].id;\n    const snapshot = createApiClientWorkspacePersistenceSnapshot(workspace, {\n      persistHostHistoryBodies: false,\n      transportByHistoryId: new Map([[id, 'browser']]),\n    });", "    const workspace = workspaceWithHistory('browser');\n    const snapshot = createApiClientWorkspacePersistenceSnapshot(workspace, { persistHostHistoryBodies: false });", 'privacy browser-body test');
  return source;
});

console.log('Applied OBS-01 transport persistence simplification.');
