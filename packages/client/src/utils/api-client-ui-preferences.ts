export interface ApiClientUiPreferences {
  version: 1;
  sidebarCollapsed?: boolean;
  requestTab?: 'params' | 'headers' | 'authorization' | 'body' | 'scripts';
  scriptTab?: 'pre-request' | 'tests';
  theme?: 'light' | 'dark';
}

function keyForWorkspace(persistenceKey: string): string {
  return `flexdoc:api-client-ui:${encodeURIComponent(persistenceKey)}`;
}

export function readApiClientUiPreferences(persistenceKey: string, storage?: Storage): ApiClientUiPreferences {
  const resolvedStorage = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
  if (!resolvedStorage) return { version: 1 };
  try {
    const raw = resolvedStorage.getItem(keyForWorkspace(persistenceKey));
    if (!raw) return { version: 1 };
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed.version !== 1) return { version: 1 };
    const requestTabs = new Set(['params', 'headers', 'authorization', 'body', 'scripts']);
    const scriptTabs = new Set(['pre-request', 'tests']);
    const themes = new Set(['light', 'dark']);
    if (parsed.sidebarCollapsed !== undefined && typeof parsed.sidebarCollapsed !== 'boolean') return { version: 1 };
    if (parsed.requestTab !== undefined && (typeof parsed.requestTab !== 'string' || !requestTabs.has(parsed.requestTab))) return { version: 1 };
    if (parsed.scriptTab !== undefined && (typeof parsed.scriptTab !== 'string' || !scriptTabs.has(parsed.scriptTab))) return { version: 1 };
    if (parsed.theme !== undefined && (typeof parsed.theme !== 'string' || !themes.has(parsed.theme))) return { version: 1 };
    return {
      version: 1,
      ...(typeof parsed.sidebarCollapsed === 'boolean' ? { sidebarCollapsed: parsed.sidebarCollapsed } : {}),
      ...(typeof parsed.requestTab === 'string' ? { requestTab: parsed.requestTab as ApiClientUiPreferences['requestTab'] } : {}),
      ...(typeof parsed.scriptTab === 'string' ? { scriptTab: parsed.scriptTab as ApiClientUiPreferences['scriptTab'] } : {}),
      ...(typeof parsed.theme === 'string' ? { theme: parsed.theme as ApiClientUiPreferences['theme'] } : {}),
    };
  } catch {
    return { version: 1 };
  }
}

export function writeApiClientUiPreferences(persistenceKey: string, patch: Partial<Omit<ApiClientUiPreferences, 'version'>>, storage?: Storage): void {
  const resolvedStorage = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
  if (!resolvedStorage) return;
  try {
    const current = readApiClientUiPreferences(persistenceKey, resolvedStorage);
    resolvedStorage.setItem(keyForWorkspace(persistenceKey), JSON.stringify({ ...current, ...patch, version: 1 } satisfies ApiClientUiPreferences));
  } catch {
    // UI preferences are best-effort and must never block the API Client workspace.
  }
}
