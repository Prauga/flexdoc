import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Loader2, Play, Plus, Trash2 } from 'lucide-react';
import { CodeBlock } from './CodeBlock';
import { buildHttpRequest } from '../utils/http-client';
import type { HttpAuth, HttpKeyValue, HttpRequestDraft } from '../utils/http-client';
import type { BuiltRequest } from '../utils/request-builder';

export interface ApiClientProps {
  initialRequest?: Partial<HttpRequestDraft>;
  theme?: 'light' | 'dark';
  credentials?: RequestCredentials;
  requestInterceptor?: (request: RequestInit & { url: string }) => RequestInit & { url: string } | Promise<RequestInit & { url: string }>;
  onRequestChange?: (request: BuiltRequest) => void;
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

export const ApiClient: React.FC<ApiClientProps> = ({ initialRequest, theme = 'light', credentials = 'same-origin', requestInterceptor, onRequestChange }) => {
  const [draft, setDraft] = useState<HttpRequestDraft>(withDefaults(initialRequest));
  const [response, setResponse] = useState<{ status: number; statusText: string; headers: string; body: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const onRequestChangeRef = useRef(onRequestChange);

  useEffect(() => { onRequestChangeRef.current = onRequestChange; }, [onRequestChange]);
  useEffect(() => {
    try { onRequestChangeRef.current?.(buildHttpRequest(draft)); } catch { /* an empty URL is valid while editing */ }
  }, [draft]);

  const method = (draft.method || 'GET').toUpperCase();
  const inputClass = theme === 'dark' ? 'bg-gray-900 border-gray-700 text-gray-100' : 'bg-white border-gray-300 text-gray-900';
  const panelClass = theme === 'dark' ? 'border-gray-700 bg-gray-800/60 text-gray-100' : 'border-gray-200 bg-gray-50 text-gray-900';

  const setAuthType = (type: HttpAuth['type']) => {
    const auth: HttpAuth = type === 'bearer' ? { type, token: '' } : type === 'basic' ? { type, username: '', password: '' } : type === 'apiKey' ? { type, key: '', value: '', in: 'header' } : { type: 'none' };
    setDraft((current) => ({ ...current, auth }));
  };

  const execute = async () => {
    setLoading(true); setError(null); setResponse(null);
    try {
      const request = buildHttpRequest(draft);
      let initWithUrl: RequestInit & { url: string } = { ...request.init, url: request.url, credentials };
      if (requestInterceptor) initWithUrl = await requestInterceptor(initWithUrl);
      const { url, ...init } = initWithUrl;
      const result = await fetch(url, init);
      const body = await result.text();
      setResponse({ status: result.status, statusText: result.statusText, headers: [...result.headers.entries()].map(([key, value]) => `${key}: ${value}`).join('\n'), body });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Request failed');
    } finally { setLoading(false); }
  };

  return <div className={`rounded-xl border p-4 md:p-5 ${panelClass}`}>
    <div className='flex flex-col gap-4'>
      <div className='flex gap-2'>
        <select aria-label='HTTP method' className={`rounded-md border px-3 py-2 font-medium ${inputClass}`} value={method} onChange={(e) => { const value = e.target.value; setDraft((current) => ({ ...current, method: value })); }}>
          {['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].map((item) => <option key={item}>{item}</option>)}
        </select>
        <input aria-label='Request URL' className={`w-full rounded-md border px-3 py-2 font-mono text-sm ${inputClass}`} placeholder='https://api.example.com/resource' value={draft.url} onChange={(e) => { const value = e.target.value; setDraft((current) => ({ ...current, url: value })); }} />
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

      <button onClick={execute} disabled={loading} className='inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-60'>
        {loading ? <Loader2 className='h-4 w-4 animate-spin' /> : <Play className='h-4 w-4' />} {loading ? 'Sending…' : 'Send request'}
      </button>

      {error && <div role='alert' className='flex gap-2 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700'><AlertCircle className='mt-0.5 h-4 w-4 shrink-0' />{error}</div>}
      {response && <div className='space-y-3'>
        <div className='font-semibold'>Response <span className={response.status >= 400 ? 'text-red-600' : 'text-green-600'}>{response.status} {response.statusText}</span></div>
        {response.headers && <CodeBlock code={response.headers} language='text' title='Headers' theme={theme} wrap />}
        <CodeBlock code={response.body || '(empty response)'} language='json' title='Body' theme={theme} wrap />
      </div>}
    </div>
  </div>;
};