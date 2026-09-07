import { readApiClientUiPreferences, writeApiClientUiPreferences } from './api-client-ui-preferences';

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => { values.delete(key); },
    setItem: (key, value) => { values.set(key, String(value)); },
  };
}

describe('api-client-ui-preferences', () => {
  it('persists UI state per workspace key without clobbering earlier fields', () => {
    const storage = memoryStorage();
    writeApiClientUiPreferences('workspace-a', { sidebarCollapsed: true }, storage);
    writeApiClientUiPreferences('workspace-a', { requestTab: 'authorization' }, storage);
    writeApiClientUiPreferences('workspace-a', { scriptTab: 'tests' }, storage);
    writeApiClientUiPreferences('workspace-a', { theme: 'dark' }, storage);
    expect(readApiClientUiPreferences('workspace-a', storage)).toEqual({
      version: 1,
      sidebarCollapsed: true,
      requestTab: 'authorization',
      scriptTab: 'tests',
      theme: 'dark',
    });
    expect(readApiClientUiPreferences('workspace-b', storage)).toEqual({ version: 1 });
  });

  it('rejects malformed stored values', () => {
    const storage = memoryStorage();
    storage.setItem('flexdoc:api-client-ui:bad', JSON.stringify({ version: 1, requestTab: 'made-up' }));
    expect(readApiClientUiPreferences('bad', storage)).toEqual({ version: 1 });

    storage.setItem('flexdoc:api-client-ui:bad', JSON.stringify({ version: 1, theme: 'system' }));
    expect(readApiClientUiPreferences('bad', storage)).toEqual({ version: 1 });
  });
});
