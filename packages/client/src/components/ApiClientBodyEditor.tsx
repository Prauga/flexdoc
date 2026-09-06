import React, { useMemo } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { ApiClientCodeEditor } from './ApiClientCodeEditor';
import { inferHttpBodyMode } from '../utils/http-client';
import type { HttpBodyMode, HttpFormDataEntry, HttpKeyValue, HttpRequestDraft } from '../utils/http-client';

export interface ApiClientBodyEditorProps {
  draft: HttpRequestDraft;
  onChange: (draft: HttpRequestDraft) => void;
  theme?: 'light' | 'dark';
}

const emptyPair = (): HttpKeyValue => ({ key: '', value: '', enabled: true });
const emptyForm = (): HttpFormDataEntry => ({ key: '', value: '', enabled: true, type: 'text' });

const CONTENT_TYPES = [
  ['application/json', 'JSON — application/json'],
  ['application/problem+json', 'Problem JSON — application/problem+json'],
  ['application/ld+json', 'JSON-LD — application/ld+json'],
  ['text/plain', 'Text — text/plain'],
  ['application/xml', 'XML — application/xml'],
  ['text/html', 'HTML — text/html'],
  ['application/javascript', 'JavaScript — application/javascript'],
  ['application/octet-stream', 'Binary — application/octet-stream'],
] as const;

function languageFor(contentType: string | undefined) {
  const value = (contentType || '').toLowerCase();
  if (value.includes('json')) return 'json' as const;
  if (value.includes('xml')) return 'xml' as const;
  if (value.includes('html')) return 'html' as const;
  if (value.includes('javascript')) return 'javascript' as const;
  return 'text' as const;
}

function PairRows({ label, entries, onChange, inputClass }: { label: string; entries: HttpKeyValue[]; onChange: (entries: HttpKeyValue[]) => void; inputClass: string }) {
  const update = (index: number, patch: Partial<HttpKeyValue>) => onChange(entries.map((entry, current) => current === index ? { ...entry, ...patch } : entry));
  return <div className='space-y-2'>
    {entries.map((entry, index) => <div className='grid grid-cols-[auto_1fr_1fr_auto] items-center gap-2' key={index}>
      <input aria-label={`${label} ${index + 1} enabled`} type='checkbox' checked={entry.enabled !== false} onChange={(event) => update(index, { enabled: event.target.checked })} />
      <input aria-label={`${label} ${index + 1} key`} className={`min-w-0 rounded-md border px-3 py-2 text-sm ${inputClass}`} placeholder='Key' value={entry.key} onChange={(event) => update(index, { key: event.target.value })} />
      <input aria-label={`${label} ${index + 1} value`} className={`min-w-0 rounded-md border px-3 py-2 text-sm ${inputClass}`} placeholder='Value' value={entry.value} onChange={(event) => update(index, { value: event.target.value })} />
      <button type='button' aria-label={`Remove ${label.toLowerCase()} ${index + 1}`} className='rounded-md border p-2' onClick={() => onChange(entries.filter((_, current) => current !== index))}><Trash2 className='h-4 w-4' /></button>
    </div>)}
    <button type='button' className='inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs' onClick={() => onChange([...entries, emptyPair()])}><Plus className='h-3.5 w-3.5' /> Add field</button>
  </div>;
}

export const ApiClientBodyEditor: React.FC<ApiClientBodyEditorProps> = ({ draft, onChange, theme = 'light' }) => {
  const mode: HttpBodyMode = draft.bodyMode || inferHttpBodyMode(draft);
  const dark = theme === 'dark';
  const inputClass = dark ? 'border-gray-700 bg-gray-900 text-gray-100' : 'border-gray-300 bg-white text-gray-900';
  const knownContentType = CONTENT_TYPES.some(([value]) => value === draft.contentType);
  const contentTypeValue = knownContentType ? draft.contentType || 'application/json' : '__custom__';
  const jsonValidation = useMemo(() => {
    if (mode !== 'json' || !(draft.body || '').trim()) return null;
    try { JSON.parse(draft.body || ''); return ''; } catch (error) { return error instanceof Error ? error.message : 'Invalid JSON'; }
  }, [draft.body, mode]);
  const graphqlValidation = useMemo(() => {
    const variables = draft.graphql?.variables?.trim();
    if (mode !== 'graphql' || !variables) return null;
    try { JSON.parse(variables); return ''; } catch (error) { return error instanceof Error ? error.message : 'Invalid JSON'; }
  }, [draft.graphql?.variables, mode]);

  const setMode = (bodyMode: HttpBodyMode) => {
    const patch: Partial<HttpRequestDraft> = { bodyMode };
    if (bodyMode === 'json' && (!draft.contentType || !draft.contentType.includes('json'))) patch.contentType = 'application/json';
    if (bodyMode === 'raw' && !draft.contentType) patch.contentType = 'text/plain';
    if (bodyMode === 'urlencoded') patch.contentType = 'application/x-www-form-urlencoded';
    if (bodyMode === 'formdata') patch.contentType = undefined;
    if (bodyMode === 'binary' && !draft.contentType) patch.contentType = 'application/octet-stream';
    if (bodyMode === 'graphql') patch.contentType = 'application/json';
    onChange({ ...draft, ...patch });
  };

  const updateForm = (index: number, patch: Partial<HttpFormDataEntry>) => {
    const entries = draft.formData || [emptyForm()];
    onChange({ ...draft, formData: entries.map((entry, current) => current === index ? { ...entry, ...patch } : entry) });
  };

  return <section className='space-y-3' aria-labelledby='api-client-body-heading'>
    <div className='flex flex-wrap items-end justify-between gap-3'>
      <label className='text-sm font-medium'>Body type
        <select aria-label='Request body type' className={`ml-2 rounded-md border px-3 py-2 text-sm ${inputClass}`} value={mode} onChange={(event) => setMode(event.target.value as HttpBodyMode)}>
          <option value='none'>None</option>
          <option value='json'>JSON</option>
          <option value='raw'>Raw</option>
          <option value='urlencoded'>x-www-form-urlencoded</option>
          <option value='formdata'>form-data</option>
          <option value='binary'>Binary</option>
          <option value='graphql'>GraphQL</option>
        </select>
      </label>
      {(mode === 'json' || mode === 'raw' || mode === 'binary') && <div className='flex flex-wrap items-end gap-2'>
        <label className='text-sm font-medium'>Content type
          <select aria-label='Content type' className={`ml-2 rounded-md border px-3 py-2 text-sm ${inputClass}`} value={contentTypeValue} onChange={(event) => {
            const contentType = event.target.value === '__custom__' ? '' : event.target.value;
            onChange({ ...draft, contentType });
          }}>
            {CONTENT_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            <option value='__custom__'>Custom…</option>
          </select>
        </label>
        {contentTypeValue === '__custom__' && <input aria-label='Custom content type' className={`rounded-md border px-3 py-2 text-sm ${inputClass}`} placeholder='application/vnd.example+json' value={draft.contentType || ''} onChange={(event) => onChange({ ...draft, contentType: event.target.value })} />}
      </div>}
    </div>

    {mode === 'none' && <div className={`rounded-md border border-dashed p-4 text-sm ${dark ? 'border-gray-700 text-gray-400' : 'border-gray-300 text-gray-500'}`}>This request has no body.</div>}

    {(mode === 'json' || mode === 'raw') && <div className='space-y-2'>
      <ApiClientCodeEditor ariaLabel='Request body' language={mode === 'json' ? 'json' : languageFor(draft.contentType)} theme={theme} value={draft.body || ''} onChange={(body) => onChange({ ...draft, body })} minLines={9} maxLines={20} />
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <span className={`text-xs ${jsonValidation ? 'text-red-600' : (mode === 'json' && jsonValidation === '' ? 'text-green-600' : (dark ? 'text-gray-400' : 'text-gray-500'))}`}>
          {mode === 'json' ? (jsonValidation ? `Invalid JSON: ${jsonValidation}` : ((draft.body || '').trim() ? 'Valid JSON' : 'Enter a JSON object, array, or value.')) : 'Raw body is sent exactly as entered.'}
        </span>
        {mode === 'json' && <button type='button' className='rounded-md border px-3 py-1.5 text-xs' disabled={!!jsonValidation || !(draft.body || '').trim()} onClick={() => {
          try { onChange({ ...draft, body: JSON.stringify(JSON.parse(draft.body || ''), null, 2) }); } catch { /* validation already shown */ }
        }}>Beautify JSON</button>}
      </div>
    </div>}

    {mode === 'urlencoded' && <div className='space-y-2'>
      <PairRows label='Form field' entries={draft.urlencoded?.length ? draft.urlencoded : [emptyPair()]} inputClass={inputClass} onChange={(urlencoded) => onChange({ ...draft, urlencoded, contentType: 'application/x-www-form-urlencoded' })} />
      <p className={`text-xs ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Enabled fields are URL-encoded at send time. Variable substitution still applies to keys and values.</p>
    </div>}

    {mode === 'formdata' && <div className='space-y-2'>
      {(draft.formData?.length ? draft.formData : [emptyForm()]).map((entry, index) => <div className='grid gap-2 md:grid-cols-[auto_7rem_1fr_1fr_auto]' key={index}>
        <input aria-label={`Form data ${index + 1} enabled`} type='checkbox' checked={entry.enabled !== false} onChange={(event) => updateForm(index, { enabled: event.target.checked })} />
        <select aria-label={`Form data ${index + 1} type`} className={`rounded-md border px-2 py-2 text-sm ${inputClass}`} value={entry.type || 'text'} onChange={(event) => updateForm(index, { type: event.target.value as 'text' | 'file', file: undefined, fileName: undefined })}>
          <option value='text'>Text</option><option value='file'>File</option>
        </select>
        <input aria-label={`Form data ${index + 1} key`} className={`min-w-0 rounded-md border px-3 py-2 text-sm ${inputClass}`} placeholder='Key' value={entry.key} onChange={(event) => updateForm(index, { key: event.target.value })} />
        {entry.type === 'file' ? <label className={`flex min-w-0 cursor-pointer items-center rounded-md border px-3 py-2 text-sm ${inputClass}`}>
          <span className='truncate'>{entry.file?.name || entry.fileName || 'Choose file…'}</span>
          <input aria-label={`Form data ${index + 1} file`} className='sr-only' type='file' onChange={(event) => {
            const file = event.target.files?.[0];
            updateForm(index, { file, fileName: file?.name, contentType: file?.type || undefined });
          }} />
        </label> : <input aria-label={`Form data ${index + 1} value`} className={`min-w-0 rounded-md border px-3 py-2 text-sm ${inputClass}`} placeholder='Value' value={entry.value} onChange={(event) => updateForm(index, { value: event.target.value })} />}
        <button type='button' aria-label={`Remove form data ${index + 1}`} className='rounded-md border p-2' onClick={() => onChange({ ...draft, formData: (draft.formData || []).filter((_, current) => current !== index) })}><Trash2 className='h-4 w-4' /></button>
      </div>)}
      <button type='button' className='inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs' onClick={() => onChange({ ...draft, formData: [...(draft.formData || []), emptyForm()] })}><Plus className='h-3.5 w-3.5' /> Add form-data field</button>
      <p className={`text-xs ${dark ? 'text-gray-400' : 'text-gray-500'}`}>The browser supplies the multipart boundary automatically. Imported Postman file paths must be re-selected from this browser.</p>
    </div>}

    {mode === 'binary' && <div className='space-y-2'>
      <label className={`flex cursor-pointer items-center justify-between gap-3 rounded-md border px-3 py-3 text-sm ${inputClass}`}>
        <span className='min-w-0 truncate'>{draft.binary?.file?.name || draft.binary?.fileName || 'Choose binary file…'}</span>
        <span className='shrink-0 text-xs font-medium'>Browse</span>
        <input aria-label='Binary file' className='sr-only' type='file' onChange={(event) => {
          const file = event.target.files?.[0];
          onChange({
            ...draft,
            contentType: file?.type || draft.contentType || 'application/octet-stream',
            binary: { file, fileName: file?.name || draft.binary?.fileName, contentType: file?.type || draft.binary?.contentType },
          });
        }} />
      </label>
      <p className={`text-xs ${dark ? 'text-gray-400' : 'text-gray-500'}`}>The selected file is sent as the request body without text conversion. Saved requests retain only file metadata, so the browser asks you to re-select the file before a later send or collection run.</p>
    </div>}

    {mode === 'graphql' && <div className='grid gap-3 xl:grid-cols-2'>
      <div className='space-y-1'><div className='text-xs font-medium'>Query</div><ApiClientCodeEditor ariaLabel='GraphQL query' language='graphql' theme={theme} value={draft.graphql?.query || ''} onChange={(query) => onChange({ ...draft, graphql: { query, variables: draft.graphql?.variables || '' } })} minLines={9} maxLines={20} /></div>
      <div className='space-y-1'><div className='text-xs font-medium'>Variables (JSON)</div><ApiClientCodeEditor ariaLabel='GraphQL variables' language='json' theme={theme} value={draft.graphql?.variables || ''} onChange={(variables) => onChange({ ...draft, graphql: { query: draft.graphql?.query || '', variables } })} minLines={9} maxLines={20} /><div className={`text-xs ${graphqlValidation ? 'text-red-600' : (dark ? 'text-gray-400' : 'text-gray-500')}`}>{graphqlValidation ? `Invalid variables JSON: ${graphqlValidation}` : 'Variables are serialized with the query as application/json.'}</div></div>
    </div>}
  </section>;
};
