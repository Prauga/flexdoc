import React from 'react';
import { Clock3, Trash2 } from 'lucide-react';
import { cloneApiClientScripts } from '../utils/api-client-scripting';
import type { ApiClientRequestScripts } from '../utils/api-client-scripting';
import { cloneRequestDraft } from '../utils/api-client-workspace';
import type { ApiClientWorkspaceState } from '../utils/api-client-workspace';
import type { HttpRequestDraft } from '../utils/http-client';

interface Props {
  workspace: ApiClientWorkspaceState;
  onWorkspaceChange: React.Dispatch<React.SetStateAction<ApiClientWorkspaceState>>;
  onLoadRequest: (request: HttpRequestDraft, scripts?: ApiClientRequestScripts) => void;
  theme: 'light' | 'dark';
}

function displayTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export const ApiClientHistory: React.FC<Props> = ({ workspace, onWorkspaceChange, onLoadRequest, theme }) => {
  const mutedClass = theme === 'dark' ? 'text-gray-400' : 'text-gray-500';

  const loadHistory = (id: string) => {
    const entry = workspace.history.find((candidate) => candidate.id === id);
    if (!entry) return;
    onLoadRequest(
      cloneRequestDraft(entry.request),
      entry.scripts ? cloneApiClientScripts(entry.scripts) : undefined,
    );
  };

  const removeHistory = (id: string) => {
    onWorkspaceChange((current) => ({ ...current, history: current.history.filter((entry) => entry.id !== id) }));
  };

  const clearHistory = () => {
    onWorkspaceChange((current) => ({ ...current, history: [] }));
  };

  return <section className='space-y-3' aria-labelledby='api-client-history-heading'>
    <div className='flex items-center justify-between gap-2'>
      <div className='flex items-center gap-2'>
        <Clock3 className='h-4 w-4' />
        <h3 id='api-client-history-heading' className='font-semibold'>History</h3>
      </div>
      {workspace.history.length > 0 && <button type='button' className={`text-xs underline underline-offset-2 ${mutedClass}`} onClick={clearHistory}>Clear history</button>}
    </div>

    <div className='space-y-1'>
      {workspace.history.map((entry) => {
        const result = entry.status !== undefined
          ? `${entry.status}${entry.statusText ? ` ${entry.statusText}` : ''}`
          : entry.error ? 'Error' : 'Sent';
        const timing = entry.responseTime !== undefined ? ` · ${entry.responseTime} ms` : '';
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
            <div className={`mt-1 text-[11px] ${mutedClass}`}>{displayTime(entry.createdAt)}</div>
          </button>
          <button type='button' className='rounded-md p-2 opacity-70 hover:opacity-100' aria-label={`Delete history request ${entry.executedMethod.toUpperCase()} ${entry.resolvedUrl}`} onClick={() => removeHistory(entry.id)}>
            <Trash2 className='h-4 w-4' />
          </button>
        </div>;
      })}
      {workspace.history.length === 0 && <p className={`px-2 text-xs ${mutedClass}`}>Sent requests appear here for quick replay.</p>}
    </div>
  </section>;
};
