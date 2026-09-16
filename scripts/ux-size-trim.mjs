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

edit('packages/client/src/utils/api-client-execution.ts', (source) => {
  source = once(source,
    `export interface ApiClientTransportDecision {\n  mode: ApiClientTransportMode;\n  available: boolean;\n  bodyHost: boolean;\n  missing: HttpHostExecutionCapability[];\n}`,
    `export type ApiClientTransportDecision = readonly [\n  mode: ApiClientTransportMode,\n  available: boolean,\n  bodyHost: boolean,\n  missing: HttpHostExecutionCapability[],\n];`,
    'transport decision type');
  source = once(source,
    `  return {\n    mode: hostRequired ? 'host-required' : preferHostExecution && options.hostExecution?.available === true ? 'api-host' : 'browser',\n    available, bodyHost, missing,\n  };\n}`,
    `  return [\n    hostRequired ? 'host-required' : preferHostExecution && options.hostExecution?.available === true ? 'api-host' : 'browser',\n    available, bodyHost, missing,\n  ];\n}\n\nexport function apiClientTransportLabel(mode: ApiClientTransportMode): string {\n  return mode === 'host-required' ? 'Host required' : mode === 'api-host' ? 'API host' : 'Browser';\n}\n\nexport function apiClientTransportNotice(\n  decision: ApiClientTransportDecision,\n  hostExecution: FlexDocHostExecutionPublicOptions | undefined,\n  unsupported?: string,\n  disabled?: string,\n): string | null {\n  const [mode, available, , missing] = decision;\n  if (mode === 'host-required') {\n    if (available) return unsupported || 'The browser cannot send this request. FlexDoc will execute it from the API host.';\n    if (!hostExecution?.available) return disabled || 'API-host execution is unavailable on this documentation server.';\n    return hostUnavailableMessage(missing, hostExecution);\n  }\n  return mode === 'api-host' ? 'This request runs from your API server.' : null;\n}`,
    'transport decision return');
  source = once(source,
    `    const transport = resolveApiClientTransport({ request: executionDraft, hostExecution: options.hostExecution, preferHostExecution: options.preferHostExecution });\n    let apiResponse: ApiClientExecutionResponse;\n\n    if (transport.mode !== 'browser') {\n      const missing = transport.missing;`,
    `    const [transportMode, , , missing] = resolveApiClientTransport({ request: executionDraft, hostExecution: options.hostExecution, preferHostExecution: options.preferHostExecution });\n    let apiResponse: ApiClientExecutionResponse;\n\n    if (transportMode !== 'browser') {`,
    'executor transport decision');
  return source;
});

edit('packages/client/src/components/ApiClient.tsx', (source) => {
  source = once(source,
    `import { executeApiClientRequest, resolveApiClientTransport } from '../utils/api-client-execution';`,
    `import { apiClientTransportLabel, apiClientTransportNotice, executeApiClientRequest, resolveApiClientTransport } from '../utils/api-client-execution';`,
    'API Client transport imports');
  source = once(source,
    `  const transport = resolveApiClientTransport({ request: { ...draft, auth: resolvedAuth }, hostExecution });\n  const hostCapabilities = hostExecution?.capabilities || [];\n  const missingHostCapabilities = transport.missing;\n  const bodyHost = transport.bodyHost;\n  const hostRequired = transport.mode === 'host-required';\n  const available = transport.available;\n  const transportLabel = transport.mode === 'host-required' ? 'Host required' : transport.mode === 'api-host' ? 'API host' : 'Browser';\n  const hostNotice = bodyHost\n    ? hostExecution?.available\n      ? messages?.unusualBodyHostExecution || \`${method} request bodies are unusual. FlexDoc will use API-host execution so the body can be sent.\`\n      : messages?.unusualBodyBrowserWarning || \`${method} request bodies are unusual. Browser fetch may reject this request; enable API-host execution to send it reliably.\`\n    : hostRequired\n    ? available\n      ? messages?.hostBrowserUnsupported || 'The browser cannot send this request. FlexDoc will execute it from the API host.'\n      : hostExecution?.available\n        ? \`The API host does not support the required capability\${missingHostCapabilities.length === 1 ? '' : 'ies'}: \${missingHostCapabilities.join(', ')}.\`\n        : messages?.hostExecutionDisabled || 'API-host execution is unavailable on this documentation server.'\n    : transport.mode === 'api-host'\n      ? 'This request runs from your API server.'\n      : null;\n  const supportsHostCapability = (capability: HttpHostExecutionCapability) => hostExecution?.available === true && hostCapabilities.includes(capability);\n  const setTransportPreference = (value: string) => setDraft((current) => ({\n    ...current,\n    hostExecution: { ...(current.hostExecution || {}), preferHostExecution: value === 'inherit' ? undefined : value === 'host' },\n  }));`,
    `  const transport = resolveApiClientTransport({ request: { ...draft, auth: resolvedAuth }, hostExecution });\n  const [transportMode, available, bodyHost] = transport;\n  const hostRequired = transportMode === 'host-required';\n  const hostNotice = bodyHost\n    ? hostExecution?.available\n      ? messages?.unusualBodyHostExecution || \`${method} request bodies are unusual. FlexDoc will use API-host execution so the body can be sent.\`\n      : messages?.unusualBodyBrowserWarning || \`${method} request bodies are unusual. Browser fetch may reject this request; enable API-host execution to send it reliably.\`\n    : apiClientTransportNotice(transport, hostExecution, messages?.hostBrowserUnsupported, messages?.hostExecutionDisabled);\n  const supportsHostCapability = (capability: HttpHostExecutionCapability) => hostExecution?.available === true && (hostExecution.capabilities || []).includes(capability);`,
    'API Client transport block');
  source = once(source,
    `{transportLabel}</span>\n        {hostExecution?.available && <label className={\`inline-flex items-center gap-2 \${mutedClass}\`}>Transport preference<select aria-label='Transport preference' disabled={hostRequired} className={\`rounded-md border px-2 py-1 \${inputClass}\`} value={draft.hostExecution?.preferHostExecution === undefined ? 'inherit' : draft.hostExecution.preferHostExecution ? 'host' : 'browser'} onChange={(event) => setTransportPreference(event.target.value)}>` ,
    `{apiClientTransportLabel(transportMode)}</span>\n        {hostExecution?.available && <label className={\`inline-flex items-center gap-2 \${mutedClass}\`}>Transport preference<select aria-label='Transport preference' disabled={hostRequired} className={\`rounded-md border px-2 py-1 \${inputClass}\`} value={draft.hostExecution?.preferHostExecution === undefined ? 'inherit' : draft.hostExecution.preferHostExecution ? 'host' : 'browser'} onChange={({ target: { value } }) => setDraft((current) => ({ ...current, hostExecution: { ...(current.hostExecution || {}), preferHostExecution: value === 'inherit' ? undefined : value === 'host' } }))}>`,
    'API Client preference control');
  return source;
});

edit('packages/client/src/components/RequestPlayground.tsx', (source) => {
  source = once(source,
    `import { executeApiClientRequest, resolveApiClientTransport } from '../utils/api-client-execution';`,
    `import { apiClientTransportLabel, apiClientTransportNotice, executeApiClientRequest, resolveApiClientTransport } from '../utils/api-client-execution';`,
    'Try It transport imports');
  source = once(source,
    `  const cookieRequiresHost = Object.values(values.cookies || {}).some(Boolean);\n  const transport = resolveApiClientTransport({\n    request: currentDraft || { method, url: '' },\n    hostExecution: options?.tryIt?.hostExecution,\n    additionalRequirements: cookieRequiresHost ? ['cookies'] : [],\n  });\n  const missingHostCapabilities = transport.missing;\n  const hostRequired = transport.mode === 'host-required';\n  const available = transport.available;\n  const transportLabel = transport.mode === 'host-required' ? 'Host required' : transport.mode === 'api-host' ? 'API host' : 'Browser';\n  const hostNotice = hostRequired\n    ? available\n      ? 'The browser cannot send this request. FlexDoc will execute it from the API host.'\n      : options?.tryIt?.hostExecution?.available\n        ? \`The API host does not support the required capability\${missingHostCapabilities.length === 1 ? '' : 'ies'}: \${missingHostCapabilities.join(', ')}.\`\n        : 'API-host execution is unavailable on this documentation server.'\n    : transport.mode === 'api-host'\n      ? 'This request runs from your API server.'\n      : null;`,
    `  const transport = resolveApiClientTransport({\n    request: currentDraft || { method, url: '' },\n    hostExecution: options?.tryIt?.hostExecution,\n    additionalRequirements: Object.values(values.cookies || {}).some(Boolean) ? ['cookies'] : [],\n  });\n  const [transportMode, available] = transport;\n  const hostRequired = transportMode === 'host-required';\n  const hostNotice = apiClientTransportNotice(transport, options?.tryIt?.hostExecution);`,
    'Try It transport block');
  source = source.replaceAll('{transportLabel}</span>', '{apiClientTransportLabel(transportMode)}</span>');
  source = source.replaceAll("transport.mode !== 'browser'", "transportMode !== 'browser'");
  return source;
});

edit('packages/client/src/utils/api-client-ui-preferences.ts', (source) => {
  source = once(source,
    `    const requestTabs = new Set(['params', 'headers', 'authorization', 'body', 'scripts']);\n    const scriptTabs = new Set(['pre-request', 'tests']);\n    const themes = new Set(['light', 'dark']);\n    if (parsed.sidebarCollapsed !== undefined && typeof parsed.sidebarCollapsed !== 'boolean') return { version: 1 };\n    if (parsed.requestTab !== undefined && (typeof parsed.requestTab !== 'string' || !requestTabs.has(parsed.requestTab))) return { version: 1 };\n    if (parsed.scriptTab !== undefined && (typeof parsed.scriptTab !== 'string' || !scriptTabs.has(parsed.scriptTab))) return { version: 1 };\n    if (parsed.theme !== undefined && (typeof parsed.theme !== 'string' || !themes.has(parsed.theme))) return { version: 1 };`,
    `    if (parsed.sidebarCollapsed !== undefined && typeof parsed.sidebarCollapsed !== 'boolean') return { version: 1 };\n    if (parsed.requestTab !== undefined && !['params', 'headers', 'authorization', 'body', 'scripts'].includes(parsed.requestTab as string)) return { version: 1 };\n    if (parsed.scriptTab !== undefined && !['pre-request', 'tests'].includes(parsed.scriptTab as string)) return { version: 1 };\n    if (parsed.theme !== undefined && !['light', 'dark'].includes(parsed.theme as string)) return { version: 1 };`,
    'UI preference validators');
  return source;
});

console.log('Applied shared transport and preference size trim.');
