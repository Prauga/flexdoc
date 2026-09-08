import React, { useEffect, useId, useRef, useState } from 'react';
import { AlertCircle, Play, Plus, Square, Trash2 } from 'lucide-react';
import { CodeBlock } from './CodeBlock';
import { OAuthEditor } from './ApiClientAuthEditor';
import { ApiClientBodyEditor } from './ApiClientBodyEditor';
import { ApiClientResponseViewer } from './ApiClientResponseViewer';
import { ApiClientScriptEditor } from './ApiClientScriptEditor';
import { executeApiClientRequest } from '../utils/api-client-execution';
import { buildHttpRequest, httpHostExecutionRequirements, inferHttpBodyMode } from '../utils/http-client';
import { cloneApiClientScripts } from '../utils/api-client-scripting';
import { replaceRequestServer, requestUsesServer, resolveServerUrl } from '../utils/server-url';
import type { ApiClientExecutionResult } from '../utils/api-client-execution';
import type { HttpAuth, HttpHostExecutionCapability, HttpKeyValue, HttpRequestDraft, HttpVariables } from '../utils/http-client';
import type { ApiClientRequestScripts, ApiClientScriptCollectionChange, ApiClientScriptEnvironmentChange, ApiClientScriptTestResult } from '../utils/api-client-scripting';
import type { BuiltRequest } from '../utils/request-builder';
import type { FlexDocHostExecutionPublicOptions, FlexDocMessages } from '../types/options';
import type { Server } from '../types/openapi';

export type { ApiClientExecutionResult } from '../utils/api-client-execution';
/** Request-configuration tab ids supported by the low-level API Client editor. */
export type ApiClientRequestTab = 'params' | 'headers' | 'authorization' | 'body' | 'scripts';
/** Script-phase tab ids supported by the API Client script editor. */
export type ApiClientScriptTab = 'pre-request' | 'tests';

/** Props for the low-level API request editor/executor without workspace persistence. */
export interface ApiClientProps {
  /** Initial request draft shown in the editor. */ initialRequest?: Partial<HttpRequestDraft>;
  /** Initial pre-request/test scripts shown in the script editor. */ initialScripts?: Partial<ApiClientRequestScripts>;
  /** Request-configuration tab selected on first render. */ initialRequestTab?: ApiClientRequestTab;
  /** Script-phase tab selected on first render; inferred from populated scripts when omitted. */ initialScriptTab?: ApiClientScriptTab;
  /** Light or dark API Client chrome. */ theme?: 'light' | 'dark';
  /** `basic` hides advanced scripting/host-auth controls; `advanced` exposes the full client surface. */ density?: 'basic' | 'advanced';
  /** Renderer-owned chrome translations reused by API Client controls and status messages. */ messages?: FlexDocMessages;
  /** Browser Fetch credentials mode used for direct request execution. */ credentials?: RequestCredentials;
  /** Hook that may rewrite URL or Fetch init immediately before direct browser execution. */ requestInterceptor?: (request: RequestInit & { url: string }) => RequestInit & { url: string } | Promise<RequestInit & { url: string }>;
  /** Called whenever the current draft can be built into a canonical transport request, and immediately before direct execution. */ onRequestChange?: (request: BuiltRequest) => void;
  /** Called with an independent clone whenever editable request state changes. */ onDraftChange?: (draft: HttpRequestDraft) => void;
  /** Called with an independent script snapshot whenever pre-request/test source changes. */ onScriptsChange?: (scripts: ApiClientRequestScripts) => void;
  /** Called after the active request-configuration tab changes. */ onRequestTabChange?: (tab: ApiClientRequestTab) => void;
  /** Called after the active script-phase tab changes. */ onScriptTabChange?: (tab: ApiClientScriptTab) => void;
  /** Called immediately before execution state is reset and transport begins. */ onExecutionStart?: () => void;
  /** Called when an execution produces a history-ready result, including failed transport attempts recorded by the execution engine. */ onExecutionComplete?: (result: ApiClientExecutionResult) => void;
  /** Resolve inherited collection/folder authentication before preview/request construction. */ resolveAuth?: (auth: HttpAuth | undefined) => HttpAuth;
  /** Effective merged variables used to resolve `{{name}}` placeholders. */ variables?: HttpVariables;
  /** Collection-scoped variables exposed to request scripts. */ collectionVariables?: HttpVariables;
  /** External/host-supplied variables exposed to request scripts. */ externalVariables?: HttpVariables;
  /** Active environment variables exposed to request scripts. */ environmentVariables?: HttpVariables;
  /** Called with collection-variable mutations emitted by scripts. */ onCollectionChanges?: (changes: ApiClientScriptCollectionChange[]) => void;
  /** Called with environment-variable mutations emitted by scripts. */ onEnvironmentChanges?: (changes: ApiClientScriptEnvironmentChange[]) => void;
  /** OpenAPI server definitions offered by the server selector. */ serverOptions?: Server[];
  /** Initial effective/custom server URL used to rewrite the request base URL. */ initialServerUrl?: string;
  /** Called whenever the effective server URL changes. */ onServerUrlChange?: (serverUrl: string) => void;
  /** Public API-host execution endpoint/capabilities used for browser-incompatible auth, cookies, certificates, and unusual bodies. */ hostExecution?: FlexDocHostExecutionPublicOptions;
}

const emptyPair = (): HttpKeyValue => ({ key: '', value: '', enabled: true });

function withDefaults(initialRequest?: Partial<HttpRequestDraft>): HttpRequestDraft {
  return {
    method: initialRequest?.method || 'GET',
    url: initialRequest?.url || '',
    query: initialRequest?.query?.map((entry) => ({ ...entry })) || [],
    headers: initialRequest?.headers?.map((entry) => ({ ...entry })) || [],
    body: initialRequest?.body || '',
    contentType: initialRequest?.contentType || 'application/json',
    bodyMode: initialRequest?.bodyMode || inferHttpBodyMode(initialRequest || {}),
    urlencoded: initialRequest?.urlencoded?.length ? initialRequest.urlencoded.map((entry) => ({ ...entry })) : undefined,
    formData: initialRequest?.formData?.length ? initialRequest.formData.map((entry) => ({ ...entry })) : undefined,
    binary: initialRequest?.binary ? { ...initialRequest.binary } : undefined,
    graphql: initialRequest?.graphql ? { ...initialRequest.graphql } : undefined,
    auth: initialRequest?.auth || { type: 'none' },
    hostExecution: initialRequest?.hostExecution ? { ...initialRequest.hostExecution } : undefined,
  };
}

function cloneDraft(draft: HttpRequestDraft): HttpRequestDraft {
  const auth = draft.auth
    ? draft.auth.type === 'oauth2'
      ? { ...draft.auth, scopes: draft.auth.scopes ? [...draft.auth.scopes] : undefined }
      : { ...draft.auth }
    : undefined;
  return {
    ...draft,
    query: draft.query?.map((entry) => ({ ...entry })),
    headers: draft.headers?.map((entry) => ({ ...entry })),
    urlencoded: draft.urlencoded?.map((entry) => ({ ...entry })),
    formData: draft.formData?.map((entry) => ({ ...entry })),
    binary: draft.binary ? { ...draft.binary } : undefined,
    graphql: draft.graphql ? { ...draft.graphql } : undefined,
    auth,
    hostExecution: draft.hostExecution ? { ...draft.hostExecution } : undefined,
  };
}

function requestOrigin(url: string): string {
  try { return new URL(url).origin; } catch { return ''; }
}

function parseBulkPairs(kind: 'query' | 'headers', source: string): HttpKeyValue[] {
  if (kind === 'query') {
    const normalized = source.trim().replace(/^\?/, '').replace(/\r?\n/g, '&');
    if (!normalized) return [];
    return [...new URLSearchParams(normalized).entries()].map(([key, value]) => ({ key, value, enabled: true }));
  }
  return source.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).flatMap((line) => {
    const separator = line.indexOf(':');
    if (separator <= 0) return [];
    return [{ key: line.slice(0, separator).trim(), value: line.slice(separator + 1).trim(), enabled: true }];
  });
}

function PairEditor({ kind, label, entries, onChange, inputClass, mutedClass }: { kind: 'query' | 'headers'; label: string; entries: HttpKeyValue[]; onChange: (entries: HttpKeyValue[]) => void; inputClass: string; mutedClass: string }) {
  const [bulkValue, setBulkValue] = useState('');
  const update = (index: number, patch: Partial<HttpKeyValue>) => onChange(entries.map((entry, i) => i === index ? { ...entry, ...patch } : entry));
  const applyBulk = () => {
    const parsed = parseBulkPairs(kind, bulkValue);
    if (!parsed.length) return;
    onChange(parsed);
    setBulkValue('');
  };
  return <div className='space-y-3'>
    <div className='flex flex-wrap items-center justify-between gap-2'>
      <span className='text-sm font-medium'>{label}</span>
      <button type='button' className='inline-flex min-h-11 items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm' onClick={() => onChange([...entries, emptyPair()])}><Plus className='h-4 w-4' /> Add</button>
    </div>
    {entries.length === 0 && <div className={`rounded-md border border-dashed p-3 text-sm ${mutedClass}`}>No {kind === 'query' ? 'query parameters' : 'headers'} configured.</div>}
    {entries.map((entry, index) => <div className='grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2 sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_auto]' key={index}>
      <input className='mt-3' aria-label={`${label} ${index + 1} enabled`} type='checkbox' checked={entry.enabled !== false} onChange={(e) => update(index, { enabled: e.target.checked })} />
      <input aria-label={`${label} ${index + 1} key`} className={`min-w-0 w-full rounded-md border px-3 py-2 text-sm ${inputClass}`} placeholder='Key' value={entry.key} onChange={(e) => update(index, { key: e.target.value })} />
      <input aria-label={`${label} ${index + 1} value`} className={`col-start-2 min-w-0 w-full rounded-md border px-3 py-2 text-sm sm:col-start-auto ${inputClass}`} placeholder='Value' value={entry.value} onChange={(e) => update(index, { value: e.target.value })} />
      <button type='button' aria-label={`Remove ${label.toLowerCase()} ${index + 1}`} className='col-start-3 row-start-1 inline-flex min-h-11 items-center justify-center rounded-md border px-3 py-2 sm:col-start-auto sm:row-start-auto' onClick={() => onChange(entries.filter((_, i) => i !== index))}><Trash2 className='h-4 w-4' /></button>
    </div>)}
    <details className='rounded-md border p-3'>
      <summary className='cursor-pointer text-xs font-medium'>Bulk edit</summary>
      <div className='mt-2 space-y-2'>
        <textarea aria-label={`${label} bulk editor`} className={`min-h-24 w-full rounded-md border px-3 py-2 font-mono text-xs ${inputClass}`} placeholder={kind === 'query' ? 'a=1&b=2' : 'Accept: application/json\nX-Trace: abc123'} value={bulkValue} onChange={(event) => setBulkValue(event.target.value)} />
        <div className='flex items-center justify-between gap-2'>
          <span className={`text-xs ${mutedClass}`}>{kind === 'query' ? 'Paste query-string pairs; applying replaces the current rows.' : 'Paste raw Header: value lines; applying replaces the current rows.'}</span>
          <button type='button' className='rounded-md border px-3 py-1.5 text-xs' disabled={!bulkValue.trim()} onClick={applyBulk}>Apply</button>
        </div>
      </div>
    </details>
  </div>;
}

function configuredPairCount(entries: HttpKeyValue[] | undefined): number {
  return (entries || []).filter((entry) => entry.enabled !== false && entry.key.trim()).length;
}

function urlVariableState(url: string, variables: HttpVariables): { names: string[]; missing: string[]; resolved: string } {
  const names = [...url.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)].map((match) => match[1].trim());
  const unique = [...new Set(names)];
  const missing = unique.filter((name) => !Object.prototype.hasOwnProperty.call(variables, name));
  const resolved = url.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (match, rawName: string) => {
    const name = rawName.trim();
    return Object.prototype.hasOwnProperty.call(variables, name) ? variables[name] : match;
  });
  return { names: unique, missing, resolved };
}

/** Low-level HTTP request editor and executor without workspace persistence. */
export const ApiClient: React.FC<ApiClientProps> = ({
  initialRequest,
  initialScripts,
  initialRequestTab = 'params',
  initialScriptTab,
  theme = 'light',
  density = 'advanced',
  messages,
  credentials = 'same-origin',
  requestInterceptor,
  onRequestChange,
  onDraftChange,
  onScriptsChange,
  onRequestTabChange,
  onScriptTabChange,
  onExecutionStart,
  onExecutionComplete,
  resolveAuth,
  variables = {},
  collectionVariables = {},
  externalVariables = {},
  environmentVariables = {},
  onCollectionChanges,
  onEnvironmentChanges,
  serverOptions = [],
  initialServerUrl,
  onServerUrlChange,
  hostExecution,
}) => {
  const initialDraft = withDefaults(initialRequest);
  const initialScriptState = cloneApiClientScripts(initialScripts);
  const serverChoices = serverOptions.map((server) => ({ server, url: resolveServerUrl(server) }));
  const configuredServerUrls = serverChoices.map((choice) => choice.url);
  const inferredServerUrl = initialServerUrl || configuredServerUrls.find((serverUrl) => requestUsesServer(initialDraft.url, serverUrl)) || '';
  const configuredDefault = configuredServerUrls.includes(inferredServerUrl) ? inferredServerUrl : configuredServerUrls[0] || '';
  const initialCustomServer = inferredServerUrl && !configuredServerUrls.includes(inferredServerUrl) ? inferredServerUrl : '';
  const initialEffectiveServer = inferredServerUrl || configuredDefault || requestOrigin(initialDraft.url);
  const [draft, setDraft] = useState<HttpRequestDraft>(initialDraft);
  const [scripts, setScripts] = useState<ApiClientRequestScripts>(initialScriptState);
  const [configuredServerUrl, setConfiguredServerUrl] = useState(configuredDefault);
  const [customServerUrl, setCustomServerUrl] = useState(initialCustomServer);
  const serverUrlRef = useRef(initialEffectiveServer);
  const originalServerUrlRef = useRef(initialEffectiveServer);
  const [response, setResponse] = useState<{ status: number; statusText: string; headers: Array<[string, string]>; body: string; responseTime: number } | null>(null);
  const [curlCommand, setCurlCommand] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [scriptError, setScriptError] = useState<string | null>(null);
  const [scriptTests, setScriptTests] = useState<ApiClientScriptTestResult[]>([]);
  const [scriptLogs, setScriptLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const onRequestChangeRef = useRef(onRequestChange);
  const onDraftChangeRef = useRef(onDraftChange);
  const onScriptsChangeRef = useRef(onScriptsChange);
  const lastRequestSignatureRef = useRef<string | null>(null);
  const [requestTab, setRequestTab] = useState<ApiClientRequestTab>(initialRequestTab);
  const [scriptTab, setScriptTab] = useState<ApiClientScriptTab>(() => initialScriptTab || (initialScriptState.tests.trim() && !initialScriptState.preRequest.trim() ? 'tests' : 'pre-request'));
  const requestTabRefs = useRef<Partial<Record<ApiClientRequestTab, HTMLButtonElement | null>>>({});
  const scriptTabRefs = useRef<Partial<Record<ApiClientScriptTab, HTMLButtonElement | null>>>({});
  const requestId = useId().replace(/:/g, '');
  const scriptId = useId().replace(/:/g, '');

  useEffect(() => { onRequestChangeRef.current = onRequestChange; }, [onRequestChange]);
  useEffect(() => { onDraftChangeRef.current = onDraftChange; }, [onDraftChange]);
  useEffect(() => { onScriptsChangeRef.current = onScriptsChange; }, [onScriptsChange]);
  useEffect(() => { onDraftChangeRef.current?.(cloneDraft(draft)); }, [draft]);
  useEffect(() => { onScriptsChangeRef.current?.(cloneApiClientScripts(scripts)); }, [scripts]);
  useEffect(() => {
    try {
      const previewDraft = resolveAuth ? { ...draft, auth: resolveAuth(draft.auth) } : draft;
      const request = buildHttpRequest(previewDraft, { variables });
      const signature = JSON.stringify([
        request.method,
        request.url,
        request.headerEntries,
        request.body,
        request.bodyKind,
      ]);
      if (signature === lastRequestSignatureRef.current) return;
      lastRequestSignatureRef.current = signature;
      onRequestChangeRef.current?.(request);
    } catch { /* an empty or unresolved URL is valid while editing */ }
  }, [draft, resolveAuth, variables]);

  const method = (draft.method || 'GET').toUpperCase();
  const bodyUnusual = ['GET', 'HEAD'].includes(method);
  const inputClass = theme === 'dark' ? 'bg-gray-900 border-gray-700 text-gray-100' : 'bg-white border-gray-300 text-gray-900';
  const panelClass = theme === 'dark' ? 'border-gray-700 bg-gray-800/60 text-gray-100' : 'border-gray-200 bg-gray-50 text-gray-900';
  const mutedClass = theme === 'dark' ? 'text-gray-400' : 'text-gray-600';
  const effectiveRequestTab: ApiClientRequestTab = requestTab === 'scripts' && density !== 'advanced' ? 'params' : requestTab;
  const queryCount = configuredPairCount(draft.query);
  const headerCount = configuredPairCount(draft.headers);
  const hasAuth = !!draft.auth && draft.auth.type !== 'none' && draft.auth.type !== 'inherit';
  const hasBody = inferHttpBodyMode(draft) !== 'none';
  const hasScripts = !!(scripts.preRequest.trim() || scripts.tests.trim());
  const requestTabs: Array<{ id: ApiClientRequestTab; label: string; disabled?: boolean; count?: number; active?: boolean }> = [
    { id: 'params', label: 'Params', count: queryCount },
    { id: 'headers', label: 'Headers', count: headerCount },
    { id: 'authorization', label: 'Authorization', active: hasAuth },
    { id: 'body', label: 'Body', active: hasBody },
    { id: 'scripts', label: 'Scripts', active: hasScripts },
  ];
  const visibleRequestTabs = requestTabs.filter((tab) => density === 'advanced' || tab.id !== 'scripts');
  const requestTabId = (tab: ApiClientRequestTab) => `${requestId}-request-tab-${tab}`;
  const requestPanelId = (tab: ApiClientRequestTab) => `${requestId}-request-panel-${tab}`;
  const scriptTabId = (tab: ApiClientScriptTab) => `${scriptId}-script-tab-${tab}`;
  const scriptPanelId = (tab: ApiClientScriptTab) => `${scriptId}-script-panel-${tab}`;
  const urlState = urlVariableState(draft.url, variables);

  const selectRequestTab = (tab: ApiClientRequestTab) => {
    if (tab === 'scripts' && density !== 'advanced') return;
    setRequestTab(tab);
    onRequestTabChange?.(tab);
  };
  const selectScriptTab = (tab: ApiClientScriptTab) => {
    setScriptTab(tab);
    onScriptTabChange?.(tab);
  };
  const handleRequestTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, current: ApiClientRequestTab) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const enabled = visibleRequestTabs.filter((tab) => !tab.disabled).map((tab) => tab.id);
    const index = Math.max(0, enabled.indexOf(current));
    const next = event.key === 'Home' ? enabled[0]
      : event.key === 'End' ? enabled[enabled.length - 1]
        : event.key === 'ArrowRight' ? enabled[(index + 1) % enabled.length]
          : enabled[(index - 1 + enabled.length) % enabled.length];
    selectRequestTab(next);
    requestTabRefs.current[next]?.focus();
  };
  const handleScriptTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, current: ApiClientScriptTab) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const tabs: ApiClientScriptTab[] = ['pre-request', 'tests'];
    const index = tabs.indexOf(current);
    const next = event.key === 'Home' ? tabs[0]
      : event.key === 'End' ? tabs[tabs.length - 1]
        : event.key === 'ArrowRight' ? tabs[(index + 1) % tabs.length]
          : tabs[(index - 1 + tabs.length) % tabs.length];
    selectScriptTab(next);
    scriptTabRefs.current[next]?.focus();
  };

  const applyServer = (nextServerUrl: string) => {
    if (!nextServerUrl) return;
    const previousServerUrl = serverUrlRef.current;
    serverUrlRef.current = nextServerUrl;
    onServerUrlChange?.(nextServerUrl);
    setDraft((current) => ({ ...current, url: replaceRequestServer(current.url, previousServerUrl, nextServerUrl) }));
  };

  const setAuthType = (type: HttpAuth['type']) => {
    const auth: HttpAuth = type === 'inherit' ? { type: 'inherit' }
      : type === 'bearer' ? { type, token: '' }
      : type === 'oauth2' ? { type, accessToken: '' }
      : type === 'basic' ? { type, username: '', password: '' }
      : type === 'apiKey' ? { type, key: '', value: '', in: 'header' }
      : type === 'digest' ? { type, username: '', password: '' }
      : type === 'hawk' ? { type, id: '', key: '', algorithm: 'sha256' }
      : type === 'ntlm' ? { type, username: '', password: '' }
      : type === 'oauth1' ? { type, consumerKey: '', consumerSecret: '', signatureMethod: 'HMAC-SHA1' }
      : type === 'awsv4' ? { type, accessKey: '', secretKey: '', region: '', service: '' }
      : { type: 'none' };
    setDraft((current) => ({ ...current, auth }));
  };

  const resolvedAuth = resolveAuth ? resolveAuth(draft.auth) : draft.auth;
  const hostRequirements = httpHostExecutionRequirements({ ...draft, auth: resolvedAuth });
  const hostCapabilities = new Set(hostExecution?.capabilities || []);
  const missingHostCapabilities = hostRequirements.filter((requirement) => !hostCapabilities.has(requirement));
  const bodyNeedsHostTransport = bodyUnusual && hasBody;
  const hostRequired = hostRequirements.length > 0;
  const hostAvailable = hostExecution?.available === true && missingHostCapabilities.length === 0;
  const hostNotice = bodyNeedsHostTransport
    ? hostExecution?.available
      ? messages?.unusualBodyHostExecution || `${method} request bodies are unusual. FlexDoc will use API-host execution so the body can be sent.`
      : messages?.unusualBodyBrowserWarning || `${method} request bodies are unusual. Browser fetch may reject this request; enable API-host execution to send it reliably.`
    : hostRequired
    ? hostAvailable
      ? messages?.hostBrowserUnsupported || 'The browser cannot send this request. FlexDoc will execute it from the API host.'
      : hostExecution?.available
        ? `The API host does not support the required capability${missingHostCapabilities.length === 1 ? '' : 'ies'}: ${missingHostCapabilities.join(', ')}.`
        : messages?.hostExecutionDisabled || 'Host execution is disabled on this documentation server.'
    : null;
  const supportsHostCapability = (capability: HttpHostExecutionCapability) => hostExecution?.available === true && hostCapabilities.has(capability);

  const execute = async () => {
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
      const outcome = await executeApiClientRequest({
        request: draft,
        scripts,
        credentials,
        requestInterceptor,
        resolveAuth,
        variables,
        collectionVariables,
        externalVariables,
        environmentVariables,
        hostExecution,
        signal: controller.signal,
        onRequestBuilt: (request) => onRequestChangeRef.current?.(request),
        onCollectionChanges,
        onEnvironmentChanges,
      });
      if (controller.signal.aborted) { setError(messages?.requestCancelled || 'Request cancelled.'); return; }
      setError(outcome.error || null);
      setScriptError(outcome.scriptError || null);
      setScriptTests(outcome.scriptTests);
      setScriptLogs(outcome.scriptLogs);
      if (outcome.response) {
        setCurlCommand(outcome.curlCommand);
        setResponse({
          status: outcome.response.status,
          statusText: outcome.response.statusText,
          headers: outcome.response.headers.map(([key, value]) => [key, value]),
          body: outcome.response.body,
          responseTime: outcome.response.responseTime,
        });
      }
      if (outcome.result) onExecutionComplete?.(outcome.result);
    } finally {
      if (abortControllerRef.current === controller) abortControllerRef.current = null;
      setLoading(false);
    }
  };

  const cancel = () => abortControllerRef.current?.abort();

  const passedTests = scriptTests.filter((test) => test.passed).length;
  const canExecute = !loading && !(hostRequired && !hostAvailable);

  return <div
    className={`min-w-0 rounded-xl border p-4 md:p-5 ${panelClass}`}
    data-api-client-editor
    onKeyDown={(event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && canExecute) {
        event.preventDefault();
        void execute();
      }
    }}
  >
    <div className='flex flex-col gap-4'>
      <div className='grid gap-2 sm:grid-cols-2'>
        {serverOptions.length > 0 && <label className='text-sm font-medium'>Server
          <select aria-label='API Client server' className={`mt-1 w-full rounded-md border px-3 py-2 text-sm ${inputClass}`} value={configuredServerUrl} onChange={(e) => {
            setConfiguredServerUrl(e.target.value);
            setCustomServerUrl('');
            applyServer(e.target.value);
          }}>
            {serverChoices.map(({ server, url }) => <option key={`${server.url}:${url}`} value={url}>{server.description ? `${server.description} — ` : ''}{server.url}</option>)}
          </select>
        </label>}
        <label className='text-sm font-medium'>Custom server URL <span className='text-xs font-normal opacity-70'>(optional override)</span>
          <input aria-label='API Client custom server URL' className={`mt-1 w-full rounded-md border px-3 py-2 font-mono text-sm ${inputClass}`} value={customServerUrl} onChange={(e) => {
            const value = e.target.value;
            setCustomServerUrl(value);
            const fallback = configuredServerUrl || originalServerUrlRef.current;
            if (value.trim() || fallback) applyServer(value.trim() || fallback);
          }} placeholder='http://localhost:8080' />
        </label>
      </div>

      <div className='grid min-w-0 gap-2 sm:grid-cols-[auto_minmax(0,1fr)]'>
        <select aria-label='HTTP method' className={`rounded-md border px-3 py-2 font-medium ${inputClass}`} value={method} onChange={(e) => { const value = e.target.value; setDraft((current) => ({ ...current, method: value })); }}>
          {['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].map((item) => <option key={item}>{item}</option>)}
        </select>
        <input aria-label='Request URL' className={`w-full rounded-md border px-3 py-2 font-mono text-sm ${inputClass}`} placeholder='https://api.example.com/resource or {{baseUrl}}/resource' value={draft.url} onChange={(e) => { const value = e.target.value; setDraft((current) => ({ ...current, url: value })); }} />
      </div>
      {urlState.names.length > 0 && <div className={`rounded-md border px-3 py-2 text-xs ${urlState.missing.length ? (theme === 'dark' ? 'border-amber-800 bg-amber-950/40 text-amber-200' : 'border-amber-300 bg-amber-50 text-amber-800') : (theme === 'dark' ? 'border-gray-700 bg-gray-900 text-gray-300' : 'border-gray-200 bg-white text-gray-600')}`}>
        {urlState.missing.length > 0 ? <>Missing URL variable{urlState.missing.length === 1 ? '' : 's'}: <strong>{urlState.missing.join(', ')}</strong>.</> : <>Resolved URL: <code className='break-all'>{urlState.resolved}</code></>}
      </div>}

      <div className='-mx-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden' data-api-client-request-tabs>
        <div className={`flex min-w-max gap-1 rounded-lg border p-1 ${theme === 'dark' ? 'border-gray-700 bg-gray-900/70' : 'border-gray-200 bg-white'}`} role='tablist' aria-label='Request configuration'>
          {visibleRequestTabs.map((tab) => <button
            ref={(node) => { requestTabRefs.current[tab.id] = node; }}
            id={requestTabId(tab.id)}
            key={tab.id}
            type='button'
            role='tab'
            aria-controls={requestPanelId(tab.id)}
            aria-label={tab.label}
            aria-selected={effectiveRequestTab === tab.id}
            tabIndex={effectiveRequestTab === tab.id ? 0 : -1}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition ${effectiveRequestTab === tab.id ? 'bg-blue-600 text-white shadow-sm' : (theme === 'dark' ? 'text-gray-300 hover:bg-gray-800' : 'text-gray-600 hover:bg-gray-100')}`}
            onClick={() => selectRequestTab(tab.id)}
            onKeyDown={(event) => handleRequestTabKeyDown(event, tab.id)}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && tab.count > 0 && <span className={`rounded-full px-1.5 text-[10px] leading-5 ${effectiveRequestTab === tab.id ? 'bg-white/20 text-white' : (theme === 'dark' ? 'bg-gray-700 text-gray-200' : 'bg-gray-200 text-gray-700')}`}>{tab.count}</span>}
            {tab.active && tab.count === undefined && <span aria-label='Configured' className={`h-1.5 w-1.5 rounded-full ${effectiveRequestTab === tab.id ? 'bg-white' : 'bg-blue-500'}`} />}
          </button>)}
        </div>
      </div>
      {bodyUnusual && <p className={`-mt-2 text-xs ${mutedClass}`}>{messages?.unusualBodyAdvisory || `${method} request bodies are unusual and may be ignored or rejected by servers or intermediaries. FlexDoc keeps the body; API-host execution can send it when available, while browser fetch may reject it.`}</p>}

      {effectiveRequestTab === 'params' && <div role='tabpanel' id={requestPanelId('params')} aria-labelledby={requestTabId('params')}><PairEditor kind='query' label='Query parameters' entries={draft.query || []} onChange={(query) => setDraft((current) => ({ ...current, query }))} inputClass={inputClass} mutedClass={mutedClass} /></div>}
      {effectiveRequestTab === 'headers' && <div role='tabpanel' id={requestPanelId('headers')} aria-labelledby={requestTabId('headers')}><PairEditor kind='headers' label='Headers' entries={draft.headers || []} onChange={(headers) => setDraft((current) => ({ ...current, headers }))} inputClass={inputClass} mutedClass={mutedClass} /></div>}

      {effectiveRequestTab === 'authorization' && <div role='tabpanel' id={requestPanelId('authorization')} aria-labelledby={requestTabId('authorization')} className='space-y-3'>
        <label className='text-sm font-medium'>Authorization
          <select aria-label='Authorization type' className={`rounded-md border px-3 py-2 text-sm ${inputClass}`} value={draft.auth?.type || 'none'} onChange={(e) => setAuthType(e.target.value as HttpAuth['type'])}>
            {resolveAuth && <option value='inherit'>Inherit from parent</option>}
            <option value='none'>None</option><option value='bearer'>Bearer token</option><option value='basic'>Basic auth</option><option value='apiKey'>API key</option>
            {(density === 'advanced' || draft.auth?.type === 'oauth2') && <option value='oauth2'>OAuth 2.0 access token</option>}
            {density === 'advanced' && <><option value='digest' disabled={!supportsHostCapability('digest')}>Digest (API host)</option><option value='hawk' disabled={!supportsHostCapability('hawk')}>Hawk (API host)</option><option value='ntlm' disabled={!supportsHostCapability('ntlm')}>NTLM / Negotiate (API host)</option><option value='oauth1' disabled={!supportsHostCapability('oauth1')}>OAuth 1.0 (API host)</option><option value='awsv4' disabled={!supportsHostCapability('awsv4')}>AWS Signature v4 (API host)</option></>}
          </select>
        </label>
        {draft.auth?.type === 'bearer' && <input aria-label='Bearer token' type='password' autoComplete='off' className={`w-full rounded-md border px-3 py-2 ${inputClass}`} value={draft.auth.token} onChange={(e) => { const token = e.target.value; setDraft((current) => ({ ...current, auth: { type: 'bearer', token } })); }} />}
        {(density === 'advanced' || draft.auth?.type === 'oauth2') && draft.auth?.type === 'oauth2' && <OAuthEditor auth={draft.auth} fieldClass={`w-full rounded-md border px-3 py-2 text-sm ${inputClass}`} label='' onChange={(auth) => setDraft((current) => ({ ...current, auth }))} />}
        {draft.auth?.type === 'basic' && <div className='flex gap-2'><input aria-label='Basic auth username' className={`w-full rounded-md border px-3 py-2 ${inputClass}`} placeholder='Username' value={draft.auth.username} onChange={(e) => setDraft((current) => ({ ...current, auth: { ...(current.auth as Extract<HttpAuth, { type: 'basic' }>), username: e.target.value } }))} /><input aria-label='Basic auth password' type='password' autoComplete='off' className={`w-full rounded-md border px-3 py-2 ${inputClass}`} placeholder='Password' value={draft.auth.password} onChange={(e) => setDraft((current) => ({ ...current, auth: { ...(current.auth as Extract<HttpAuth, { type: 'basic' }>), password: e.target.value } }))} /></div>}
        {draft.auth?.type === 'apiKey' && <div className='flex gap-2'><input aria-label='API key name' className={`w-full rounded-md border px-3 py-2 ${inputClass}`} placeholder='Key name' value={draft.auth.key} onChange={(e) => setDraft((current) => ({ ...current, auth: { ...(current.auth as Extract<HttpAuth, { type: 'apiKey' }>), key: e.target.value } }))} /><input aria-label='API key value' type='password' autoComplete='off' className={`w-full rounded-md border px-3 py-2 ${inputClass}`} placeholder='Value' value={draft.auth.value} onChange={(e) => setDraft((current) => ({ ...current, auth: { ...(current.auth as Extract<HttpAuth, { type: 'apiKey' }>), value: e.target.value } }))} /><select aria-label='API key location' className={`rounded-md border px-3 py-2 text-sm ${inputClass}`} value={draft.auth.in} onChange={(e) => setDraft((current) => ({ ...current, auth: { ...(current.auth as Extract<HttpAuth, { type: 'apiKey' }>), in: e.target.value as 'header' | 'query' | 'cookie' } }))}><option value='header'>Header</option><option value='query'>Query</option><option value='cookie' disabled={!supportsHostCapability('cookies')}>Cookie (API host)</option></select></div>}
        {draft.auth?.type === 'digest' && <div className='grid grid-cols-2 gap-2'><input aria-label='Digest username' className={`rounded-md border px-3 py-2 ${inputClass}`} placeholder='Username' value={draft.auth.username} onChange={(e) => setDraft((current) => ({ ...current, auth: { ...(current.auth as Extract<HttpAuth, { type: 'digest' }>), username: e.target.value } }))} /><input aria-label='Digest password' type='password' autoComplete='off' className={`rounded-md border px-3 py-2 ${inputClass}`} placeholder='Password' value={draft.auth.password} onChange={(e) => setDraft((current) => ({ ...current, auth: { ...(current.auth as Extract<HttpAuth, { type: 'digest' }>), password: e.target.value } }))} /></div>}
        {draft.auth?.type === 'hawk' && <div className='grid gap-2 sm:grid-cols-2'><input aria-label='Hawk id' className={`rounded-md border px-3 py-2 ${inputClass}`} placeholder='ID' value={draft.auth.id} onChange={(e) => setDraft((current) => ({ ...current, auth: { ...(current.auth as Extract<HttpAuth, { type: 'hawk' }>), id: e.target.value } }))} /><input aria-label='Hawk key' type='password' autoComplete='off' className={`rounded-md border px-3 py-2 ${inputClass}`} placeholder='Key' value={draft.auth.key} onChange={(e) => setDraft((current) => ({ ...current, auth: { ...(current.auth as Extract<HttpAuth, { type: 'hawk' }>), key: e.target.value } }))} /><select aria-label='Hawk algorithm' className={`rounded-md border px-3 py-2 ${inputClass}`} value={draft.auth.algorithm || 'sha256'} onChange={(e) => setDraft((current) => ({ ...current, auth: { ...(current.auth as Extract<HttpAuth, { type: 'hawk' }>), algorithm: e.target.value as 'sha1' | 'sha256' } }))}><option value='sha256'>SHA-256</option><option value='sha1'>SHA-1</option></select><input aria-label='Hawk ext' className={`rounded-md border px-3 py-2 ${inputClass}`} placeholder='ext (optional)' value={draft.auth.ext || ''} onChange={(e) => setDraft((current) => ({ ...current, auth: { ...(current.auth as Extract<HttpAuth, { type: 'hawk' }>), ext: e.target.value } }))} /></div>}
        {draft.auth?.type === 'ntlm' && <div className='grid gap-2 sm:grid-cols-2'><input aria-label='NTLM username' className={`rounded-md border px-3 py-2 ${inputClass}`} placeholder='Username' value={draft.auth.username} onChange={(e) => setDraft((current) => ({ ...current, auth: { ...(current.auth as Extract<HttpAuth, { type: 'ntlm' }>), username: e.target.value } }))} /><input aria-label='NTLM password' type='password' autoComplete='off' className={`rounded-md border px-3 py-2 ${inputClass}`} placeholder='Password' value={draft.auth.password} onChange={(e) => setDraft((current) => ({ ...current, auth: { ...(current.auth as Extract<HttpAuth, { type: 'ntlm' }>), password: e.target.value } }))} /><input aria-label='NTLM domain' className={`rounded-md border px-3 py-2 ${inputClass}`} placeholder='Domain (optional)' value={draft.auth.domain || ''} onChange={(e) => setDraft((current) => ({ ...current, auth: { ...(current.auth as Extract<HttpAuth, { type: 'ntlm' }>), domain: e.target.value } }))} /><input aria-label='NTLM workstation' className={`rounded-md border px-3 py-2 ${inputClass}`} placeholder='Workstation (optional)' value={draft.auth.workstation || ''} onChange={(e) => setDraft((current) => ({ ...current, auth: { ...(current.auth as Extract<HttpAuth, { type: 'ntlm' }>), workstation: e.target.value } }))} /></div>}
        {draft.auth?.type === 'oauth1' && <div className='grid gap-2 sm:grid-cols-2'><input aria-label='OAuth1 consumer key' className={`rounded-md border px-3 py-2 ${inputClass}`} placeholder='Consumer key' value={draft.auth.consumerKey} onChange={(e) => setDraft((current) => ({ ...current, auth: { ...(current.auth as Extract<HttpAuth, { type: 'oauth1' }>), consumerKey: e.target.value } }))} /><input aria-label='OAuth1 consumer secret' type='password' autoComplete='off' className={`rounded-md border px-3 py-2 ${inputClass}`} placeholder='Consumer secret' value={draft.auth.consumerSecret} onChange={(e) => setDraft((current) => ({ ...current, auth: { ...(current.auth as Extract<HttpAuth, { type: 'oauth1' }>), consumerSecret: e.target.value } }))} /><input aria-label='OAuth1 token' className={`rounded-md border px-3 py-2 ${inputClass}`} placeholder='Token (optional)' value={draft.auth.token || ''} onChange={(e) => setDraft((current) => ({ ...current, auth: { ...(current.auth as Extract<HttpAuth, { type: 'oauth1' }>), token: e.target.value } }))} /><input aria-label='OAuth1 token secret' type='password' autoComplete='off' className={`rounded-md border px-3 py-2 ${inputClass}`} placeholder='Token secret (optional)' value={draft.auth.tokenSecret || ''} onChange={(e) => setDraft((current) => ({ ...current, auth: { ...(current.auth as Extract<HttpAuth, { type: 'oauth1' }>), tokenSecret: e.target.value } }))} /><select aria-label='OAuth1 signature method' className={`rounded-md border px-3 py-2 ${inputClass}`} value={draft.auth.signatureMethod || 'HMAC-SHA1'} onChange={(e) => setDraft((current) => ({ ...current, auth: { ...(current.auth as Extract<HttpAuth, { type: 'oauth1' }>), signatureMethod: e.target.value as 'HMAC-SHA1' | 'HMAC-SHA256' | 'PLAINTEXT' } }))}><option>HMAC-SHA1</option><option>HMAC-SHA256</option><option>PLAINTEXT</option></select><input aria-label='OAuth1 realm' className={`rounded-md border px-3 py-2 ${inputClass}`} placeholder='Realm (optional)' value={draft.auth.realm || ''} onChange={(e) => setDraft((current) => ({ ...current, auth: { ...(current.auth as Extract<HttpAuth, { type: 'oauth1' }>), realm: e.target.value } }))} /></div>}
        {draft.auth?.type === 'awsv4' && <div className='grid gap-2 sm:grid-cols-2'><input aria-label='AWS access key' className={`rounded-md border px-3 py-2 ${inputClass}`} placeholder='Access key' value={draft.auth.accessKey} onChange={(e) => setDraft((current) => ({ ...current, auth: { ...(current.auth as Extract<HttpAuth, { type: 'awsv4' }>), accessKey: e.target.value } }))} /><input aria-label='AWS secret key' type='password' autoComplete='off' className={`rounded-md border px-3 py-2 ${inputClass}`} placeholder='Secret key' value={draft.auth.secretKey} onChange={(e) => setDraft((current) => ({ ...current, auth: { ...(current.auth as Extract<HttpAuth, { type: 'awsv4' }>), secretKey: e.target.value } }))} /><input aria-label='AWS session token' type='password' autoComplete='off' className={`rounded-md border px-3 py-2 ${inputClass}`} placeholder='Session token (optional)' value={draft.auth.sessionToken || ''} onChange={(e) => setDraft((current) => ({ ...current, auth: { ...(current.auth as Extract<HttpAuth, { type: 'awsv4' }>), sessionToken: e.target.value } }))} /><input aria-label='AWS region' className={`rounded-md border px-3 py-2 ${inputClass}`} placeholder='Region' value={draft.auth.region} onChange={(e) => setDraft((current) => ({ ...current, auth: { ...(current.auth as Extract<HttpAuth, { type: 'awsv4' }>), region: e.target.value } }))} /><input aria-label='AWS service' className={`rounded-md border px-3 py-2 ${inputClass}`} placeholder='Service' value={draft.auth.service} onChange={(e) => setDraft((current) => ({ ...current, auth: { ...(current.auth as Extract<HttpAuth, { type: 'awsv4' }>), service: e.target.value } }))} /></div>}

        {density === 'advanced' && hostExecution?.available && <div className='grid gap-2 rounded-md border p-3 sm:grid-cols-2'>
          {hostExecution.clientCertificates?.length ? <label className='text-xs font-medium'>Client certificate<select aria-label='Client certificate' className={`mt-1 w-full rounded-md border px-2 py-1.5 ${inputClass}`} value={draft.hostExecution?.certificateId || ''} onChange={(e) => setDraft((current) => ({ ...current, hostExecution: { ...(current.hostExecution || {}), certificateId: e.target.value || undefined } }))}><option value=''>None</option>{hostExecution.clientCertificates.map((certificate) => <option key={certificate.id} value={certificate.id}>{certificate.name}</option>)}</select></label> : null}
          {supportsHostCapability('cookies') && <label className='inline-flex items-center gap-2 text-xs font-medium'><input aria-label='Use API host cookie jar' type='checkbox' checked={draft.hostExecution?.cookieJar === 'session'} onChange={(e) => setDraft((current) => ({ ...current, hostExecution: { ...(current.hostExecution || {}), cookieJar: e.target.checked ? 'session' : undefined } }))} />Use API host cookie jar</label>}
        </div>}
      </div>}

      {effectiveRequestTab === 'body' && <div role='tabpanel' id={requestPanelId('body')} aria-labelledby={requestTabId('body')}><ApiClientBodyEditor draft={draft} onChange={setDraft} theme={theme} /></div>}

      {density === 'advanced' && effectiveRequestTab === 'scripts' && <section role='tabpanel' id={requestPanelId('scripts')} aria-labelledby={requestTabId('scripts')} className='min-w-0 space-y-3'>
        <div>
          <h3 id='api-client-scripts-heading' className='font-semibold'>Scripts</h3>
          <p className={`text-xs ${mutedClass}`}>Trusted local JavaScript. Editors soft-wrap, keep indentation, format only when you choose Format or Shift+Alt+F, and show lightweight syntax diagnostics.</p>
        </div>
        <div className={`inline-flex max-w-full gap-1 rounded-lg border p-1 ${theme === 'dark' ? 'border-gray-700 bg-gray-900/70' : 'border-gray-200 bg-white'}`} role='tablist' aria-label='Script phase'>
          {(['pre-request', 'tests'] as ApiClientScriptTab[]).map((tab) => <button
            ref={(node) => { scriptTabRefs.current[tab] = node; }}
            id={scriptTabId(tab)}
            key={tab}
            type='button'
            role='tab'
            aria-controls={scriptPanelId(tab)}
            aria-selected={scriptTab === tab}
            tabIndex={scriptTab === tab ? 0 : -1}
            className={`rounded-md px-3 py-1.5 text-sm ${scriptTab === tab ? 'bg-blue-600 text-white' : ''}`}
            onClick={() => selectScriptTab(tab)}
            onKeyDown={(event) => handleScriptTabKeyDown(event, tab)}
          >{tab === 'pre-request' ? 'Pre-request' : 'Tests'}{(tab === 'pre-request' ? scripts.preRequest : scripts.tests).trim() && <span aria-label='Configured' className={`ml-1.5 inline-block h-1.5 w-1.5 rounded-full ${scriptTab === tab ? 'bg-white' : 'bg-blue-500'}`} />}</button>)}
        </div>
        {scriptTab === 'pre-request' ? <div role='tabpanel' id={scriptPanelId('pre-request')} aria-labelledby={scriptTabId('pre-request')} className='min-w-0'>
          <ApiClientScriptEditor
            ariaLabel='Pre-request script'
            phase='pre-request'
            theme={theme}
            value={scripts.preRequest}
            onChange={(value) => setScripts((current) => ({ ...current, preRequest: value }))}
            variableKeys={{
              environment: Object.keys(environmentVariables),
              collection: Object.keys(collectionVariables),
              variables: Object.keys(variables),
            }}
          />
        </div> : <div role='tabpanel' id={scriptPanelId('tests')} aria-labelledby={scriptTabId('tests')} className='min-w-0'>
          <ApiClientScriptEditor
            ariaLabel='Tests script'
            phase='tests'
            theme={theme}
            value={scripts.tests}
            onChange={(value) => setScripts((current) => ({ ...current, tests: value }))}
            variableKeys={{
              environment: Object.keys(environmentVariables),
              collection: Object.keys(collectionVariables),
              variables: Object.keys(variables),
            }}
          />
        </div>}
      </section>}

      {hostNotice && <div role={bodyNeedsHostTransport ? 'status' : hostAvailable ? 'status' : 'alert'} aria-label={messages?.hostExecutionStatus || 'Host execution status'} className={`rounded-md border p-3 text-sm ${hostAvailable ? (theme === 'dark' ? 'border-blue-800 bg-blue-950/40 text-blue-200' : 'border-blue-300 bg-blue-50 text-blue-800') : (theme === 'dark' ? 'border-amber-800 bg-amber-950/40 text-amber-200' : 'border-amber-300 bg-amber-50 text-amber-800')}`}>{hostNotice}</div>}

      {loading ? <button type='button' onClick={cancel} className='inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-red-500 px-4 py-2 font-medium text-red-600 sm:w-auto'><Square className='h-4 w-4' />{messages?.cancelRequest || 'Cancel request'}</button> : <button type='button' data-api-client-send='true' onClick={() => { void execute(); }} disabled={!canExecute} aria-keyshortcuts='Control+Enter Meta+Enter' title={`${messages?.sendRequest || 'Send request'} (Ctrl/Cmd+Enter)`} className='inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-60 sm:w-auto'><Play className='h-4 w-4' /> {messages?.sendRequest || 'Send request'} <span className='text-xs font-normal opacity-80'>Ctrl/Cmd+Enter</span></button>}

      {error && <div role='alert' className={`flex gap-2 rounded-md border p-3 text-sm ${theme === 'dark' ? 'border-red-800 bg-red-950/40 text-red-200' : 'border-red-300 bg-red-50 text-red-700'}`}><AlertCircle className='mt-0.5 h-4 w-4 shrink-0' />{error}</div>}
      {scriptError && <div role='alert' className={`flex gap-2 rounded-md border p-3 text-sm ${theme === 'dark' ? 'border-amber-800 bg-amber-950/40 text-amber-200' : 'border-amber-300 bg-amber-50 text-amber-800'}`}><AlertCircle className='mt-0.5 h-4 w-4 shrink-0' />{scriptError}</div>}
      {response && <ApiClientResponseViewer response={response} theme={theme} curlCommand={curlCommand} advanced={density === 'advanced'} />}
      {scriptTests.length > 0 && <section className='space-y-2' aria-labelledby='api-client-test-results-heading'>
        <div className='flex items-center justify-between'>
          <h3 id='api-client-test-results-heading' className='font-semibold'>Test results</h3>
          <span className={`text-xs ${mutedClass}`}>{passedTests}/{scriptTests.length} passed</span>
        </div>
        <div className='space-y-2'>
          {scriptTests.map((test, index) => <div key={`${test.name}:${index}`} className={`rounded-md border px-3 py-2 text-sm ${test.passed ? (theme === 'dark' ? 'border-green-800 bg-green-950/40 text-green-200' : 'border-green-300 bg-green-50 text-green-800') : (theme === 'dark' ? 'border-red-800 bg-red-950/40 text-red-200' : 'border-red-300 bg-red-50 text-red-800')}`}>
            <div className='font-medium'>{test.passed ? 'PASS' : 'FAIL'} — {test.name}</div>
            {test.error && <div className='mt-1 text-xs'>{test.error}</div>}
          </div>)}
        </div>
      </section>}
      {scriptLogs.length > 0 && <CodeBlock code={scriptLogs.join('\n')} language='text' title='Script console' theme={theme} wrap />}
    </div>
  </div>;
};
