import React, { useMemo, useState } from 'react';
import { Play, Loader2, AlertCircle } from 'lucide-react';
import { OpenAPISpec } from '../types/openapi';
import { FlexDocRendererOptions } from '../types/options';
import { buildRequest, initialRequestValues, parametersFor } from '../utils/request-builder';
import { CodeBlock } from './CodeBlock';

interface Props {
  spec: OpenAPISpec;
  path: string;
  method: string;
  theme: 'light' | 'dark';
  options?: FlexDocRendererOptions;
  onRequestChange?: (request: ReturnType<typeof buildRequest>) => void;
}

export const RequestPlayground: React.FC<Props> = ({ spec, path, method, theme, options, onRequestChange }) => {
  const defaults = useMemo(() => initialRequestValues(spec, path, method), [spec, path, method]);
  const [values, setValues] = useState(defaults);
  const [response, setResponse] = useState<{ status: number; statusText: string; headers: string; body: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const parameters = parametersFor(spec, path, method);
  const security = spec.paths[path]?.[method.toLowerCase() as keyof (typeof spec.paths)[string]] as any;
  const securityNames = Object.keys((security?.security ?? spec.security ?? [])[0] || {});
  const servers = security?.servers || spec.paths[path]?.servers || spec.servers || [];

  const update = (group: 'parameters' | 'headers' | 'cookies' | 'auth', key: string, value: string) => {
    setValues((current) => ({ ...current, [group]: { ...(current[group] || {}), [key]: value } }));
  };

  const execute = async () => {
    setLoading(true); setError(null); setResponse(null);
    try {
      let request = buildRequest(spec, path, method, values);
      onRequestChange?.(request);
      let initWithUrl: any = { ...request.init, url: request.url, credentials: options?.tryIt?.credentials || 'same-origin' };
      if (options?.tryIt?.requestInterceptor) initWithUrl = await options.tryIt.requestInterceptor(initWithUrl);
      const { url, ...init } = initWithUrl;
      const result = await fetch(url, init);
      const body = await result.text();
      setResponse({ status: result.status, statusText: result.statusText, headers: [...result.headers.entries()].map(([k, v]) => `${k}: ${v}`).join('\n'), body });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Request failed');
    } finally { setLoading(false); }
  };

  const inputClass = theme === 'dark' ? 'bg-gray-900 border-gray-700 text-gray-100' : 'bg-white border-gray-300 text-gray-900';
  const labelClass = theme === 'dark' ? 'text-gray-300' : 'text-gray-700';

  return <div className={`rounded-xl border p-4 md:p-5 ${theme === 'dark' ? 'border-gray-700 bg-gray-800/60' : 'border-gray-200 bg-gray-50'}`}>
    <div className='flex flex-col gap-4'>
      {servers.length > 0 && <label className={labelClass}>Server
        <select className={`mt-1 w-full rounded-md border px-3 py-2 text-sm ${inputClass}`} value={values.serverUrl || servers[0].url} onChange={(e) => setValues({ ...values, serverUrl: e.target.value })}>
          {servers.map((server: any) => <option key={server.url} value={server.url}>{server.description ? `${server.description} — ` : ''}{server.url}</option>)}
        </select>
      </label>}

      {parameters.map((parameter) => <label key={`${parameter.in}:${parameter.name}`} className={labelClass}>
        <span className='text-sm font-medium'>{parameter.name} <span className='text-xs opacity-70'>({parameter.in})</span>{parameter.required ? ' *' : ''}</span>
        <input aria-label={`${parameter.in} ${parameter.name}`} className={`mt-1 w-full rounded-md border px-3 py-2 text-sm ${inputClass}`} value={(parameter.in === 'header' ? values.headers?.[parameter.name] : parameter.in === 'cookie' ? values.cookies?.[parameter.name] : values.parameters?.[parameter.name]) || ''} onChange={(e) => update(parameter.in === 'header' ? 'headers' : parameter.in === 'cookie' ? 'cookies' : 'parameters', parameter.name, e.target.value)} placeholder={parameter.description || parameter.name} />
      </label>)}

      {securityNames.map((name) => <label key={name} className={labelClass}>
        <span className='text-sm font-medium'>{name} credential</span>
        <input type='password' autoComplete='off' className={`mt-1 w-full rounded-md border px-3 py-2 text-sm ${inputClass}`} value={values.auth?.[name] || ''} onChange={(e) => update('auth', name, e.target.value)} placeholder='Token / API key' />
      </label>)}

      {defaults.contentType && <>
        <label className={labelClass}>Content type
          <input className={`mt-1 w-full rounded-md border px-3 py-2 text-sm ${inputClass}`} value={values.contentType || ''} onChange={(e) => setValues({ ...values, contentType: e.target.value })} />
        </label>
        <label className={labelClass}>Request body
          <textarea aria-label='Request body' rows={8} className={`mt-1 w-full rounded-md border px-3 py-2 font-mono text-sm ${inputClass}`} value={values.body || ''} onChange={(e) => setValues({ ...values, body: e.target.value })} />
        </label>
      </>}

      <button onClick={execute} disabled={loading} className='inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-60'>
        {loading ? <Loader2 className='h-4 w-4 animate-spin' /> : <Play className='h-4 w-4' />} {loading ? 'Sending…' : 'Send request'}
      </button>

      {error && <div role='alert' className='flex gap-2 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700'><AlertCircle className='h-4 w-4 shrink-0 mt-0.5' />{error}</div>}
      {response && <div className='space-y-3'>
        <div className='font-semibold'>Response <span className={response.status >= 400 ? 'text-red-600' : 'text-green-600'}>{response.status} {response.statusText}</span></div>
        {response.headers && <CodeBlock code={response.headers} language='text' title='Headers' theme={theme} />}
        <CodeBlock code={response.body || '(empty response)'} language='json' title='Body' theme={theme} />
      </div>}
    </div>
  </div>;
};
