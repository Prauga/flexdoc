import { readFileSync, writeFileSync } from 'node:fs';

function edit(path, fn) {
  const before = readFileSync(path, 'utf8');
  const after = fn(before);
  if (after === before) throw new Error(`No change applied to ${path}`);
  writeFileSync(path, after);
}
function once(source, from, to, label) {
  const i = source.indexOf(from);
  if (i < 0) throw new Error(`Missing ${label}`);
  if (source.indexOf(from, i + from.length) >= 0) throw new Error(`Ambiguous ${label}`);
  return source.slice(0, i) + to + source.slice(i + from.length);
}

edit('packages/client/src/utils/api-client-workspace.ts', (source) => once(source,
  `    const grantTypes = new Set(['accessToken', 'authorizationCode', 'clientCredentials', 'password', 'implicit']);\n    if (value.grantType !== undefined && (typeof value.grantType !== 'string' || !grantTypes.has(value.grantType))) return false;`,
  `    if (value.grantType !== undefined && (typeof value.grantType !== 'string' || !['accessToken', 'authorizationCode', 'clientCredentials', 'password', 'implicit'].includes(value.grantType))) return false;`,
  'OAuth grant validation'));

edit('packages/client/src/standalone.tsx', (source) => {
  source = once(source,
    `  const paths: OpenAPISpec['paths'] = {};\n  const methods = new Set(['get', 'post', 'put', 'delete', 'patch', 'options', 'head', 'trace']);`,
    `  const paths: OpenAPISpec['paths'] = {};`,
    'standalone method Set');
  source = once(source,
    `      if (!methods.has(key)) { (nextPathItem as Record<string, unknown>)[key] = value; continue; }`,
    `      if (!['get', 'post', 'put', 'delete', 'patch', 'options', 'head', 'trace'].includes(key)) { (nextPathItem as Record<string, unknown>)[key] = value; continue; }`,
    'standalone method lookup');
  return source;
});

edit('packages/client/src/components/ApiClientHistory.tsx', (source) => {
  source = once(source, `import { cloneApiClientScripts } from '../utils/api-client-scripting';\n`, '', 'recent history script clone import');
  source = once(source, `import { cloneRequestDraft } from '../utils/api-client-workspace';\n`, '', 'recent history request clone import');
  source = once(source,
    `    onLoadRequest(\n      cloneRequestDraft(entry.request),\n      entry.scripts ? cloneApiClientScripts(entry.scripts) : undefined,\n      entry.collectionId,\n      entry.folderId,\n    );`,
    `    onLoadRequest(entry.request, entry.scripts, entry.collectionId, entry.folderId);`,
    'recent history redundant clones');
  return source;
});

edit('packages/client/src/components/ApiClientHistoryPage.tsx', (source) => once(source,
  `  const selectedRun = selectedRunId\n    ? blocks.find((block) => block.kind === 'run' && block.group.runId === selectedRunId)?.kind === 'run'\n      ? (blocks.find((block) => block.kind === 'run' && block.group.runId === selectedRunId) as { kind: 'run'; group: ApiClientHistoryRunGroup }).group\n      : undefined\n    : undefined;`,
  `  const selectedRunBlock = selectedRunId ? blocks.find((block) => block.kind === 'run' && block.group.runId === selectedRunId) : undefined;\n  const selectedRun = selectedRunBlock?.kind === 'run' ? selectedRunBlock.group : undefined;`,
  'full history duplicate run lookup'));

console.log('Applied renderer size hygiene pass.');
