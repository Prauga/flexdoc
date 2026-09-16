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

edit('packages/client/src/utils/api-client-workspace.ts', (source) => {
  source = once(source,
    "import { cloneApiClientScripts } from './api-client-scripting';\n",
    "import { cloneApiClientScripts } from './api-client-scripting';\nimport { createApiClientWorkspacePersistenceSnapshot } from './api-client-history-privacy';\n",
    'workspace privacy import');
  source = once(source,
    "      transaction.objectStore(STORE_NAME).put(workspace, key);",
    "      transaction.objectStore(STORE_NAME).put(createApiClientWorkspacePersistenceSnapshot(workspace), key);",
    'workspace persistence sanitizer');
  return source;
});

edit('packages/client/src/components/ApiClientWorkspace.tsx', (source) => {
  source = once(source,
    "import { createApiClientWorkspacePersistenceSnapshot } from '../utils/api-client-history-privacy';\n",
    '',
    'workspace caller privacy import');
  source = once(source,
    "    const snapshot = createApiClientWorkspacePersistenceSnapshot(workspace);\n    void saveApiClientWorkspace(persistenceKey, snapshot).catch(() => undefined);",
    "    void saveApiClientWorkspace(persistenceKey, workspace).catch(() => undefined);",
    'workspace caller snapshot');
  return source;
});

edit('packages/client/src/components/ApiClientHistoryPage.tsx', (source) => {
  source = once(source, "import { cloneApiClientScripts } from '../utils/api-client-scripting';\n", '', 'history page script clone import');
  source = once(source, "import { cloneRequestDraft } from '../utils/api-client-workspace';\n", '', 'history page request clone import');
  source = once(source,
    "    onLoadRequest(cloneRequestDraft(entry.request), entry.scripts ? cloneApiClientScripts(entry.scripts) : undefined, entry.collectionId, entry.folderId);",
    "    onLoadRequest(entry.request, entry.scripts, entry.collectionId, entry.folderId);",
    'history page redundant clones');
  return source;
});

edit('packages/client/src/utils/api-client-history.ts', (source) => {
  source = once(source,
    "function hasFailure(entry: ApiClientHistoryEntry): boolean {\n  return !!entry.error\n    || !!entry.scriptError\n    || (entry.status !== undefined && entry.status >= 400)\n    || !!entry.scriptTests?.some((test) => !test.passed);\n}\n",
    "export function apiClientHistoryHasFailure(entry: ApiClientHistoryEntry): boolean {\n  return !!entry.error || !!entry.scriptError || (entry.status !== undefined && entry.status >= 400) || !!entry.scriptTests?.some((test) => !test.passed);\n}\n\nexport function apiClientHistoryDisplayTime(value: string): string {\n  const date = new Date(value);\n  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();\n}\n",
    'history shared helpers');
  source = source.replaceAll('hasFailure(', 'apiClientHistoryHasFailure(');
  return source;
});

edit('packages/client/src/components/ApiClientHistoryPage.tsx', (source) => {
  source = once(source,
    "import { filterApiClientHistoryEntries, groupApiClientHistoryEntries } from '../utils/api-client-history';",
    "import { apiClientHistoryDisplayTime, apiClientHistoryHasFailure, filterApiClientHistoryEntries, groupApiClientHistoryEntries } from '../utils/api-client-history';",
    'history page helper imports');
  source = once(source,
    "function displayTime(value: string): string {\n  const date = new Date(value);\n  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();\n}\n\nfunction hasFailure(entry: ApiClientHistoryEntry): boolean {\n  return !!entry.error\n    || !!entry.scriptError\n    || (entry.status !== undefined && entry.status >= 400)\n    || !!entry.scriptTests?.some((test) => !test.passed);\n}\n\n",
    '',
    'history page duplicate helpers');
  source = source.replaceAll('hasFailure(', 'apiClientHistoryHasFailure(');
  source = source.replaceAll('displayTime(', 'apiClientHistoryDisplayTime(');
  source = once(source,
    "  const codeClass = theme === 'dark' ? 'border-gray-700 bg-gray-950 text-gray-100' : 'border-gray-200 bg-white text-gray-900';",
    "  const codeClass = theme === 'dark' ? 'border-gray-700 bg-gray-950 text-gray-100' : 'border-gray-200 bg-white text-gray-900';\n  const headingClass = 'text-xs font-semibold uppercase tracking-wide';",
    'history heading class');
  source = source.replaceAll("className='text-xs font-semibold uppercase tracking-wide'", 'className={headingClass}');
  return source;
});

edit('packages/client/src/components/ApiClientHistory.tsx', (source) => {
  source = once(source,
    "import type { HttpRequestDraft } from '../utils/http-client';\n",
    "import type { HttpRequestDraft } from '../utils/http-client';\nimport { apiClientHistoryDisplayTime } from '../utils/api-client-history';\n",
    'recent history display helper import');
  source = once(source,
    "function displayTime(value: string): string {\n  const date = new Date(value);\n  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();\n}\n\n",
    '',
    'recent history duplicate time helper');
  source = source.replaceAll('displayTime(', 'apiClientHistoryDisplayTime(');
  return source;
});

edit('packages/client/src/utils/renderer-preferences.ts', (source) => once(source,
`function writePreferences(key: string, next: FlexDocViewerPreferences, storage?: Storage): void {
  const resolvedStorage = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
  if (!resolvedStorage) return;
  try {
    if (next.expand === undefined && next.sidebarCollapsed === undefined && next.theme === undefined && next.expandedTags === undefined) resolvedStorage.removeItem(key);
    else resolvedStorage.setItem(key, JSON.stringify(next));
  } catch {
    // Viewer preferences are best-effort and must never prevent documentation rendering.
  }
}

function writePreference<K extends Exclude<keyof FlexDocViewerPreferences, 'version'>>(
  key: string,
  field: K,
  value: FlexDocViewerPreferences[K],
  storage?: Storage,
): void {
  const next = { ...readFlexDocViewerPreferences(key, storage) };
  if (value === undefined) delete next[field];
  else next[field] = value;
  writePreferences(key, next, storage);
}

export function writeFlexDocViewerExpandPreference(key: string, expand?: ExpandOption, storage?: Storage): void {
  writePreference(key, 'expand', expand, storage);
}

export function writeFlexDocViewerSidebarPreference(key: string, sidebarCollapsed?: boolean, storage?: Storage): void {
  writePreference(key, 'sidebarCollapsed', sidebarCollapsed, storage);
}

export function writeFlexDocViewerThemePreference(key: string, theme?: FlexDocViewerTheme, storage?: Storage): void {
  writePreference(key, 'theme', theme, storage);
}

export function writeFlexDocViewerExpandedTagsPreference(key: string, expandedTags?: string[], storage?: Storage): void {
  writePreference(key, 'expandedTags', expandedTags ? [...new Set(expandedTags)] : undefined, storage);
}
`,
`export function writeFlexDocViewerPreference<K extends Exclude<keyof FlexDocViewerPreferences, 'version'>>(
  key: string,
  field: K,
  value: FlexDocViewerPreferences[K],
  storage?: Storage,
): void {
  const resolvedStorage = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
  if (!resolvedStorage) return;
  try {
    const next = { ...readFlexDocViewerPreferences(key, resolvedStorage) };
    const stored = field === 'expandedTags' && Array.isArray(value) ? [...new Set(value)] : value;
    if (stored === undefined) delete next[field];
    else next[field] = stored as FlexDocViewerPreferences[K];
    if (next.expand === undefined && next.sidebarCollapsed === undefined && next.theme === undefined && next.expandedTags === undefined) resolvedStorage.removeItem(key);
    else resolvedStorage.setItem(key, JSON.stringify(next));
  } catch {
    // Viewer preferences are best-effort and must never prevent documentation rendering.
  }
}
`,
  'renderer preference writers'));

edit('packages/client/src/components/FlexDoc.tsx', (source) => {
  source = once(source,
`  writeFlexDocViewerExpandPreference,
  writeFlexDocViewerExpandedTagsPreference,
  writeFlexDocViewerSidebarPreference,
  writeFlexDocViewerThemePreference,`,
`  writeFlexDocViewerPreference,`,
    'FlexDoc preference imports');
  source = source
    .replaceAll('writeFlexDocViewerSidebarPreference(preferenceKey, next)', "writeFlexDocViewerPreference(preferenceKey, 'sidebarCollapsed', next)")
    .replaceAll('writeFlexDocViewerExpandPreference(preferenceKey, expand)', "writeFlexDocViewerPreference(preferenceKey, 'expand', expand)")
    .replaceAll('writeFlexDocViewerThemePreference(preferenceKey, nextTheme)', "writeFlexDocViewerPreference(preferenceKey, 'theme', nextTheme)")
    .replaceAll('writeFlexDocViewerExpandedTagsPreference(preferenceKey, tags)', "writeFlexDocViewerPreference(preferenceKey, 'expandedTags', tags)");
  return source;
});

edit('packages/client/src/utils/renderer-preferences.test.ts', (source) => {
  source = once(source,
`  writeFlexDocViewerExpandPreference,
  writeFlexDocViewerExpandedTagsPreference,
  writeFlexDocViewerSidebarPreference,
  writeFlexDocViewerThemePreference,`,
`  writeFlexDocViewerPreference,`,
    'preference test imports');
  source = source
    .replaceAll("writeFlexDocViewerExpandPreference(key, ['responses'], storage)", "writeFlexDocViewerPreference(key, 'expand', ['responses'], storage)")
    .replaceAll('writeFlexDocViewerExpandPreference(key, undefined, storage)', "writeFlexDocViewerPreference(key, 'expand', undefined, storage)")
    .replaceAll('writeFlexDocViewerSidebarPreference(key, true, storage)', "writeFlexDocViewerPreference(key, 'sidebarCollapsed', true, storage)")
    .replaceAll("writeFlexDocViewerThemePreference(key, 'dark', storage)", "writeFlexDocViewerPreference(key, 'theme', 'dark', storage)")
    .replaceAll("writeFlexDocViewerExpandedTagsPreference(key, ['pets', 'admin', 'pets'], storage)", "writeFlexDocViewerPreference(key, 'expandedTags', ['pets', 'admin', 'pets'], storage)")
    .replaceAll('writeFlexDocViewerThemePreference(key, undefined, storage)', "writeFlexDocViewerPreference(key, 'theme', undefined, storage)");
  return source;
});

edit('packages/client/src/components/FlexDoc.test.tsx', (source) => {
  source = once(source,
    "import { createFlexDocViewerPreferencesKey, writeFlexDocViewerThemePreference } from '../utils/renderer-preferences';",
    "import { createFlexDocViewerPreferencesKey, writeFlexDocViewerPreference } from '../utils/renderer-preferences';",
    'FlexDoc test preference import');
  source = source.replaceAll("writeFlexDocViewerThemePreference(preferenceKey, 'dark')", "writeFlexDocViewerPreference(preferenceKey, 'theme', 'dark')");
  return source;
});

edit('packages/client/src/components/ApiClient.tsx', (source) => {
  source = once(source,
    "  const inputClass = theme === 'dark' ? 'bg-gray-900 border-gray-700 text-gray-100' : 'bg-white border-gray-300 text-gray-900';",
    "  const inputClass = theme === 'dark' ? 'bg-gray-900 border-gray-700 text-gray-100' : 'bg-white border-gray-300 text-gray-900';\n  const fieldClass = `rounded-md border px-3 py-2 ${inputClass}`;\n  const fullFieldClass = `w-full ${fieldClass}`;\n  const smallFieldClass = `${fieldClass} text-sm`;",
    'API Client shared field classes');
  source = source.replaceAll('className={`rounded-md border px-3 py-2 ${inputClass}`}', 'className={fieldClass}');
  source = source.replaceAll('className={`w-full rounded-md border px-3 py-2 ${inputClass}`}', 'className={fullFieldClass}');
  source = source.replaceAll('className={`rounded-md border px-3 py-2 text-sm ${inputClass}`}', 'className={smallFieldClass}');
  source = source.replaceAll('fieldClass={`w-full rounded-md border px-3 py-2 text-sm ${inputClass}`}', 'fieldClass={`${fullFieldClass} text-sm`}');
  return source;
});

console.log('Applied combined transport/privacy size cleanup.');
