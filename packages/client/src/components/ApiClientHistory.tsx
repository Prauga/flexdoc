import React from 'react';
import { Clock3, Trash2 } from 'lucide-react';
import type { ApiClientRequestScripts } from '../utils/api-client-scripting';
import type { ApiClientWorkspaceState } from '../utils/api-client-workspace';
import type { HttpRequestDraft } from '../utils/http-client';
import { apiClientHistoryDisplayTime } from '../utils/api-client-history';
import { apiClientTransportObservation, createApiClientTransportReport, resetApiClientTransportObservation } from '../utils/api-client-transport-observation';

interface Props {
  workspace: ApiClientWorkspaceState;
  onWorkspaceChange: React.Dispatch<React.SetStateAction<ApiClientWorkspaceState>>;
  onLoadRequest: (request: HttpRequestDraft, scripts?: ApiClientRequestScripts, collectionId?: string, folderId?: string) => void;
  onViewAll?: () => void;
  theme: 'light' | 'dark';
}

export const ApiClientHistory: React.FC<Props> = ({ workspace, onWorkspaceChange, onLoadRequest, onViewAll, theme }) => {
  const mutedClass = theme === 'dark' ? 'text-gray-400' : 'text-gray-500';
  const [observationCopied, setObservationCopied] = React.useState(false);

  const copyObservation = async () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(createApiClientTransportReport(apiClientTransportObservation()), null, 2));
      setObservationCopied(true);
      window.setTimeout(() => setObservationCopied(false), 1500);
    } catch {
      setObservationCopied(false);
    }
  };

  const loadHistory = (id: string) => {
    const entry = workspace.history.find((candidate) => candidate.id === id);
    if (!entry) return;
    onLoadRequest(entry.request, entry.scripts, entry.collectionId, entry.folderId);
  };

  const removeHistory = (id: string) => {
    const entry = workspace.history.find((candidate) => candidate.id === id);
    if (!entry) return;
    if (typeof window !== 'undefined' && !window.confirm(`Delete this history entry?\n\n${entry.executedMethod.toUpperCase()} ${entry.resolvedUrl}`)) return;
    onWorkspaceChange((current) => ({ ...current, history: current.history.filter((candidate) => candidate.id !== id) }));
  };

  return <section className='space-y-3' aria-labelledby='api-client-history-heading'>
    <div className='flex items-center justify-between gap-2'>
      <div className='flex items-center gap-2'>
        <Clock3 className='h-4 w-4' />
        <h3 id='api-client-history-heading' className='font-semibold'>Recent history</h3>
      </div>
      {workspace.history.length > 0 && onViewAll && <button type='button' className={`text-xs underline underline-offset-2 ${mutedClass}`} onClick={onViewAll}>View all</button>}
    </div>

    <label className='flex items-center gap-2 rounded-md border p-2 text-xs' title='Sensitive history headers are always redacted.'>
      <input type='checkbox' checked={workspace.historyBodies !== false} onChange={(event) => onWorkspaceChange((current) => ({ ...current, historyBodies: event.target.checked }))} />
      <span>Store API-host bodies</span>
    </label>

    <div className='flex items-center justify-between gap-2 rounded-md border p-2 text-xs'>
      <span className={mutedClass} title='Counts and duration percentiles for this tab. No URLs, headers, bodies or credentials.'>Transport observation</span>
      <span className='flex items-center gap-2'>
        <button type='button' className='underline underline-offset-2' onClick={copyObservation}>{observationCopied ? 'Copied' : 'Copy'}</button>
        <button type='button' className={`underline underline-offset-2 ${mutedClass}`} onClick={() => { resetApiClientTransportObservation(); setObservationCopied(false); }}>Reset</button>
      </span>
    </div>

    <div className='space-y-1'>
      {workspace.history.slice(0, 5).map((entry) => {
        const result = entry.status !== undefined
          ? `${entry.status}${entry.statusText ? ` ${entry.statusText}` : ''}`
          : entry.error ? 'Error' : 'Sent';
        const timing = entry.responseTime !== undefined ? ` · ${entry.responseTime} ms` : '';
        const passedTests = entry.scriptTests?.filter((test) => test.passed).length || 0;
        const testSummary = entry.scriptTests?.length ? `${passedTests}/${entry.scriptTests.length} tests passed` : entry.scriptError ? 'Script error' : undefined;
        return <div key={entry.id} className='group flex items-start gap-1 rounded-md'>
          <button
            type='button'
            className='min-w-0 flex-1 rounded-md px-2 py-2 text-left hover:bg-blue-500/10'
            aria-label={`Load history request ${entry.executedMethod.toUpperCase()} ${entry.resolvedUrl}`}
            onClick={() => loadHistory(entry.id)}
          >
            <div className='flex items-center gap-2 text-xs'>
              <span className='font-mono font-semibold text-blue-600'>{entry.executedMethod.toUpperCase()}</span>
              <span className={entry.error ? 'text-red-600' : mutedClass}>{result}{timing}</span>
            </div>
            <div className='truncate font-mono text-xs' title={entry.resolvedUrl}>{entry.resolvedUrl}</div>
            {testSummary && <div className={`mt-1 text-[11px] ${entry.scriptError ? 'text-red-600' : mutedClass}`}>{testSummary}</div>}
            <div className={`mt-1 text-[11px] ${mutedClass}`}>{apiClientHistoryDisplayTime(entry.createdAt)}</div>
          </button>
          <button type='button' className='rounded-md p-2 opacity-70 hover:opacity-100' aria-label={`Delete history request ${entry.executedMethod.toUpperCase()} ${entry.resolvedUrl}`} onClick={() => removeHistory(entry.id)}>
            <Trash2 className='h-4 w-4' />
          </button>
        </div>;
      })}
      {workspace.history.length === 0 && <div className={`rounded-md border border-dashed px-3 py-3 text-xs ${mutedClass}`}>Sent requests appear here for quick replay. Import or open a collection request, then Send it to start building history.</div>}
    </div>

    {workspace.history.length > 0 && onViewAll && <button type='button' className='w-full rounded-md border px-3 py-2 text-xs font-medium hover:bg-blue-500/10' onClick={onViewAll}>Open full history · {workspace.history.length}</button>}
  </section>;
};
