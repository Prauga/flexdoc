import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Loader2, Play, Plus, Trash2 } from 'lucide-react';
import { CodeBlock } from './CodeBlock';
import { buildHttpRequest } from '../utils/http-client';
import { cloneApiClientScripts, runApiClientScript } from '../utils/api-client-scripting';
import { replaceRequestServer, requestUsesServer, resolveServerUrl } from '../utils/server-url';
import type { HttpAuth, HttpKeyValue, HttpRequestDraft, HttpVariables } from '../utils/http-client';
import type { ApiClientRequestScripts, ApiClientScriptEnvironmentChange, ApiClientScriptTestResult } from '../utils/api-client-scripting';
import type { BuiltRequest } from '../utils/request-builder';
import type { Server } from '../types/openapi';

export interface ApiClientExecutionResult {
  request: HttpRequestDraft;
  scripts: ApiClientRequestScripts;
  executedMethod: string;
  resolvedUrl: string;
  status?: number;
  statusText?: string;
  responseTime?: number;
  error?: string;
}

export interface ApiClientProps {
  initialRequest?: Partial<HttpRequestDraft>;
  initialScripts?: Partial<ApiClientRequestScripts>;
  theme?: 'light' | 'dark';
  credentials?: RequestCredentials;
  requestInterceptor?: (request: RequestInit & { url: string }) => RequestInit & { url: string } | Promise<RequestInit & { url: string }>;
  onRequestChange?: (request: BuiltRequest) => void;
  onDraftChange?: (draft: HttpRequestDraft) => void;
  onScriptsChange?: (scripts: ApiClientRequestScripts) => void;
  onExecutionStart?: () => void;
  onExecutionComplete?: (result: ApiClientExecutionResult) => void;
  variables?: HttpVariables;
  environmentVariables?: HttpVariables;
  onEnvironmentChanges?: (changes: ApiClientScriptEnvironmentChange[]) => void;
  serverOptions?: Server[];
  initialServerUrl?: string;
}

const emptyPair = (): HttpKeyValue => ({ key: '', value: '', enabled: true });

function withDefaults(initialRequest?: Partial<HttpRequestDraft>): HttpRequestDraft {
  return {
    method: initialRequest?.method || 'GET',
    url: initialRequest?.url || '',
    query: initialRequest?.query?.length ? initialRequest.query : [emptyPair()],
    headers: initialRequest?.headers?.length ? initialRequest.headers : [emptyPair()],
    body: initialRequest?.body || '',
    contentType: initialRequest?.contentType || 'application/json',
    auth: initialRequest?.auth || { type: 'none' },
  };
}

function cloneDraft(draft: HttpRequestDraft): HttpRequestDraft {
  return {
    ...draft,
    query: draft.query?.map((entry) => ({ ...entry })),
    headers: draft.headers?.map((entry) => ({ ...entry })),
    auth: draft.auth ? { ...draft.auth } : undefined,
  };
}

function requestOrigin(url: string): string {
  try { return new URL(url).origin; } catch { return ''; }
}

function PairEditor({ label, entries, onChange, inputClass }: { label: string; entries: HttpKeyValue[]; onChange: (entries: HttpKeyValue[]) => void; inputClass: string }) {
  const update = (index: number, patch: Partial<HttpKeyValue>) => onChange(entries.map((entry, i) => i === index ? { ...entry, ...patch } : entry));
  return <div className='space-y-3'>
    <div className='flex items-center justify-between'>
      <span className='text-sm font-medium'>{label}</span>
      <button type='button' className='inline-flex min-h-11 items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm' onClick={() => onChange([...entries, emptyPair()])}><Plus className='h-4 w-4' /> Add</button>
    </div>
    {entries.map((entry, index) => <div className='flex gap-2' key={index}>
      <input aria-label={`${label} ${index + 1} enabled`} type='checkbox' checked={entry.enabled !== false} onChange={(e) => update(index, { enabled: e.target.checked })} />
      <input aria-label={`${label} ${index + 1} key`} className={`w-full rounded-md border px-3 py-2 text-sm ${inputClass}`} placeholder='Key' value={entry.key} onChange={(e) => update(index, { key: e.target.value })} />
      <input aria-label={`${label} ${index + 1} value`} className={`w-full rounded-md border px-3 py-2 text-sm ${inputClass}`} placeholder='Value' value={entry.value} onChange={(e) => update(index, { value: e.target.value })} />
      <button type='button' aria-label={`Remove ${label.toLowerCase()} ${index + 1}`} className='inline-flex min-h-11 items-center justify-center rounded-md border px-3 py-2' onClick={() => onChange(entries.filter((_, i) => i !== index))}><Trash2 className='h-4 w-4' /></button>
    </div>)}
  </div>;
}

export const ApiClient: React.FC<ApiClientProps> = ({
  initialRequest,
  initialScripts,
  theme = 'light',
  credentials = 'same-origin',
  requestInterceptor,
  onRequestChange,
  onDraftChange,
  onScriptsChange,
  onExecutionStart,
  onExecutionComplete,
  variables = {},
  environmentVariables = {},
  onEnvironmentChanges,
  serverOptions = [],
  initialServerUrl,
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
  const [response, setResponse] = useState<{ status: number; statusText: string; headers: string; body: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scriptError, setScriptError] = useState<string | null>(null);
  const [scriptTests, setScriptTests] = useState<ApiClientScriptTestResult[]>([]);
  const [scriptLogs, setScriptLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const onRequestChangeRef = useRef(onRequestChange);
  const onDraftChangeRef = useRef(onDraftChange);
  const onScriptsChangeRef = useRef(onScriptsChange);
  const lastRequestSignatureRef = useRef<string | null>(null);

  useEffect(() => { onRequestChangeRef.current = onRequestChange; }, [onRequestChange]);
  useEffect(() => { onDraftChangeRef.current = onDraftChange; }, [onDraftChange]);
  useEffect(() => { onScriptsChangeRef.current = onScriptsChange; }, [onScriptsChange]);
  useEffect(() => { onDraftChangeRef.current?.(cloneDraft(draft)); }, [draft]);
  useEffect(() => { onScriptsChangeRef.current?.(cloneApiClientScripts(scripts)); }, [scripts]);
  useEffect(() => {
    try {
      const request = buildHttpRequest(draft, { variables });
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
  }, [draft, variables]);

  const method = (draft.method || 'GET').toUpperCase();
  const inputClass = theme === 'dark' ? 'bg-gray-900 border-gray-700 text-gray-100' : 'bg-white border-gray-300 text-gray-900';
  const panelClass = theme === 'dark' ? 'border-gray-700 bg-gray-800/60 text-gray-100' : 'border-gray-200 bg-gray-50 text-gray-900';
  const mutedClass = theme === 'dark' ? 'text-gray-400' : 'text-gray-600';

  const applyServer = (nextServerUrl: string) => {
    if (!nextServerUrl) return;
    const previousServerUrl = serverUrlRef.current;
    serverUrlRef.current = nextServerUrl;
    setDraft((current) => ({ ...current, url: replaceRequestServer(current.url, previousServerUrl, nextServerUrl) }));
  };

  const setAuthType = (type: HttpAuth['type']) => {
    const auth: HttpAuth = type === 'bearer' ? { type, token: '' } : type === 'basic' ? { type, username: '', password: '' } : type === 'apiKey' ? { type, key: '', value: '', in: 'header' } : { type: 'none' };
    setDraft((current) => ({ ...current, auth }));
  };

  const execute = async () => {
    onExecutionStart?.();
    const historyRequest = cloneDraft(draft);
    const historyScripts = cloneApiClientScripts(scripts);
    let executedMethod = '';
    let resolvedUrl = '';
    let startedAt = 0;
    let requestAttempted = false;
    let historyRecorded = false;

    setLoading(true);
    setError(null);
    setScriptError(null);
    setScriptTests([]);
    setScriptLogs([]);
    setResponse(null);
    try {
      let executionDraft = cloneDraft(draft);
      let executionVariables = Object.assign(Object.create(null) as HttpVariables, variables);
      let executionEnvironmentVariables = Object.assign(Object.create(null) as HttpVariables, environmentVariables);
      let logs: string[] = [];

      if (scripts.preRequest.trim()) {
        const preRequestResult = await runApiClientScript({
          script: scripts.preRequest,
          phase: 'pre-request',
          draft: executionDraft,
          variables: executionVariables,
          environmentVariables: executionEnvironmentVariables,
        });
        executionDraft = preRequestResult.draft;
        executionVariables = preRequestResult.variables;
        executionEnvironmentVariables = preRequestResult.environmentVariables;
        logs = [...logs, ...preRequestResult.logs];
        if (preRequestResult.environmentChanges.length > 0) onEnvironmentChanges?.(preRequestResult.environmentChanges);
        if (preRequestResult.error) {
          setScriptLogs(logs);
          setScriptError(`Pre-request script: ${preRequestResult.error}`);
          return;
        }
      }

      const request = buildHttpRequest(executionDraft, { variables: executionVariables });
      executedMethod = request.method;
      resolvedUrl = request.url;
      onRequestChangeRef.current?.(request);
      let initWithUrl: RequestInit & { url: string } = { ...request.init, url: request.url, credentials };
      if (requestInterceptor) initWithUrl = await requestInterceptor(initWithUrl);
      const { url, ...init } = initWithUrl;
      resolvedUrl = url;
      startedAt = Date.now();
      requestAttempted = true;
      const result = await fetch(url, init);
      const body = await result.text();
      const responseTime = Date.now() - startedAt;
      const responseHeaders = [...result.headers.entries()];
      setResponse({
        status: result.status,
        statusText: result.statusText,
        headers: responseHeaders.map(([key, value]) => `${key}: ${value}`).join('\n'),
        body,
      });
      onExecutionComplete?.({
        request: historyRequest,
        scripts: historyScripts,
        executedMethod,
        resolvedUrl,
        status: result.status,
        statusText: result.statusText,
        responseTime,
      });
      historyRecorded = true;

      if (scripts.tests.trim()) {
        const testResult = await runApiClientScript({
          script: scripts.tests,
          phase: 'tests',
          draft: executionDraft,
          variables: executionVariables,
          environmentVariables: executionEnvironmentVariables,
          response: {
            status: result.status,
            statusText: result.statusText,
            headers: responseHeaders,
            body,
            responseTime,
          },
        });
        logs = [...logs, ...testResult.logs];
        setScriptTests(testResult.tests);
        if (testResult.environmentChanges.length > 0) onEnvironmentChanges?.(testResult.environmentChanges);
        if (testResult.error) setScriptError(`Test script: ${testResult.error}`);
      }
      setScriptLogs(logs);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Request failed';
      setError(message);
      if (requestAttempted && !historyRecorded) {
        onExecutionComplete?.({
          request: historyRequest,
          scripts: historyScripts,
          executedMethod,
          resolvedUrl,
          responseTime: startedAt ? Date.now() - startedAt : undefined,
          error: message,
        });
      }
    } finally { setLoading(false); }
  };

  const passedTests = scriptTests.filter((test) => test.passed).length;

  return <div className={`rounded-xl border p-4 md:p-5 ${panelClass}`}>
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

      <div className='flex gap-2'>
        <select aria-label='HTTP method' className={`rounded-md border px-3 py-2 font-medium ${inputClass}`} value={method} onChange={(e) => { const value = e.target.value; setDraft((current) => ({ ...current, method: value })); }}>
          {['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].map((item) => <option key={item}>{item}</option>)}
        </select>
        <input aria-label='Request URL' className={`w-full rounded-md border px-3 py-2 font-mono text-sm ${inputClass}`} placeholder='https://api.example.com/resource or {{baseUrl}}/resource' value={draft.url} onChange={(e) => { const value = e.target.value; setDraft((current) => ({ ...current, url: value })); }} />
      </div>

      <PairEditor label='Query parameters' entries={draft.query || []} onChange={(query) => setDraft((current) => ({ ...current, query }))} inputClass={inputClass} />
      <PairEditor label='Headers' entries={draft.headers || []} onChange={(headers) => setDraft((current) => ({ ...current, headers }))} inputClass={inputClass} />

      <div className='space-y-3'>
        <label className='text-sm font-medium'>Authorization
          <select aria-label='Authorization type' className={`rounded-md border px-3 py-2 text-sm ${inputClass}`} value={draft.auth?.type || 'none'} onChange={(e) => setAuthType(e.target.value as HttpAuth['type'])}>
            <option value='none'>None</option><option value='bearer'>Bearer token</option><option value='basic'>Basic auth</option><option value='apiKey'>API key</option>
          </select>
        </label>
        {draft.auth?.type === 'bearer' && <input aria-label='Bearer token' type='password' autoComplete='off' className={`w-full rounded-md border px-3 py-2 ${inputClass}`} value={draft.auth.token} onChange={(e) => { const token = e.target.value; setDraft((current) => ({ ...current, auth: { type: 'bearer', token } })); }} />}
        {draft.auth?.type === 'basic' && <div className='flex gap-2'><input aria-label='Basic auth username' className={`w-full rounded-md border px-3 py-2 ${inputClass}`} placeholder='Username' value={draft.auth.username} onChange={(e) => { const username = e.target.value; setDraft((current) => ({ ...current, auth: { ...(current.auth as Extract<HttpAuth, { type: 'basic' }>), type: 'basic', username } })); }} /><input aria-label='Basic auth password' type='password' autoComplete='off' className={`w-full rounded-md border px-3 py-2 ${inputClass}`} placeholder='Password' value={draft.auth.password} onChange={(e) => { const password = e.target.value; setDraft((current) => ({ ...current, auth: { ...(current.auth as Extract<HttpAuth, { type: 'basic' }>), type: 'basic', password } })); }} /></div>}
        {draft.auth?.type === 'apiKey' && <div className='flex gap-2'><input aria-label='API key name' className={`w-full rounded-md border px-3 py-2 ${inputClass}`} placeholder='Key name' value={draft.auth.key} onChange={(e) => { const key = e.target.value; setDraft((current) => ({ ...current, auth: { ...(current.auth as Extract<HttpAuth, { type: 'apiKey' }>), type: 'apiKey', key } })); }} /><input aria-label='API key value' type='password' autoComplete='off' className={`w-full rounded-md border px-3 py-2 ${inputClass}`} placeholder='Value' value={draft.auth.value} onChange={(e) => { const value = e.target.value; setDraft((current) => ({ ...current, auth: { ...(current.auth as Extract<HttpAuth, { type: 'apiKey' }>), type: 'apiKey', value } })); }} /><select aria-label='API key location' className={`rounded-md border px-3 py-2 text-sm ${inputClass}`} value={draft.auth.in} onChange={(e) => { const location = e.target.value as 'header' | 'query'; setDraft((current) => ({ ...current, auth: { ...(current.auth as Extract<HttpAuth, { type: 'apiKey' }>), type: 'apiKey', in: location } })); }}><option value='header'>Header</option><option value='query'>Query</option></select></div>}
      </div>

      {!['GET', 'HEAD'].includes(method) && <div className='space-y-3'>
        <label className='text-sm font-medium'>Content type<input aria-label='Content type' className={`w-full rounded-md border px-3 py-2 ${inputClass}`} value={draft.contentType || ''} onChange={(e) => { const contentType = e.target.value; setDraft((current) => ({ ...current, contentType })); }} /></label>
        <label className='text-sm font-medium'>Request body<textarea aria-label='Request body' rows={8} className={`w-full rounded-md border px-3 py-2 font-mono text-sm ${inputClass}`} value={draft.body || ''} onChange={(e) => { const body = e.target.value; setDraft((current) => ({ ...current, body })); }} /></label>
      </div>}

      <section className='space-y-3 border-t pt-4' aria-labelledby='api-client-scripts-heading'>
        <div>
          <h3 id='api-client-scripts-heading' className='font-semibold'>Scripts</h3>
          <p className={`text-xs ${mutedClass}`}>Trusted local JavaScript. Scripts are not sandboxed; only run code you trust.</p>
        </div>
        <div className='grid gap-3 xl:grid-cols-2'>
          <label className='text-sm font-medium'>Pre-request script
            <textarea
              aria-label='Pre-request script'
              rows={8}
              className={`mt-1 w-full rounded-md border px-3 py-2 font-mono text-xs ${inputClass}`}
              placeholder="flex.environment.set('token', '...');\nflex.request.headers.set('X-Trace', 'value');"
              value={scripts.preRequest}
              onChange={(event) => setScripts((current) => ({ ...current, preRequest: event.target.value }))}
            />
          </label>
          <label className='text-sm font-medium'>Tests
            <textarea
              aria-label='Tests script'
              rows={8}
              className={`mt-1 w-full rounded-md border px-3 py-2 font-mono text-xs ${inputClass}`}
              placeholder="flex.test('status is 200', () => {\n  flex.expect(flex.response.code).to.equal(200);\n});"
              value={scripts.tests}
              onChange={(event) => setScripts((current) => ({ ...current, tests: event.target.value }))}
            />
          </label>
        </div>
      </section>

      <button onClick={execute} disabled={loading} className='inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-60'>
        {loading ? <Loader2 className='h-4 w-4 animate-spin' /> : <Play className='h-4 w-4' />} {loading ? 'Sending…' : 'Send request'}
      </button>

      {error && <div role='alert' className='flex gap-2 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700'><AlertCircle className='mt-0.5 h-4 w-4 shrink-0' />{error}</div>}
      {scriptError && <div role='alert' className='flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800'><AlertCircle className='mt-0.5 h-4 w-4 shrink-0' />{scriptError}</div>}
      {response && <div className='space-y-3'>
        <div className='font-semibold'>Response <span className={response.status >= 400 ? 'text-red-600' : 'text-green-600'}>{response.status} {response.statusText}</span></div>
        {response.headers && <CodeBlock code={response.headers} language='text' title='Headers' theme={theme} wrap />}
        <CodeBlock code={response.body || '(empty response)'} language='json' title='Body' theme={theme} wrap />
      </div>}
      {scriptTests.length > 0 && <section className='space-y-2' aria-labelledby='api-client-test-results-heading'>
        <div className='flex items-center justify-between'>
          <h3 id='api-client-test-results-heading' className='font-semibold'>Test results</h3>
          <span className={`text-xs ${mutedClass}`}>{passedTests}/{scriptTests.length} passed</span>
        </div>
        <div className='space-y-2'>
          {scriptTests.map((test, index) => <div key={`${test.name}:${index}`} className={`rounded-md border px-3 py-2 text-sm ${test.passed ? 'border-green-300 bg-green-50 text-green-800' : 'border-red-300 bg-red-50 text-red-800'}`}>
            <div className='font-medium'>{test.passed ? 'PASS' : 'FAIL'} — {test.name}</div>
            {test.error && <div className='mt-1 text-xs'>{test.error}</div>}
          </div>)}
        </div>
      </section>}
      {scriptLogs.length > 0 && <CodeBlock code={scriptLogs.join('\n')} language='text' title='Script console' theme={theme} wrap />}
    </div>
  </div>;
};