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

for (const path of [
  'packages/client/src/utils/api-client-ui-preferences.ts',
  'packages/client/src/utils/api-client-ui-preferences.test.ts',
  'packages/client/src/components/ApiClientWorkspace.tsx',
  'packages/client/src/components/ApiClientHistory.tsx',
]) {
  edit(path, (source) => source
    .replaceAll('persistHostHistoryBodies', 'historyBodies')
    .replaceAll('PersistHostHistoryBodies', 'HistoryBodies'));
}

edit('packages/client/src/utils/api-client-history-privacy.ts', (source) => {
  source = once(source,
    "/** Privacy controls applied only to the workspace copy written to IndexedDB. */\nexport interface ApiClientHistoryPersistencePrivacyOptions {\n  /** Keep API-host request/response bodies in IndexedDB. Defaults to true. */\n  persistHostHistoryBodies?: boolean;\n}\n\n",
    '',
    'privacy options type');
  source = once(source,
    "export function createApiClientWorkspacePersistenceSnapshot(\n  workspace: ApiClientWorkspaceState,\n  options: ApiClientHistoryPersistencePrivacyOptions = {},\n): ApiClientWorkspaceState {\n  const persistHostBodies = options.persistHostHistoryBodies !== false;",
    "export function createApiClientWorkspacePersistenceSnapshot(\n  workspace: ApiClientWorkspaceState,\n  historyBodies = true,\n): ApiClientWorkspaceState {",
    'privacy options parameter');
  source = source.replaceAll('!persistHostBodies', '!historyBodies');
  return source;
});

edit('packages/client/src/components/ApiClientWorkspace.tsx', (source) => {
  source = once(source,
    'createApiClientWorkspacePersistenceSnapshot(workspace, { historyBodies })',
    'createApiClientWorkspacePersistenceSnapshot(workspace, historyBodies)',
    'privacy persistence call');
  return source;
});

edit('packages/client/src/utils/api-client-history-privacy.test.ts', (source) => {
  source = source
    .replaceAll('createApiClientWorkspacePersistenceSnapshot(workspace, { historyBodies: false })', 'createApiClientWorkspacePersistenceSnapshot(workspace, false)')
    .replaceAll('createApiClientWorkspacePersistenceSnapshot(workspace, { persistHostHistoryBodies: false })', 'createApiClientWorkspacePersistenceSnapshot(workspace, false)');
  return source;
});

edit('packages/client/src/components/ApiClientHistory.tsx', (source) => {
  source = once(source,
    "    <label className='flex items-start gap-2 rounded-md border px-2 py-2 text-xs'>\n      <input type='checkbox' className='mt-0.5' checked={historyBodies} onChange={(event) => onHistoryBodiesChange(event.target.checked)} />\n      <span>\n        <span className='block font-medium'>Store API-host bodies in history</span>\n        <span className={`block ${mutedClass}`}>Turn off for metadata-only persisted host history. Sensitive headers are always redacted.</span>\n      </span>\n    </label>",
    "    <label className='flex items-center gap-2 rounded-md border p-2 text-xs' title='Sensitive history headers are always redacted.'>\n      <input type='checkbox' checked={historyBodies} onChange={(event) => onHistoryBodiesChange(event.target.checked)} />\n      <span>Store API-host bodies</span>\n    </label>",
    'privacy history toggle');
  return source;
});

console.log('Applied compact OBS-01 private-state trim.');
