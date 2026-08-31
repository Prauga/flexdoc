import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, Play, Loader2, AlertCircle } from 'lucide-react';
import { OpenAPISpec, Operation } from '../types/openapi';
import { FlexDocRendererOptions } from '../types/options';
import { buildRequest, initialRequestValues, parametersFor } from '../utils/request-builder';
import type { RequestValues } from '../utils/request-builder';
import { resolveServerUrl } from '../utils/server-url';
import { CodeBlock } from './CodeBlock';

interface Props {
  spec: OpenAPISpec;
  path: string;
  method: string;
  theme: 'light' | 'dark';
  options?: FlexDocRendererOptions;
  onRequestChange?: (request: ReturnType<typeof buildRequest>) => void;
  onOpenInApiClient?: (request: ReturnType<typeof buildRequest>, serverUrl?: string) => void;
}

function displayValue(value: unknown): string | number | readonly string[] {
  if (value === undefined || value === null) return '';
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'object') return JSON.stringify(value);
  if (typeof value === 'boolean') return String(value);
  return value as string | number;
}

export const RequestPlayground: React.FC<Props> = ({ spec, path, method, theme, options, onRequestChange, onOpenInApiClient }) => {
  const pathItem = spec.paths[path];
  const operation = pathItem?.[method.toLowerCase() as keyof typeof pathItem] as Operation | undefined;
  const servers = operation?.servers || pathItem?.servers || spec.servers || [];
  const serverChoices = useMemo(() => servers.map((server) => ({ server, url: resolveServerUrl(server) })), [servers]);
  const configuredServerUrls = useMemo(() => serverChoices.map((choice) => choice.url), [serverChoices]);
  const defaults = useMemo(() => ({
    ...initialRequestValues(spec, path, method),
    serverUrl: options?.tryIt?.defaultServer,
  }), [spec, path, method, options?.tryIt?.defaultServer]);
  const configuredDefault = defaults.serverUrl && configuredServerUrls.includes(defaults.serverUrl)
    ? defaults.serverUrl
    : configuredServerUrls[0] || '';
  const initialCustomServer = defaults.serverUrl && !configuredServerUrls.includes(defaults.serverUrl)
    ? defaults.serverUrl
    : '';
  const [values, setValues] = useState<RequestValues>(defaults);
  const valuesRef = useRef<RequestValues>(defaults);
  const selectedServerRef = useRef(configuredDefault);
  const customServerInputRef = useRef<HTMLInputElement>(null);
  const onRequestChangeRef = useRef(onRequestChange);
  onRequestChangeRef.current = onRequestChange;
  const [response, setResponse] = useState<{ status: number; statusText: string; headers: string; body: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const parameters = useMemo(() => parametersFor(spec, path, method), [spec, path, method]);
  const securityNames = options?.noAutoAuth ? [] : Object.keys((operation?.security ?? spec.security ?? [])[0] || {});

  const commitValues = (next: RequestValues) => {
    valuesRef.current = next;
    setValues(next);
  };

  useEffect(() => {
    valuesRef.current = defaults;
    selectedServerRef.current = configuredDefault;
    if (customServerInputRef.current) customServerInputRef.current.value = initialCustomServer;
    setValues(defaults);
  }, [defaults, configuredDefault, initialCustomServer]);
  useEffect(() => {
    try { onRequestChangeRef.current?.(buildRequest(spec, path, method, values)); } catch { /* incomplete required values are valid while editing */ }
  }, [spec, path, method, values]);

  const update = (group: 'parameters' | 'headers' | 'cookies' | 'auth', key: string, value: string) => {
    const current = valuesRef.current;
    commitValues({ ...current, [group]: { ...(current[group] || {}), [key]: value } });
  };

  const execute = async () => {
    setLoading(true); setError(null); setResponse(null);
    try {
      const request = buildRequest(spec, path, method, valuesRef.current);
      let initWithUrl: RequestInit & { url: string } = { ...request.init, url: request.url, credentials: options?.tryIt?.credentials || 'same-origin' };
      if (options?.tryIt?.requestInterceptor) initWithUrl = await options.tryIt.requestInterceptor(initWithUrl);
      const { url, ...init } = initWithUrl;
      const result = await fetch(url, init);
      const body = await result.text();
      setResponse({ status: result.status, statusText: result.statusText, headers: [...result.headers.entries()].map(([k, v]) => `${k}: ${v}`).join('\n'), body });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Request failed');
    } finally { setLoading(false); }
  };

  const openInApiClient = () => {
    try {
      const request = buildRequest(spec, path, method, valuesRef.current);
      onOpenInApiClient?.(request, valuesRef.current.serverUrl || configuredDefault || undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Request is incomplete');
    }
  };

  const inputClass = theme === 'dark' ? 'bg-gray-900 border-gray-700 text-gray-100' : 'bg-white border-gray-300 text-gray-900';
  const labelClass = theme === 'dark' ? 'text-gray-300' : 'text-gray-700';
  const serverControlKey = `${path}:${method}:${configuredDefault}:${initialCustomServer}`;

  return <div className={`rounded-xl border p-4 md:p-5 ${theme === 'dark' ? 'border-gray-700 bg-gray-800/60' : 'border-gray-200 bg-gray-50'}`}>
    <div className='flex flex-col gap-4'>
      {servers.length > 0 && <label className={labelClass}>Server
        <select key={`server:${serverControlKey}`} aria-label='Server' className={`mt-1 w-full rounded-md border px-3 py-2 text-sm ${inputClass}`} defaultValue={configuredDefault} onChange={(e) => {
          selectedServerRef.current = e.target.value;
          if (customServerInputRef.current) customServerInputRef.current.value = '';
          commitValues({ ...valuesRef.current, serverUrl: e.target.value });
        }}>
          {serverChoices.map(({ server, url }) => <option key={`${server.url}:${url}`} value={url}>{server.description ? `${server.description} — ` : ''}{server.url}</option>)}
        </select>
      </label>}
      <label className={labelClass}>Custom server URL <span className='text-xs opacity-70'>(optional override)</span>
        <input key={`custom:${serverControlKey}`} ref={customServerInputRef} aria-label='Custom server URL' className={`mt-1 w-full rounded-md border px-3 py-2 font-mono text-sm ${inputClass}`} defaultValue={initialCustomServer} onChange={(e) => {
          const serverUrl = e.target.value.trim() || selectedServerRef.current;
          commitValues({ ...valuesRef.current, serverUrl: serverUrl || undefined });
        }} placeholder='http://localhost:8080' />
      </label>

      {parameters.map((parameter) => {
        const currentValue = parameter.in === 'header'
          ? values.headers?.[parameter.name]
          : parameter.in === 'cookie'
            ? values.cookies?.[parameter.name]
            : values.parameters?.[parameter.name];
        return <label key={`${parameter.in}:${parameter.name}`} className={labelClass}>
          <span className='text-sm font-medium'>{parameter.name} <span className='text-xs opacity-70'>({parameter.in})</span>{parameter.required ? ' *' : ''}</span>
          <input aria-label={`${parameter.in} ${parameter.name}`} className={`mt-1 w-full rounded-md border px-3 py-2 text-sm ${inputClass}`} value={displayValue(currentValue)} onChange={(e) => update(parameter.in === 'header' ? 'headers' : parameter.in === 'cookie' ? 'cookies' : 'parameters', parameter.name, e.target.value)} placeholder={parameter.description || parameter.name} />
        </label>;
      })}

      {securityNames.map((name) => <label key={name} className={labelClass}>
        <span className='text-sm font-medium'>{name} credential</span>
        <input type='password' autoComplete='off' className={`mt-1 w-full rounded-md border px-3 py-2 text-sm ${inputClass}`} value={values.auth?.[name] || ''} onChange={(e) => update('auth', name, e.target.value)} placeholder='Token / API key' />
      </label>)}

      {defaults.contentType && <>
        <label className={labelClass}>Content type<input className={`mt-1 w-full rounded-md border px-3 py-2 text-sm ${inputClass}`} value={values.contentType || ''} onChange={(e) => commitValues({ ...valuesRef.current, contentType: e.target.value })} /></label>
        <label className={labelClass}>Request body<textarea aria-label='Request body' rows={8} className={`mt-1 w-full rounded-md border px-3 py-2 font-mono text-sm ${inputClass}`} value={values.body || ''} onChange={(e) => commitValues({ ...valuesRef.current, body: e.target.value })} /></label>
      </>}

      <div className='flex flex-wrap gap-2'>
        <button onClick={execute} disabled={loading} className='inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-60'>
          {loading ? <Loader2 className='h-4 w-4 animate-spin' /> : <Play className='h-4 w-4' />} {loading ? 'Sending…' : 'Send request'}
        </button>
        {onOpenInApiClient && <button type='button' onClick={openInApiClient} className='inline-flex min-h-11 items-center justify-center gap-2 rounded-md border px-4 py-2 font-medium'>
          <ExternalLink className='h-4 w-4' /> Open in API Client
        </button>}
      </div>

      {error && <div role='alert' className='flex gap-2 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700'><AlertCircle className='mt-0.5 h-4 w-4 shrink-0' />{error}</div>}
      {response && <div className='space-y-3'>
        <div className='font-semibold'>Response <span className={response.status >= 400 ? 'text-red-600' : 'text-green-600'}>{response.status} {response.statusText}</span></div>
        {response.headers && <CodeBlock code={response.headers} language='text' title='Headers' theme={theme} wrap />}
        <CodeBlock code={response.body || '(empty response)'} language='json' title='Body' theme={theme} wrap /></div>}
    </div>
  </div>;
};