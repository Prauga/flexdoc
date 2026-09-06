import React, { useMemo, useState } from 'react';
import { CodeBlock } from './CodeBlock';

export interface ApiClientResponseView {
  status: number;
  statusText: string;
  headers: Array<[string, string]>;
  body: string;
  responseTime: number;
}

export interface ApiClientResponseViewerProps {
  response: ApiClientResponseView;
  theme?: 'light' | 'dark';
}

type ResponseMode = 'pretty' | 'raw' | 'preview';

function headerValue(headers: Array<[string, string]>, name: string): string {
  return headers.find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1] || '';
}

function prettyResponse(body: string, contentType: string): { body: string; language: string; invalidJson?: boolean } {
  const normalized = contentType.toLowerCase();
  if (normalized.includes('json')) {
    try { return { body: JSON.stringify(JSON.parse(body), null, 2), language: 'json' }; } catch { return { body, language: 'json', invalidJson: true }; }
  }
  if (normalized.includes('html')) return { body, language: 'markup' };
  if (normalized.includes('xml')) return { body, language: 'markup' };
  if (normalized.includes('javascript')) return { body, language: 'javascript' };
  return { body, language: 'text' };
}

export const ApiClientResponseViewer: React.FC<ApiClientResponseViewerProps> = ({ response, theme = 'light' }) => {
  const [mode, setMode] = useState<ResponseMode>('pretty');
  const contentType = headerValue(response.headers, 'content-type');
  const pretty = useMemo(() => prettyResponse(response.body, contentType), [contentType, response.body]);
  const previewable = /(?:text\/html|application\/xhtml\+xml)/i.test(contentType);
  const byteSize = useMemo(() => new TextEncoder().encode(response.body).byteLength, [response.body]);
  const dark = theme === 'dark';


  return <section className='space-y-3' aria-labelledby='api-client-response-heading'>
    <div className='flex flex-wrap items-center justify-between gap-3'>
      <div id='api-client-response-heading' className='font-semibold'>Response <span className={response.status >= 400 ? 'text-red-600' : 'text-green-600'}>{response.status} {response.statusText}</span></div>
      <div className={`flex flex-wrap gap-3 text-xs ${dark ? 'text-gray-400' : 'text-gray-500'}`}><span>{response.responseTime} ms</span><span>{byteSize.toLocaleString()} B</span>{contentType && <span className='font-mono'>{contentType.split(';')[0]}</span>}</div>
    </div>

    <div className={`flex w-fit overflow-hidden rounded-md border ${dark ? 'border-gray-700' : 'border-gray-300'}`} role='group' aria-label='Response body view'>
      {(['pretty', 'raw'] as const).map((item) => {
        const label = item === 'pretty' ? 'Pretty' : 'Raw';
        return <button key={item} type='button' aria-label={label} aria-pressed={mode === item} className={`px-3 py-1.5 text-xs font-medium ${mode === item ? 'bg-blue-600 text-white' : (dark ? 'bg-gray-900 text-gray-300' : 'bg-white text-gray-700')}`} onClick={() => setMode(item)}>{label}</button>;
      })}
      <button type='button' disabled={!previewable} aria-pressed={mode === 'preview'} className={`px-3 py-1.5 text-xs font-medium ${mode === 'preview' ? 'bg-blue-600 text-white' : (dark ? 'bg-gray-900 text-gray-300' : 'bg-white text-gray-700')} disabled:cursor-not-allowed disabled:opacity-40`} onClick={() => setMode('preview')}>Preview</button>
    </div>

    {mode === 'pretty' && <div className='space-y-2'>{pretty.invalidJson && <div className='rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800'>Response declares JSON but could not be parsed. Showing the exact payload.</div>}<CodeBlock code={pretty.body || '(empty response)'} language={pretty.language} title='Body — Pretty' theme={theme} wrap /></div>}
    {mode === 'raw' && <div data-testid='api-client-response-raw-body'><CodeBlock code={response.body || '(empty response)'} language='text' title='Body — Raw' theme={theme} wrap /></div>}
    {mode === 'preview' && previewable && <iframe title='Response preview' sandbox='' srcDoc={response.body} className={`min-h-80 w-full rounded-md border bg-white ${dark ? 'border-gray-700' : 'border-gray-300'}`} />}

    {response.headers.length > 0 && <details className={`rounded-md border ${dark ? 'border-gray-700' : 'border-gray-200'}`}>
      <summary className='cursor-pointer px-3 py-2 text-sm font-medium'>Response headers ({response.headers.length})</summary>
      <div className='border-t p-3'><CodeBlock code={response.headers.map(([key, value]) => `${key}: ${value}`).join('\n')} language='text' theme={theme} wrap /></div>
    </details>}
  </section>;
};
