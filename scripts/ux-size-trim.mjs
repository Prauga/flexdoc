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
  source = once(source, '  shouldUseHost: boolean;\n', '', 'redundant shouldUseHost type');
  source = once(source,
    "  const shouldUseHost = hostRequired || (preferHostExecution && options.hostExecution?.available === true);\n  return {\n    mode: hostRequired ? 'host-required' : shouldUseHost ? 'api-host' : 'browser',\n    shouldUseHost, hostAvailable, bodyNeedsHostTransport, missingCapabilities,\n  };",
    "  return {\n    mode: hostRequired ? 'host-required' : preferHostExecution && options.hostExecution?.available === true ? 'api-host' : 'browser',\n    hostAvailable, bodyNeedsHostTransport, missingCapabilities,\n  };",
    'resolver shouldUseHost runtime');
  source = once(source, '    if (transport.shouldUseHost) {', "    if (transport.mode !== 'browser') {", 'executor shouldUseHost check');
  return source;
});

edit('packages/client/src/components/ApiClient.tsx', (source) => {
  source = once(source,
    "import type { ApiClientExecutionResult } from '../utils/api-client-execution';",
    "import type { ApiClientExecutionResponse, ApiClientExecutionResult } from '../utils/api-client-execution';",
    'API Client execution response type import');
  source = once(source,
    "  const [response, setResponse] = useState<{ status: number; statusText: string; headers: Array<[string, string]>; body: string; responseTime: number; transport?: 'browser' | 'api-host' } | null>(null);",
    "  const [response, setResponse] = useState<ApiClientExecutionResponse | null>(null);",
    'API Client response state type');
  source = once(source,
    "  const hostCapabilities = new Set(hostExecution?.capabilities || []);\n",
    "  const hostCapabilities = hostExecution?.capabilities || [];\n",
    'API Client host capabilities allocation');
  source = once(source,
    "  const supportsHostCapability = (capability: HttpHostExecutionCapability) => hostExecution?.available === true && hostCapabilities.has(capability);",
    "  const supportsHostCapability = (capability: HttpHostExecutionCapability) => hostExecution?.available === true && hostCapabilities.includes(capability);",
    'API Client capability lookup');
  source = once(source,
    "      if (outcome.response) {\n        setResponse({\n          status: outcome.response.status,\n          statusText: outcome.response.statusText,\n          headers: outcome.response.headers.map(([key, value]) => [key, value]),\n          body: outcome.response.body,\n          responseTime: outcome.response.responseTime,\n          transport: outcome.response.transport,\n        });\n      }",
    "      if (outcome.response) setResponse(outcome.response);",
    'API Client response copy');
  return source;
});

edit('packages/client/src/components/RequestPlayground.tsx', (source) => {
  source = once(source,
    "import { executeApiClientRequest, resolveApiClientTransport } from '../utils/api-client-execution';",
    "import { executeApiClientRequest, resolveApiClientTransport } from '../utils/api-client-execution';\nimport type { ApiClientExecutionResponse } from '../utils/api-client-execution';",
    'Try It execution response type import');
  source = once(source,
    "  const [response, setResponse] = useState<{ status: number; statusText: string; headers: Array<[string, string]>; body: string; responseTime: number; transport?: 'browser' | 'api-host' } | null>(null);",
    "  const [response, setResponse] = useState<ApiClientExecutionResponse | null>(null);",
    'Try It response state type');
  source = once(source,
    "  const cookieRequiresHost = Object.values(values.cookies || {}).some((value) => value !== undefined && value !== null && String(value) !== '');",
    "  const cookieRequiresHost = Object.values(values.cookies || {}).some(Boolean);",
    'Try It cookie requirement');
  source = once(source,
    "      setResponse({\n        status: outcome.response.status,\n        statusText: outcome.response.statusText,\n        headers: outcome.response.headers.map(([key, value]) => [key, value]),\n        body: outcome.response.body,\n        responseTime: outcome.response.responseTime,\n        transport: outcome.response.transport,\n      });",
    "      setResponse(outcome.response);",
    'Try It response copy');
  return source;
});

console.log('Applied transport UX size trim.');
