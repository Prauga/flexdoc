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
  curlCommand?: string;
  advanced?: boolean;
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

function matchCount(value: string, query: string): number {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return 0;
  let count = 0;
  let offset = 0;
  const source = value.toLowerCase();
  while (offset < source.length) {
    const index = source.indexOf(normalized, offset);
    if (index < 0) break;
    count += 1;
    offset = index + Math.max(1, normalized.length);
  }
  return count;
}

function filteredBody(value: string, query: string): string {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return value;
  const lines = value.split('\n').filter((line) => line.toLowerCase().includes(normalized));
  return lines.join('\n');
}

export const ApiClientResponseViewer: React.FC<ApiClientResponseViewerProps> = ({ response, theme = 'light', curlCommand, advanced = true }) => {
  const [mode, setMode] = useState<ResponseMode>('pretty');
  const [bodySearch, setBodySearch] = useState('');
  const [filterMatchingLines, setFilterMatchingLines] = useState(false);
  const [headerSearch, setHeaderSearch] = useState('');
  const [curlCopied, setCurlCopied] = useState(false);
  const contentType = headerValue(response.headers, 'content-type');
  const pretty = useMemo(() => prettyResponse(response.body, contentType), [contentType, response.body]);
  const previewable = /(?:text\/html|application\/xhtml\+xml)/i.test(contentType);
  const byteSize = useMemo(() => new TextEncoder().encode(response.body).byteLength, [response.body]);
  const dark = theme === 'dark';
  const effectiveMode: ResponseMode = advanced ? mode : 'pretty';
  const bodySource = effectiveMode === 'pretty' ? pretty.body : response.body;
  const bodyMatches = useMemo(() => matchCount(bodySource, bodySearch), [bodySearch, bodySource]);
  const visibleBody = useMemo(() => filterMatchingLines ? filteredBody(bodySource, bodySearch) : bodySource, [bodySearch, bodySource, filterMatchingLines]);
  const normalizedHeaderSearch = headerSearch.trim().toLowerCase();
  const visibleHeaders = response.headers.filter(([key, value]) => !normalizedHeaderSearch || `${key}: ${value}`.toLowerCase().includes(normalizedHeaderSearch));
  const inputClass = dark ? 'border-gray-700 bg-gray-900 text-gray-100' : 'border-gray-300 bg-white text-gray-900';
  const mutedClass = dark ? 'text-gray-400' : 'text-gray-500';

  const copyCurl = async () => {
    if (!curlCommand || typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(curlCommand);
      setCurlCopied(true);
      window.setTimeout(() => setCurlCopied(false), 1500);
    } catch {
      setCurlCopied(false);
    }
  };

  return <section className='space-y-3' aria-labelledby='api-client-response-heading'>
    <div className='flex flex-wrap items-center justify-between gap-3'>
      <div id='api-client-response-heading' className='font-semibold'>Response <span className={response.status >= 400 ? (dark ? 'text-red-300' : 'text-red-600') : (dark ? 'text-green-300' : 'text-green-600')}>{response.status} {response.statusText}</span></div>
      <div className='flex flex-wrap items-center gap-2'>
        <div className={`flex flex-wrap gap-3 text-xs ${mutedClass}`}><span>{response.responseTime} ms</span><span>{byteSize.toLocaleString()} B</span>{contentType && <span className='font-mono'>{contentType.split(';')[0]}</span>}</div>
        {curlCommand && <button type='button' className={`rounded-md border px-2.5 py-1.5 text-xs font-medium ${dark ? 'border-gray-700 bg-gray-900 text-gray-200 hover:bg-gray-800' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`} onClick={() => { void copyCurl(); }} aria-label='Copy request as cURL'>{curlCopied ? 'Copied cURL' : 'Copy as cURL'}</button>}
      </div>
    </div>

    {advanced && <div className={`flex w-fit overflow-hidden rounded-md border ${dark ? 'border-gray-700' : 'border-gray-300'}`} role='group' aria-label='Response body view'>
      {(['pretty', 'raw'] as const).map((item) => {
        const label = item === 'pretty' ? 'Pretty' : 'Raw';
        return <button key={item} type='button' aria-label={label} aria-pressed={mode === item} className={`px-3 py-1.5 text-xs font-medium ${mode === item ? 'bg-blue-600 text-white' : (dark ? 'bg-gray-900 text-gray-300' : 'bg-white text-gray-700')}`} onClick={() => setMode(item)}>{label}</button>;
      })}
      <button type='button' disabled={!previewable} aria-pressed={mode === 'preview'} className={`px-3 py-1.5 text-xs font-medium ${mode === 'preview' ? 'bg-blue-600 text-white' : (dark ? 'bg-gray-900 text-gray-300' : 'bg-white text-gray-700')} disabled:cursor-not-allowed disabled:opacity-40`} onClick={() => setMode('preview')}>Preview</button>
    </div>}

    {advanced && effectiveMode !== 'preview' && <div className='flex flex-wrap items-center gap-2'>
      <input aria-label='Search response body' type='search' className={`min-w-0 flex-1 rounded-md border px-3 py-2 text-sm ${inputClass}`} placeholder='Search response body…' value={bodySearch} onChange={(event) => setBodySearch(event.target.value)} />
      <span className={`text-xs ${mutedClass}`}>{bodySearch.trim() ? `${bodyMatches} match${bodyMatches === 1 ? '' : 'es'}` : 'Search exact response text'}</span>
      <label className={`inline-flex items-center gap-2 text-xs ${mutedClass}`}><input type='checkbox' checked={filterMatchingLines} disabled={!bodySearch.trim()} onChange={(event) => setFilterMatchingLines(event.target.checked)} />Only matching lines</label>
    </div>}

    {effectiveMode === 'pretty' && <div className='space-y-2'>{pretty.invalidJson && <div className={`rounded-md border px-3 py-2 text-xs ${dark ? 'border-amber-800 bg-amber-950/40 text-amber-200' : 'border-amber-300 bg-amber-50 text-amber-800'}`}>Response declares JSON but could not be parsed. Showing the exact payload.</div>}<CodeBlock code={visibleBody || '(empty response)'} language={pretty.language} title={advanced ? 'Body — Pretty' : 'Response body'} theme={theme} wrap /></div>}
    {advanced && effectiveMode === 'raw' && <div data-testid='api-client-response-raw-body'><CodeBlock code={visibleBody || '(empty response)'} language='text' title='Body — Raw' theme={theme} wrap /></div>}
    {advanced && effectiveMode === 'preview' && previewable && <iframe title='Response preview' sandbox='' srcDoc={response.body} className={`min-h-80 w-full rounded-md border bg-white ${dark ? 'border-gray-700' : 'border-gray-300'}`} />}

    {advanced && response.headers.length > 0 && <section className={`overflow-hidden rounded-md border ${dark ? 'border-gray-700' : 'border-gray-200'}`} aria-labelledby='api-client-response-headers-heading'>
      <div className='flex flex-wrap items-center justify-between gap-2 px-3 py-2'>
        <h4 id='api-client-response-headers-heading' className='text-sm font-medium'>Response headers ({response.headers.length})</h4>
        <input aria-label='Filter response headers' type='search' className={`rounded-md border px-2 py-1.5 text-xs ${inputClass}`} placeholder='Filter headers…' value={headerSearch} onChange={(event) => setHeaderSearch(event.target.value)} />
      </div>
      <div className='overflow-x-auto border-t'>
        <table className='w-full min-w-[28rem] text-left text-xs'>
          <thead className={dark ? 'bg-gray-900 text-gray-300' : 'bg-gray-50 text-gray-600'}><tr><th className='px-3 py-2 font-medium'>Header</th><th className='px-3 py-2 font-medium'>Value</th></tr></thead>
          <tbody>
            {visibleHeaders.map(([key, value], index) => <tr key={`${key}:${index}`} className={dark ? 'border-t border-gray-800' : 'border-t border-gray-100'}><th scope='row' className='whitespace-nowrap px-3 py-2 font-mono font-medium'>{key}</th><td className='break-all px-3 py-2 font-mono'>{value}</td></tr>)}
            {visibleHeaders.length === 0 && <tr><td colSpan={2} className={`px-3 py-4 text-center ${mutedClass}`}>No response headers match this filter.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>}
  </section>;
};
