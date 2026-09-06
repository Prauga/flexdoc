import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Loader2, Play, Plus, Trash2 } from 'lucide-react';
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
import type { FlexDocHostExecutionPublicOptions } from '../types/options';
import type { Server } from '../types/openapi';

export type { ApiClientExecutionResult } from '../utils/api-client-execution';

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
  resolveAuth?: (auth: HttpAuth | undefined) => HttpAuth;
  variables?: HttpVariables;
  collectionVariables?: HttpVariables;
  externalVariables?: HttpVariables;
  environmentVariables?: HttpVariables;
  onCollectionChanges?: (changes: ApiClientScriptCollectionChange[]) => void;
  onEnvironmentChanges?: (changes: ApiClientScriptEnvironmentChange[]) => void;
  serverOptions?: Server[];
  initialServerUrl?: string;
  hostExecution?: FlexDocHostExecutionPublicOptions;
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
  resolveAuth,
  variables = {},
  collectionVariables = {},
  externalVariables = {},
  environmentVariables = {},
  onCollectionChanges,
  onEnvironmentChanges,
  serverOptions = [],
  initialServerUrl,
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
  const hostRequired = hostRequirements.length > 0;
  const hostAvailable = hostExecution?.available === true && missingHostCapabilities.length === 0;
  const hostNotice = hostRequired
    ? hostAvailable
      ? 'The browser cannot send this request. FlexDoc will execute it from the API host.'
      : hostExecution?.available
        ? `The API host does not support the required capability${missingHostCapabilities.length === 1 ? '' : 'ies'}: ${missingHostCapabilities.join(', ')}.`
        : 'Host execution is disabled on this documentation server.'
    : null;
  const supportsHostCapability = (capability: HttpHostExecutionCapability) => hostExecution?.available === true && hostCapabilities.has(capability);


  const execute = async () => {
  onExecutionStart?.();
  setLoading(true);
  setError(null);
  setScriptError(null);
  setScriptTests([]);
  setScriptLogs([]);
  setResponse(null);
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
      onRequestBuilt: (request) => onRequestChangeRef.current?.(request),
      onCollectionChanges,
      onEnvironmentChanges,
    });
    setError(outcome.error || null);
    setScriptError(outcome.scriptError || null);
    setScriptTests(outcome.scriptTests);
    setScriptLogs(outcome.scriptLogs);
    if (outcome.response) {
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
    setLoading(false);
  }
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
            {resolveAuth && <option value='inherit'>Inherit from parent</option>}
            <option value='none'>None</option><option value='bearer'>Bearer token</option><option value='oauth2'>OAuth 2.0 access token</option><option value='basic'>Basic auth</option><option value='apiKey'>API key</option>
            <option value='digest' disabled={!supportsHostCapability('digest')}>Digest (API host)</option>
            <option value='hawk' disabled={!supportsHostCapability('hawk')}>Hawk (API host)</option>
            <option value='ntlm' disabled={!supportsHostCapability('ntlm')}>NTLM / Negotiate (API host)</option>
            <option value='oauth1' disabled={!supportsHostCapability('oauth1')}>OAuth 1.0 (API host)</option>
            <option value='awsv4' disabled={!supportsHostCapability('awsv4')}>AWS Signature v4 (API host)</option>
          </select>
        </label>
        {draft.auth?.type === 'bearer' && <input aria-label='Bearer token' type='password' autoComplete='off' className={`w-full rounded-md border px-3 py-2 ${inputClass}`} value={draft.auth.token} onChange={(e) => { const token = e.target.value; setDraft((current) => ({ ...current, auth: { type: 'bearer', token } })); }} />}
        {draft.auth?.type === 'oauth2' && <OAuthEditor auth={draft.auth} fieldClass={`w-full rounded-md border px-3 py-2 text-sm ${inputClass}`} label='' onChange={(auth) => setDraft((current) => ({ ...current, auth }))} />}
        {draft.auth?.type === 'basic' && <div className='flex gap-2'><input aria-label='Basic auth username' className={`w-full rounded-md border px-3 py-2 ${inputClass}`} placeholder='Username' value={draft.auth.username} onChange={(e) => setDraft((current) => ({ ...current, auth: { ...(current.auth as Extract<HttpAuth, { type: 'basic' }>), username: e.target.value } }))} /><input aria-label='Basic auth password' type='password' autoComplete='off' className={`w-full rounded-md border px-3 py-2 ${inputClass}`} placeholder='Password' value={draft.auth.password} onChange={(e) => setDraft((current) => ({ ...current, auth: { ...(current.auth as Extract<HttpAuth, { type: 'basic' }>), password: e.target.value } }))} /></div>}
        {draft.auth?.type === 'apiKey' && <div className='flex gap-2'><input aria-label='API key name' className={`w-full rounded-md border px-3 py-2 ${inputClass}`} placeholder='Key name' value={draft.auth.key} onChange={(e) => setDraft((current) => ({ ...current, auth: { ...(current.auth as Extract<HttpAuth, { type: 'apiKey' }>), key: e.target.value } }))} /><input aria-label='API key value' type='password' autoComplete='off' className={`w-full rounded-md border px-3 py-2 ${inputClass}`} placeholder='Value' value={draft.auth.value} onChange={(e) => setDraft((current) => ({ ...current, auth: { ...(current.auth as Extract<HttpAuth, { type: 'apiKey' }>), value: e.target.value } }))} /><select aria-label='API key location' className={`rounded-md border px-3 py-2 text-sm ${inputClass}`} value={draft.auth.in} onChange={(e) => setDraft((current) => ({ ...current, auth: { ...(current.auth as Extract<HttpAuth, { type: 'apiKey' }>), in: e.target.value as 'header' | 'query' | 'cookie' } }))}><option value='header'>Header</option><option value='query'>Query</option><option value='cookie' disabled={!supportsHostCapability('cookies')}>Cookie (API host)</option></select></div>}
        {draft.auth?.type === 'digest' && <div className='grid grid-cols-2 gap-2'><input aria-label='Digest username' className={`rounded-md border px-3 py-2 ${inputClass}`} placeholder='Username' value={draft.auth.username} onChange={(e) => setDraft((current) => ({ ...current, auth: { ...(current.auth as Extract<HttpAuth, { type: 'digest' }>), username: e.target.value } }))} /><input aria-label='Digest password' type='password' autoComplete='off' className={`rounded-md border px-3 py-2 ${inputClass}`} placeholder='Password' value={draft.auth.password} onChange={(e) => setDraft((current) => ({ ...current, auth: { ...(current.auth as Extract<HttpAuth, { type: 'digest' }>), password: e.target.value } }))} /></div>}
        {draft.auth?.type === 'hawk' && <div className='grid gap-2 sm:grid-cols-2'><input aria-label='Hawk id' className={`rounded-md border px-3 py-2 ${inputClass}`} placeholder='ID' value={draft.auth.id} onChange={(e) => setDraft((current) => ({ ...current, auth: { ...(current.auth as Extract<HttpAuth, { type: 'hawk' }>), id: e.target.value } }))} /><input aria-label='Hawk key' type='password' autoComplete='off' className={`rounded-md border px-3 py-2 ${inputClass}`} placeholder='Key' value={draft.auth.key} onChange={(e) => setDraft((current) => ({ ...current, auth: { ...(current.auth as Extract<HttpAuth, { type: 'hawk' }>), key: e.target.value } }))} /><select aria-label='Hawk algorithm' className={`rounded-md border px-3 py-2 ${inputClass}`} value={draft.auth.algorithm || 'sha256'} onChange={(e) => setDraft((current) => ({ ...current, auth: { ...(current.auth as Extract<HttpAuth, { type: 'hawk' }>), algorithm: e.target.value as 'sha1' | 'sha256' } }))}><option value='sha256'>SHA-256</option><option value='sha1'>SHA-1</option></select><input aria-label='Hawk ext' className={`rounded-md border px-3 py-2 ${inputClass}`} placeholder='ext (optional)' value={draft.auth.ext || ''} onChange={(e) => setDraft((current) => ({ ...current, auth: { ...(current.auth as Extract<HttpAuth, { type: 'hawk' }>), ext: e.target.value } }))} /></div>}
        {draft.auth?.type === 'ntlm' && <div className='grid gap-2 sm:grid-cols-2'><input aria-label='NTLM username' className={`rounded-md border px-3 py-2 ${inputClass}`} placeholder='Username' value={draft.auth.username} onChange={(e) => setDraft((current) => ({ ...current, auth: { ...(current.auth as Extract<HttpAuth, { type: 'ntlm' }>), username: e.target.value } }))} /><input aria-label='NTLM password' type='password' autoComplete='off' className={`rounded-md border px-3 py-2 ${inputClass}`} placeholder='Password' value={draft.auth.password} onChange={(e) => setDraft((current) => ({ ...current, auth: { ...(current.auth as Extract<HttpAuth, { type: 'ntlm' }>), password: e.target.value } }))} /><input aria-label='NTLM domain' className={`rounded-md border px-3 py-2 ${inputClass}`} placeholder='Domain (optional)' value={draft.auth.domain || ''} onChange={(e) => setDraft((current) => ({ ...current, auth: { ...(current.auth as Extract<HttpAuth, { type: 'ntlm' }>), domain: e.target.value } }))} /><input aria-label='NTLM workstation' className={`rounded-md border px-3 py-2 ${inputClass}`} placeholder='Workstation (optional)' value={draft.auth.workstation || ''} onChange={(e) => setDraft((current) => ({ ...current, auth: { ...(current.auth as Extract<HttpAuth, { type: 'ntlm' }>), workstation: e.target.value } }))} /></div>}
        {draft.auth?.type === 'oauth1' && <div className='grid gap-2 sm:grid-cols-2'><input aria-label='OAuth1 consumer key' className={`rounded-md border px-3 py-2 ${inputClass}`} placeholder='Consumer key' value={draft.auth.consumerKey} onChange={(e) => setDraft((current) => ({ ...current, auth: { ...(current.auth as Extract<HttpAuth, { type: 'oauth1' }>), consumerKey: e.target.value } }))} /><input aria-label='OAuth1 consumer secret' type='password' autoComplete='off' className={`rounded-md border px-3 py-2 ${inputClass}`} placeholder='Consumer secret' value={draft.auth.consumerSecret} onChange={(e) => setDraft((current) => ({ ...current, auth: { ...(current.auth as Extract<HttpAuth, { type: 'oauth1' }>), consumerSecret: e.target.value } }))} /><input aria-label='OAuth1 token' className={`rounded-md border px-3 py-2 ${inputClass}`} placeholder='Token (optional)' value={draft.auth.token || ''} onChange={(e) => setDraft((current) => ({ ...current, auth: { ...(current.auth as Extract<HttpAuth, { type: 'oauth1' }>), token: e.target.value } }))} /><input aria-label='OAuth1 token secret' type='password' autoComplete='off' className={`rounded-md border px-3 py-2 ${inputClass}`} placeholder='Token secret (optional)' value={draft.auth.tokenSecret || ''} onChange={(e) => setDraft((current) => ({ ...current, auth: { ...(current.auth as Extract<HttpAuth, { type: 'oauth1' }>), tokenSecret: e.target.value } }))} /><select aria-label='OAuth1 signature method' className={`rounded-md border px-3 py-2 ${inputClass}`} value={draft.auth.signatureMethod || 'HMAC-SHA1'} onChange={(e) => setDraft((current) => ({ ...current, auth: { ...(current.auth as Extract<HttpAuth, { type: 'oauth1' }>), signatureMethod: e.target.value as 'HMAC-SHA1' | 'HMAC-SHA256' | 'PLAINTEXT' } }))}><option>HMAC-SHA1</option><option>HMAC-SHA256</option><option>PLAINTEXT</option></select><input aria-label='OAuth1 realm' className={`rounded-md border px-3 py-2 ${inputClass}`} placeholder='Realm (optional)' value={draft.auth.realm || ''} onChange={(e) => setDraft((current) => ({ ...current, auth: { ...(current.auth as Extract<HttpAuth, { type: 'oauth1' }>), realm: e.target.value } }))} /></div>}
        {draft.auth?.type === 'awsv4' && <div className='grid gap-2 sm:grid-cols-2'><input aria-label='AWS access key' className={`rounded-md border px-3 py-2 ${inputClass}`} placeholder='Access key' value={draft.auth.accessKey} onChange={(e) => setDraft((current) => ({ ...current, auth: { ...(current.auth as Extract<HttpAuth, { type: 'awsv4' }>), accessKey: e.target.value } }))} /><input aria-label='AWS secret key' type='password' autoComplete='off' className={`rounded-md border px-3 py-2 ${inputClass}`} placeholder='Secret key' value={draft.auth.secretKey} onChange={(e) => setDraft((current) => ({ ...current, auth: { ...(current.auth as Extract<HttpAuth, { type: 'awsv4' }>), secretKey: e.target.value } }))} /><input aria-label='AWS session token' type='password' autoComplete='off' className={`rounded-md border px-3 py-2 ${inputClass}`} placeholder='Session token (optional)' value={draft.auth.sessionToken || ''} onChange={(e) => setDraft((current) => ({ ...current, auth: { ...(current.auth as Extract<HttpAuth, { type: 'awsv4' }>), sessionToken: e.target.value } }))} /><input aria-label='AWS region' className={`rounded-md border px-3 py-2 ${inputClass}`} placeholder='Region' value={draft.auth.region} onChange={(e) => setDraft((current) => ({ ...current, auth: { ...(current.auth as Extract<HttpAuth, { type: 'awsv4' }>), region: e.target.value } }))} /><input aria-label='AWS service' className={`rounded-md border px-3 py-2 ${inputClass}`} placeholder='Service' value={draft.auth.service} onChange={(e) => setDraft((current) => ({ ...current, auth: { ...(current.auth as Extract<HttpAuth, { type: 'awsv4' }>), service: e.target.value } }))} /></div>}

        {hostExecution?.available && <div className='grid gap-2 rounded-md border p-3 sm:grid-cols-2'>
          {hostExecution.clientCertificates?.length ? <label className='text-xs font-medium'>Client certificate<select aria-label='Client certificate' className={`mt-1 w-full rounded-md border px-2 py-1.5 ${inputClass}`} value={draft.hostExecution?.certificateId || ''} onChange={(e) => setDraft((current) => ({ ...current, hostExecution: { ...(current.hostExecution || {}), certificateId: e.target.value || undefined } }))}><option value=''>None</option>{hostExecution.clientCertificates.map((certificate) => <option key={certificate.id} value={certificate.id}>{certificate.name}</option>)}</select></label> : null}
          {supportsHostCapability('cookies') && <label className='inline-flex items-center gap-2 text-xs font-medium'><input aria-label='Use API host cookie jar' type='checkbox' checked={draft.hostExecution?.cookieJar === 'session'} onChange={(e) => setDraft((current) => ({ ...current, hostExecution: { ...(current.hostExecution || {}), cookieJar: e.target.checked ? 'session' : undefined } }))} />Use API host cookie jar</label>}
        </div>}
        {hostNotice && <div role={hostAvailable ? 'status' : 'alert'} className={`rounded-md border p-3 text-sm ${hostAvailable ? 'border-blue-300 bg-blue-50 text-blue-800' : 'border-amber-300 bg-amber-50 text-amber-800'}`}>{hostNotice}</div>}
      </div>


      {!['GET', 'HEAD'].includes(method) && <ApiClientBodyEditor draft={draft} onChange={setDraft} theme={theme} />}

      <section className='space-y-3 border-t pt-4' aria-labelledby='api-client-scripts-heading'>
        <div>
          <h3 id='api-client-scripts-heading' className='font-semibold'>Scripts</h3>
          <p className={`text-xs ${mutedClass}`}>Trusted local JavaScript. Scripts are not sandboxed; only run code you trust.</p>
        </div>
        <div className='grid gap-3 xl:grid-cols-2'>
          <label className='text-sm font-medium'>Pre-request script
            <div className='mt-1'>
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
            </div>
          </label>
          <label className='text-sm font-medium'>Tests
            <div className='mt-1'>
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
            </div>
          </label>
        </div>
      </section>

      <button onClick={execute} disabled={loading || (hostRequired && !hostAvailable)} className='inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-60'>
        {loading ? <Loader2 className='h-4 w-4 animate-spin' /> : <Play className='h-4 w-4' />} {loading ? 'Sending…' : 'Send request'}
      </button>

      {error && <div role='alert' className='flex gap-2 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700'><AlertCircle className='mt-0.5 h-4 w-4 shrink-0' />{error}</div>}
      {scriptError && <div role='alert' className='flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800'><AlertCircle className='mt-0.5 h-4 w-4 shrink-0' />{scriptError}</div>}
      {response && <ApiClientResponseViewer response={response} theme={theme} />}
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