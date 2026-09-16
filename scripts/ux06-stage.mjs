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

edit('packages/client/src/components/ApiClient.tsx', (source) => {
  source = once(source,
    "import { apiClientTransportLabel, apiClientTransportNotice, executeApiClientRequest, resolveApiClientTransport } from '../utils/api-client-execution';\n",
    "import { apiClientTransportLabel, apiClientTransportNotice, executeApiClientRequest, resolveApiClientTransport } from '../utils/api-client-execution';\nimport { preflightApiClientHostExecution } from '../utils/api-client-host-preflight';\n",
    'ApiClient preflight import');
  source = once(source,
`  const execute = async () => {
    if (loading) return;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    onExecutionStart?.();
    setLoading(true);
    setError(null);
    setScriptError(null);
    setScriptTests([]);
    setScriptLogs([]);
    setResponse(null);
    setCurlCommand(undefined);
    try {
      const outcome = await executeApiClientRequest({`,
`  const execute = async () => {
    if (loading) return;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setLoading(true);
    setError(null);
    setScriptError(null);
    setScriptTests([]);
    setScriptLogs([]);
    setResponse(null);
    setCurlCommand(undefined);
    try {
      if (transportMode !== 'browser' && hostExecution?.available) {
        const warning = await preflightApiClientHostExecution(hostExecution.endpoint, globalThis.fetch, controller.signal);
        if (controller.signal.aborted) { setError(messages?.requestCancelled || 'Request cancelled.'); return; }
        if (warning) { setError(warning); return; }
      }
      onExecutionStart?.();
      const outcome = await executeApiClientRequest({`,
    'ApiClient intent-time preflight');
  return source;
});

edit('packages/client/src/components/RequestPlayground.tsx', (source) => {
  source = once(source,
    "import { apiClientTransportLabel, apiClientTransportNotice, executeApiClientRequest, resolveApiClientTransport } from '../utils/api-client-execution';\n",
    "import { apiClientTransportLabel, apiClientTransportNotice, executeApiClientRequest, resolveApiClientTransport } from '../utils/api-client-execution';\nimport { preflightApiClientHostExecution } from '../utils/api-client-host-preflight';\n",
    'Try It preflight import');
  source = once(source,
`  const execute = async () => {
    setLoading(true); setError(null); setResponse(null);
    try {
      const request = buildRequest(spec, path, method, valuesRef.current);`,
`  const execute = async () => {
    setLoading(true); setError(null); setResponse(null);
    try {
      if (transportMode !== 'browser' && options?.tryIt?.hostExecution?.available) {
        const warning = await preflightApiClientHostExecution(options.tryIt.hostExecution.endpoint);
        if (warning) { setError(warning); return; }
      }
      const request = buildRequest(spec, path, method, valuesRef.current);`,
    'Try It intent-time preflight');
  return source;
});

edit('docs/host-execution-operations.md', (source) => once(source,
  "When native host execution must remain enabled but operators do not want ordinary interactive Try It requests to take the additional browser -> API-host -> target hop, the Node host can set `tryIt.hostExecution.preferHostExecution: false`. Host-only features still require host execution; this knob only keeps ordinary requests on direct browser transport. Omitting the option keeps the 3.3 default (`true`).\n\n",
  "When native host execution must remain enabled but operators do not want ordinary interactive Try It requests to take the additional browser -> API-host -> target hop, the Node host can set `tryIt.hostExecution.preferHostExecution: false`. Host-only features still require host execution; this knob only keeps ordinary requests on direct browser transport. Omitting the option keeps the 3.3 default (`true`).\n\n### Execute-route preflight\n\nBefore the first interactive API Client or Try It request uses an advertised API-host execute endpoint, FlexDoc sends a harmless same-origin preflight to that endpoint. The probe uses the normal `X-FlexDoc-Execute: 1` marker with an intentionally empty JSON envelope. A correctly mounted FlexDoc route rejects that envelope with its own HTTP 400 validation response; admission-control HTTP 429 also proves the protected route is reachable. The probe never contains a target request, so it cannot create an outbound API call. Successful endpoint probes are reused for the rest of the page lifetime.\n\nWarnings for authentication/authorization rejection, CSRF or body-middleware interception, missing/incorrect route mounts, redirects to login HTML, and transport failures stop that host-routed Send before target execution. Keep the execute route under the same application-owned authentication/authorization boundary as the documentation subtree; do not weaken security middleware simply to silence the preflight.\n\n",
  'preflight operations docs'));

console.log('Applied UX-06 execute-route preflight staging transform.');
