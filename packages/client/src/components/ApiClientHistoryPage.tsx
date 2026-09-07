
import React, { useMemo, useState } from 'react';
import { ArrowLeft, Clock3, RotateCcw, Search, Trash2 } from 'lucide-react';
import { cloneApiClientScripts } from '../utils/api-client-scripting';
import type { ApiClientRequestScripts } from '../utils/api-client-scripting';
import { cloneRequestDraft } from '../utils/api-client-workspace';
import type { ApiClientHistoryEntry, ApiClientWorkspaceState } from '../utils/api-client-workspace';
import { filterApiClientHistoryEntries, groupApiClientHistoryEntries } from '../utils/api-client-history';
import type { ApiClientHistoryOutcomeFilter, ApiClientHistoryRunGroup } from '../utils/api-client-history';
import type { HttpKeyValue, HttpRequestDraft } from '../utils/http-client';

export interface ApiClientHistoryPageProps {
  workspace: ApiClientWorkspaceState;
  onWorkspaceChange: React.Dispatch<React.SetStateAction<ApiClientWorkspaceState>>;
  onLoadRequest: (request: HttpRequestDraft, scripts?: ApiClientRequestScripts, collectionId?: string, folderId?: string) => void;
  onBack: () => void;
  theme: 'light' | 'dark';
  initialEntryId?: string;
  initialRunId?: string;
}

function displayTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function hasFailure(entry: ApiClientHistoryEntry): boolean {
  return !!entry.error
    || !!entry.scriptError
    || (entry.status !== undefined && entry.status >= 400)
    || !!entry.scriptTests?.some((test) => !test.passed);
}

function resultLabel(entry: ApiClientHistoryEntry): string {
  if (entry.error) return 'Request failed';
  if (entry.status !== undefined) return `${entry.status}${entry.statusText ? ` ${entry.statusText}` : ''}`;
  return 'Sent';
}

function enabledPairs(values: HttpKeyValue[] | undefined): HttpKeyValue[] {
  return (values || []).filter((value) => value.enabled !== false && (value.key.trim() || value.value.trim()));
}

function PairDetails({ title, values, mutedClass }: { title: string; values: HttpKeyValue[] | undefined; mutedClass: string }) {
  const visible = enabledPairs(values);
  if (visible.length === 0) return null;
  return <section className='space-y-2'>
    <h4 className='text-xs font-semibold uppercase tracking-wide'>{title}</h4>
    <div className='overflow-hidden rounded-md border'>
      {visible.map((entry, index) => <div key={`${entry.key}:${index}`} className='grid grid-cols-[minmax(8rem,0.35fr)_minmax(0,1fr)] gap-3 border-b px-3 py-2 text-xs last:border-b-0'>
        <span className='break-all font-mono font-medium'>{entry.key || '—'}</span>
        <span className={`break-all font-mono ${mutedClass}`}>{entry.value}</span>
      </div>)}
    </div>
  </section>;
}

function runnerSummary(group: ApiClientHistoryRunGroup): string {
  const pieces = [`${group.passed} runner passed`, `${group.failed} runner failed`];
  if (group.cancelled) pieces.push(`${group.cancelled} cancelled`);
  return pieces.join(' · ');
}

export const ApiClientHistoryPage: React.FC<ApiClientHistoryPageProps> = ({ workspace, onWorkspaceChange, onLoadRequest, onBack, theme, initialEntryId, initialRunId }) => {
  const [query, setQuery] = useState('');
  const [method, setMethod] = useState('all');
  const [outcome, setOutcome] = useState<ApiClientHistoryOutcomeFilter>('all');
  const [selectedId, setSelectedId] = useState<string | undefined>(initialRunId ? undefined : initialEntryId || workspace.history[0]?.id);
  const [selectedRunId, setSelectedRunId] = useState<string | undefined>(initialRunId);
  const inputClass = theme === 'dark' ? 'border-gray-700 bg-gray-900 text-gray-100' : 'border-gray-300 bg-white text-gray-900';
  const panelClass = theme === 'dark' ? 'border-gray-700 bg-gray-800/60 text-gray-100' : 'border-gray-200 bg-gray-50 text-gray-900';
  const mutedClass = theme === 'dark' ? 'text-gray-400' : 'text-gray-500';
  const codeClass = theme === 'dark' ? 'border-gray-700 bg-gray-950 text-gray-100' : 'border-gray-200 bg-white text-gray-900';

  const filtered = useMemo(() => filterApiClientHistoryEntries(workspace, { query, method, outcome }), [method, outcome, query, workspace]);
  const blocks = useMemo(() => groupApiClientHistoryEntries(filtered), [filtered]);
  const selectedRun = selectedRunId
    ? blocks.find((block) => block.kind === 'run' && block.group.runId === selectedRunId)?.kind === 'run'
      ? (blocks.find((block) => block.kind === 'run' && block.group.runId === selectedRunId) as { kind: 'run'; group: ApiClientHistoryRunGroup }).group
      : undefined
    : undefined;
  const selected = selectedRun ? undefined : filtered.find((entry) => entry.id === selectedId) || filtered[0];
  const collection = selected?.collectionId ? workspace.collections.find((candidate) => candidate.id === selected.collectionId) : undefined;
  const folder = selected?.folderId ? workspace.folders.find((candidate) => candidate.id === selected.folderId) : undefined;

  const resetSelection = () => { setSelectedId(undefined); setSelectedRunId(undefined); };
  const selectEntry = (entryId: string) => { setSelectedId(entryId); setSelectedRunId(undefined); };
  const selectRun = (runId: string) => { setSelectedRunId(runId); setSelectedId(undefined); };

  const openInClient = (entry: ApiClientHistoryEntry) => {
    onLoadRequest(cloneRequestDraft(entry.request), entry.scripts ? cloneApiClientScripts(entry.scripts) : undefined, entry.collectionId, entry.folderId);
    onBack();
  };

  const removeHistory = (id: string) => {
    if (!window.confirm('Delete this history entry? This cannot be undone.')) return;
    onWorkspaceChange((current) => ({ ...current, history: current.history.filter((entry) => entry.id !== id) }));
    if (selectedId === id) setSelectedId(undefined);
  };

  const clearHistory = () => {
    if (!window.confirm('Clear all request history? This cannot be undone.')) return;
    onWorkspaceChange((current) => ({ ...current, history: [] }));
    resetSelection();
  };

  const responseHeaders = selected?.responseHeaders || [];
  const passedTests = selected?.scriptTests?.filter((test) => test.passed).length || 0;

  return <section className={`rounded-xl border p-4 md:p-5 ${panelClass}`} aria-labelledby='api-client-history-page-heading'>
    <div className='space-y-4'>
      <header className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
        <div className='flex items-center gap-3'>
          <button type='button' className='inline-flex min-h-10 items-center gap-2 rounded-md border px-3 py-2 text-sm' onClick={onBack}><ArrowLeft className='h-4 w-4' /> Client</button>
          <div>
            <div className='flex items-center gap-2'><Clock3 className='h-5 w-5' /><h2 id='api-client-history-page-heading' className='text-lg font-semibold'>Request history</h2></div>
            <p className={`text-xs ${mutedClass}`}>{workspace.history.length} persisted request{workspace.history.length === 1 ? '' : 's'} · newest first</p>
          </div>
        </div>
        {workspace.history.length > 0 && <button type='button' className='inline-flex min-h-10 items-center gap-2 self-start rounded-md border px-3 py-2 text-sm text-red-600' onClick={clearHistory}><Trash2 className='h-4 w-4' /> Clear history</button>}
      </header>

      <div className='grid gap-2 md:grid-cols-[minmax(0,1fr)_10rem_12rem]'>
        <label className='relative'>
          <span className='sr-only'>Search history</span>
          <Search className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${mutedClass}`} />
          <input aria-label='Search history' className={`w-full rounded-md border py-2 pl-9 pr-3 text-sm ${inputClass}`} value={query} onChange={(event) => { setQuery(event.target.value); resetSelection(); }} placeholder='Search URL, status, collection or run…' />
        </label>
        <select aria-label='History method filter' className={`rounded-md border px-3 py-2 text-sm ${inputClass}`} value={method} onChange={(event) => { setMethod(event.target.value); resetSelection(); }}>
          <option value='all'>All methods</option>
          {['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
        <select aria-label='History outcome filter' className={`rounded-md border px-3 py-2 text-sm ${inputClass}`} value={outcome} onChange={(event) => { setOutcome(event.target.value as ApiClientHistoryOutcomeFilter); resetSelection(); }}>
          <option value='all'>All outcomes</option>
          <option value='success'>Successful HTTP</option>
          <option value='failed'>HTTP / script failures</option>
          <option value='tests'>With tests</option>
        </select>
      </div>

      <div className='grid min-h-[32rem] gap-4 lg:grid-cols-[minmax(18rem,0.85fr)_minmax(0,1.35fr)]'>
        <div className='max-h-[48rem] space-y-2 overflow-auto rounded-lg border p-2'>
          {blocks.map((block) => {
            if (block.kind === 'entry') {
              const entry = block.entry;
              const active = selected?.id === entry.id;
              const failed = hasFailure(entry);
              const origin = entry.collectionId ? workspace.collections.find((candidate) => candidate.id === entry.collectionId)?.name || 'Deleted collection' : undefined;
              return <button key={entry.id} type='button' className={`w-full rounded-md border px-3 py-3 text-left transition ${active ? 'border-blue-500 bg-blue-500/10' : 'border-transparent hover:bg-blue-500/5'}`} onClick={() => selectEntry(entry.id)}>
                <div className='flex items-center justify-between gap-3 text-xs'><span className='font-mono font-semibold text-blue-600'>{entry.executedMethod.toUpperCase()}</span><span className={failed ? 'text-red-600' : mutedClass}>{resultLabel(entry)}{entry.responseTime !== undefined ? ` · ${entry.responseTime} ms` : ''}</span></div>
                <div className='mt-1 truncate font-mono text-xs' title={entry.resolvedUrl}>{entry.resolvedUrl}</div>
                <div className={`mt-1 flex items-center justify-between gap-2 text-[11px] ${mutedClass}`}><span className='truncate'>{origin || 'Unsaved request'}</span><span>{displayTime(entry.createdAt)}</span></div>
              </button>;
            }
            const group = block.group;
            const active = selectedRun?.runId === group.runId;
            return <div key={group.runId} className={`rounded-lg border ${active ? 'border-blue-500 bg-blue-500/5' : ''}`}>
              <button type='button' aria-label={`Open collection run ${group.runName}`} className='w-full px-3 py-3 text-left' onClick={() => selectRun(group.runId)}>
                <div className='text-xs font-semibold text-blue-600'>Collection run</div>
                <div className='mt-1 truncate text-sm font-medium'>{group.runName}</div>
                <div className={`mt-1 text-[11px] ${mutedClass}`}>{group.captured}/{group.total} history entries · {runnerSummary(group)}</div>
              </button>
              <div className='border-t px-2 py-1'>
                {group.entries.map((entry) => <button key={entry.id} type='button' className={`w-full rounded-md px-2 py-2 text-left text-xs hover:bg-blue-500/10 ${selected?.id === entry.id ? 'bg-blue-500/10' : ''}`} onClick={() => selectEntry(entry.id)}>
                  <div className='flex items-center justify-between gap-2'><span><span className='mr-2 text-[10px] text-gray-500'>{entry.runIndex || '–'}</span><span className='font-mono font-semibold text-blue-600'>{entry.executedMethod.toUpperCase()}</span></span><span className={hasFailure(entry) ? 'text-red-600' : mutedClass}>{resultLabel(entry)}</span></div>
                  <div className='mt-1 truncate font-mono' title={entry.resolvedUrl}>{entry.resolvedUrl}</div>
                </button>)}
              </div>
            </div>;
          })}
          {filtered.length === 0 && <div className={`px-3 py-8 text-center text-sm ${mutedClass}`}>{workspace.history.length === 0 ? 'Send a request to start building history.' : 'No history entries match these filters.'}</div>}
        </div>

        <div className='min-w-0 rounded-lg border p-4'>
          {selectedRun && <div className='space-y-4'>
            <div className='border-b pb-4'>
              <div className='text-xs font-semibold uppercase tracking-wide text-blue-600'>Collection run</div>
              <h3 className='mt-1 text-lg font-semibold'>{selectedRun.runName}</h3>
              <p className={`mt-1 text-sm ${mutedClass}`}>{selectedRun.captured} / {selectedRun.total} history entries captured · {runnerSummary(selectedRun)}</p>
              <p className={`mt-2 text-xs ${mutedClass}`}>Runner pass/fail is based on transport, scripts, and tests. An HTTP 4xx/5xx can therefore be a runner pass while still appearing as an HTTP failure in the request inspector.</p>
            </div>
            <div className='space-y-2'>
              {selectedRun.entries.map((entry) => <button key={entry.id} type='button' aria-label={`Inspect history ${entry.runIndex || ''}`} className='w-full rounded-md border px-3 py-3 text-left hover:bg-blue-500/5' onClick={() => selectEntry(entry.id)}>
                <div className='flex flex-wrap items-center justify-between gap-2 text-sm'><span><span className={`mr-2 text-xs ${mutedClass}`}>{entry.runIndex || '–'}</span><span className='font-mono font-bold text-blue-600'>{entry.executedMethod.toUpperCase()}</span></span><span className={entry.runPassed === false ? 'text-red-600' : entry.runPassed === true ? 'text-green-600' : mutedClass}>{entry.runPassed === true ? 'Runner pass' : entry.runPassed === false ? 'Runner fail' : 'Recorded'}{entry.status !== undefined ? ` · HTTP ${entry.status}` : ''}</span></div>
                <div className='mt-1 truncate font-mono text-xs'>{entry.resolvedUrl}</div>
              </button>)}
            </div>
          </div>}

          {!selectedRun && !selected && <div className={`flex min-h-[20rem] items-center justify-center text-sm ${mutedClass}`}>Select a history entry or collection run to inspect it.</div>}
          {selected && <div className='space-y-5'>
            <div className='space-y-2 border-b pb-4'>
              <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
                <div className='min-w-0'>
                  <div className='flex flex-wrap items-center gap-2 text-sm'><span className='font-mono font-bold text-blue-600'>{selected.executedMethod.toUpperCase()}</span><span className={hasFailure(selected) ? 'text-red-600' : mutedClass}>{resultLabel(selected)}</span>{selected.responseTime !== undefined && <span className={mutedClass}>{selected.responseTime} ms</span>}{selected.runPassed !== undefined && <span className={selected.runPassed ? 'text-green-600' : 'text-red-600'}>{selected.runPassed ? 'Runner pass' : 'Runner fail'}</span>}</div>
                  <div className='mt-1 break-all font-mono text-sm'>{selected.resolvedUrl}</div>
                  <div className={`mt-1 text-xs ${mutedClass}`}>{displayTime(selected.createdAt)}{selected.collectionId ? ` · ${collection?.name || 'Deleted collection'}` : ''}{selected.folderId ? ` / ${folder?.name || 'Deleted folder'}` : ''}{selected.runName ? ` · Run: ${selected.runName}` : ''}</div>
                </div>
                <div className='flex shrink-0 gap-2'>
                  <button type='button' className='inline-flex min-h-10 items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-blue-500/10' onClick={() => openInClient(selected)}><RotateCcw className='h-4 w-4' /> Open in client</button>
                  <button type='button' aria-label='Delete selected history entry' className='inline-flex min-h-10 items-center rounded-md border px-3 py-2 text-red-600' onClick={() => removeHistory(selected.id)}><Trash2 className='h-4 w-4' /></button>
                </div>
              </div>
              {selected.error && <div className='rounded-md border border-red-300 bg-red-500/10 px-3 py-2 text-sm text-red-700'>{selected.error}</div>}
            </div>

            <section className='space-y-3'>
              <h3 className='font-semibold'>Request</h3>
              <div className='grid gap-3 text-xs sm:grid-cols-2'><div><span className={mutedClass}>Original URL</span><div className='mt-1 break-all font-mono'>{selected.request.url}</div></div><div><span className={mutedClass}>Content type</span><div className='mt-1 font-mono'>{selected.request.contentType || '—'}</div></div></div>
              <PairDetails title='Query parameters' values={selected.request.query} mutedClass={mutedClass} />
              <PairDetails title='Headers' values={selected.request.headers} mutedClass={mutedClass} />
              {selected.request.body && <div className='space-y-2'><h4 className='text-xs font-semibold uppercase tracking-wide'>Body</h4><pre className={`max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-md border p-3 text-xs ${codeClass}`}>{selected.request.body}</pre></div>}
            </section>

            <section className='space-y-3 border-t pt-4'>
              <div className='flex items-center justify-between gap-2'><h3 className='font-semibold'>Response</h3>{selected.responseBodyTruncated && <span className='text-xs text-amber-600'>Body truncated in history</span>}</div>
              {responseHeaders.length > 0 && <div className='space-y-2'><h4 className='text-xs font-semibold uppercase tracking-wide'>Headers</h4><div className='overflow-hidden rounded-md border'>{responseHeaders.map(([key, value], index) => <div key={`${key}:${index}`} className='grid grid-cols-[minmax(8rem,0.35fr)_minmax(0,1fr)] gap-3 border-b px-3 py-2 text-xs last:border-b-0'><span className='break-all font-mono font-medium'>{key}</span><span className={`break-all font-mono ${mutedClass}`}>{value}</span></div>)}</div></div>}
              {selected.responseBody !== undefined ? <div className='space-y-2'><h4 className='text-xs font-semibold uppercase tracking-wide'>Body</h4><pre className={`max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-md border p-3 text-xs ${codeClass}`}>{selected.responseBody || '(empty response body)'}</pre></div> : <p className={`text-sm ${mutedClass}`}>Response payload was not captured for this older history entry.</p>}
            </section>

            {(selected.scriptTests?.length || selected.scriptError || selected.scriptLogs?.length) && <section className='space-y-3 border-t pt-4'>
              <h3 className='font-semibold'>Tests & console</h3>
              {selected.scriptTests?.length ? <div className='space-y-1'><div className={`text-xs ${mutedClass}`}>{passedTests}/{selected.scriptTests.length} tests passed</div>{selected.scriptTests.map((test, index) => <div key={`${test.name}:${index}`} className={`rounded-md border px-3 py-2 text-sm ${test.passed ? '' : 'border-red-300 bg-red-500/10 text-red-700'}`}><span className='font-medium'>{test.passed ? '✓' : '✕'} {test.name}</span>{test.error && <div className='mt-1 text-xs'>{test.error}</div>}</div>)}</div> : null}
              {selected.scriptError && <div className='rounded-md border border-red-300 bg-red-500/10 px-3 py-2 text-sm text-red-700'>{selected.scriptError}</div>}
              {selected.scriptLogs?.length ? <pre className={`max-h-56 overflow-auto whitespace-pre-wrap rounded-md border p-3 text-xs ${codeClass}`}>{selected.scriptLogs.join('\n')}</pre> : null}
            </section>}

            {(selected.scripts?.preRequest.trim() || selected.scripts?.tests.trim()) && <section className='space-y-3 border-t pt-4'>
              <h3 className='font-semibold'>Scripts used</h3>
              {selected.scripts?.preRequest.trim() && <div className='space-y-2'><h4 className='text-xs font-semibold uppercase tracking-wide'>Pre-request</h4><pre className={`max-h-56 overflow-auto whitespace-pre-wrap rounded-md border p-3 text-xs ${codeClass}`}>{selected.scripts.preRequest}</pre></div>}
              {selected.scripts?.tests.trim() && <div className='space-y-2'><h4 className='text-xs font-semibold uppercase tracking-wide'>Tests</h4><pre className={`max-h-56 overflow-auto whitespace-pre-wrap rounded-md border p-3 text-xs ${codeClass}`}>{selected.scripts.tests}</pre></div>}
            </section>}
          </div>}
        </div>
      </div>
    </div>
  </section>;
};
