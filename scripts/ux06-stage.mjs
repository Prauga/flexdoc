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
    "import { apiClientTransportLabel, apiClientTransportNotice, executeApiClientRequest, resolveApiClientTransport } from '../utils/api-client-execution';\nimport { useApiClientHostExecutionPreflight } from '../utils/api-client-host-preflight';\n",
    'ApiClient preflight import');
  source = once(source,
    "  hostExecution,\n}) => {\n  const initialDraft = withDefaults(initialRequest);",
    "  hostExecution,\n}) => {\n  const hostPreflightWarning = useApiClientHostExecutionPreflight(hostExecution?.available ? hostExecution.endpoint : undefined);\n  const initialDraft = withDefaults(initialRequest);",
    'ApiClient preflight hook');
  source = once(source,
    "      {hostNotice && <div role={bodyHost ? 'status' : available ? 'status' : 'alert'} aria-label={messages?.hostExecutionStatus || 'Host execution status'} className={`rounded-md border p-3 text-sm ${available ? (theme === 'dark' ? 'border-blue-800 bg-blue-950/40 text-blue-200' : 'border-blue-300 bg-blue-50 text-blue-800') : (theme === 'dark' ? 'border-amber-800 bg-amber-950/40 text-amber-200' : 'border-amber-300 bg-amber-50 text-amber-800')}`}>{hostNotice}</div>}\n",
    "      {hostNotice && <div role={bodyHost ? 'status' : available ? 'status' : 'alert'} aria-label={messages?.hostExecutionStatus || 'Host execution status'} className={`rounded-md border p-3 text-sm ${available ? (theme === 'dark' ? 'border-blue-800 bg-blue-950/40 text-blue-200' : 'border-blue-300 bg-blue-50 text-blue-800') : (theme === 'dark' ? 'border-amber-800 bg-amber-950/40 text-amber-200' : 'border-amber-300 bg-amber-50 text-amber-800')}`}>{hostNotice}</div>}\n      {hostPreflightWarning && <div role='alert' aria-label='API host route preflight' className={`flex gap-2 rounded-md border p-3 text-sm ${theme === 'dark' ? 'border-amber-800 bg-amber-950/40 text-amber-200' : 'border-amber-300 bg-amber-50 text-amber-800'}`}><AlertCircle className='mt-0.5 h-4 w-4 shrink-0' />{hostPreflightWarning}</div>}\n",
    'ApiClient preflight warning');
  return source;
});

edit('packages/client/src/components/RequestPlayground.tsx', (source) => {
  source = once(source,
    "import { apiClientTransportLabel, apiClientTransportNotice, executeApiClientRequest, resolveApiClientTransport } from '../utils/api-client-execution';\n",
    "import { apiClientTransportLabel, apiClientTransportNotice, executeApiClientRequest, resolveApiClientTransport } from '../utils/api-client-execution';\nimport { useApiClientHostExecutionPreflight } from '../utils/api-client-host-preflight';\n",
    'Try It preflight import');
  source = once(source,
    "const RequestPlaygroundStateful: React.FC<Props> = ({ spec, path, method, theme, options, onRequestChange, onOpenInApiClient }) => {\n  const pathItem = spec.paths[path];",
    "const RequestPlaygroundStateful: React.FC<Props> = ({ spec, path, method, theme, options, onRequestChange, onOpenInApiClient }) => {\n  const hostPreflightWarning = useApiClientHostExecutionPreflight(options?.tryIt?.hostExecution?.available ? options.tryIt.hostExecution.endpoint : undefined);\n  const pathItem = spec.paths[path];",
    'Try It preflight hook');
  source = once(source,
    "      {hostNotice && <div role={available ? 'status' : 'alert'} className={`rounded-md border p-3 text-sm ${available ? 'border-blue-300 bg-blue-50 text-blue-800' : 'border-amber-300 bg-amber-50 text-amber-800'}`}>{hostNotice}</div>}\n",
    "      {hostNotice && <div role={available ? 'status' : 'alert'} className={`rounded-md border p-3 text-sm ${available ? 'border-blue-300 bg-blue-50 text-blue-800' : 'border-amber-300 bg-amber-50 text-amber-800'}`}>{hostNotice}</div>}\n      {hostPreflightWarning && <div role='alert' className='flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800'><AlertCircle className='mt-0.5 h-4 w-4 shrink-0' />{hostPreflightWarning}</div>}\n",
    'Try It preflight warning');
  return source;
});

edit('docs/host-execution-operations.md', (source) => once(source,
  "When native host execution must remain enabled but operators do not want ordinary interactive Try It requests to take the additional browser -> API-host -> target hop, the Node host can set `tryIt.hostExecution.preferHostExecution: false`. Host-only features still require host execution; this knob only keeps ordinary requests on direct browser transport. Omitting the option keeps the 3.3 default (`true`).\n\n",
  "When native host execution must remain enabled but operators do not want ordinary interactive Try It requests to take the additional browser -> API-host -> target hop, the Node host can set `tryIt.hostExecution.preferHostExecution: false`. Host-only features still require host execution; this knob only keeps ordinary requests on direct browser transport. Omitting the option keeps the 3.3 default (`true`).\n\n### Execute-route preflight\n\nInteractive API Client and Try It surfaces probe an advertised execute endpoint once per browser page before it is needed. The probe sends the normal `X-FlexDoc-Execute: 1` marker with an intentionally empty JSON envelope and same-origin credentials. A correctly mounted FlexDoc route rejects that envelope with its own HTTP 400 validation response; admission-control HTTP 429 also proves the protected route is reachable. The probe never contains a target request, so it cannot create an outbound API call.\n\nWarnings for authentication/authorization rejection, CSRF or body-middleware interception, missing/incorrect route mounts, redirects to login HTML, and transport failures are integration diagnostics. Keep the execute route under the same application-owned authentication/authorization boundary as the documentation subtree; do not weaken security middleware simply to silence the preflight.\n\n",
  'preflight operations docs'));

console.log('Applied UX-06 execute-route preflight staging transform.');
