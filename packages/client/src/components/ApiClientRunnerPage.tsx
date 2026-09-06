
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, Clock3, History, Loader2, Play, Square, XCircle } from 'lucide-react';
import type { ExecuteApiClientRequestOptions } from '../utils/api-client-execution';
import { apiClientCollectionRunName, apiClientCollectionRunRequests, runApiClientCollection } from '../utils/api-client-runner';
import type { ApiClientCollectionRunItem, ApiClientCollectionRunResult } from '../utils/api-client-runner';
import type { ApiClientScriptCollectionChange, ApiClientScriptEnvironmentChange } from '../utils/api-client-scripting';
import type { ApiClientSavedRequest, ApiClientWorkspaceState } from '../utils/api-client-workspace';
import type { HttpVariables } from '../utils/http-client';

export interface ApiClientRunnerPageProps {
  workspace: ApiClientWorkspaceState;
  onWorkspaceChange: React.Dispatch<React.SetStateAction<ApiClientWorkspaceState>>;
  collectionId: string;
  folderId?: string;
  theme: 'light' | 'dark';
  credentials?: RequestCredentials;
  requestInterceptor?: ExecuteApiClientRequestOptions['requestInterceptor'];
  externalVariables?: HttpVariables;
  externalEnvironmentVariables?: HttpVariables;
  onCollectionChanges?: (changes: ApiClientScriptCollectionChange[]) => void;
  onEnvironmentChanges?: (changes: ApiClientScriptEnvironmentChange[]) => void;
  onOpenHistory: (entryId?: string, runId?: string) => void;
  onBack: () => void;
  fetcher?: typeof globalThis.fetch;
}

type RowStatus = 'pending' | 'running' | 'passed' | 'failed' | 'cancelled' | 'skipped';
interface RowState { status: RowStatus; item?: ApiClientCollectionRunItem }

function folderPath(workspace: ApiClientWorkspaceState, request: ApiClientSavedRequest): string {
  if (!request.folderId) return 'Collection root';
  const byId = new Map(workspace.folders.map((folder) => [folder.id, folder]));
  const names: string[] = [];
  const seen = new Set<string>();
  let current = byId.get(request.folderId);
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    names.unshift(current.name);
    current = current.parentFolderId ? byId.get(current.parentFolderId) : undefined;
  }
  return names.join(' / ') || 'Deleted folder';
}

function statusLabel(state: RowState): string {
  if (state.status === 'running') return 'Running';
  if (state.status === 'passed') return 'Runner pass';
  if (state.status === 'failed') return 'Runner fail';
  if (state.status === 'cancelled') return 'Cancelled';
  if (state.status === 'skipped') return 'Not run';
  return 'Pending';
}

export const ApiClientRunnerPage: React.FC<ApiClientRunnerPageProps> = ({
  workspace,
  onWorkspaceChange,
  collectionId,
  folderId,
  theme,
  credentials,
  requestInterceptor,
  externalVariables,
  externalEnvironmentVariables,
  onCollectionChanges,
  onEnvironmentChanges,
  onOpenHistory,
  onBack,
  fetcher,
}) => {
  const queue = useMemo(() => apiClientCollectionRunRequests(workspace, collectionId, folderId), [collectionId, folderId, workspace]);
  const runName = useMemo(() => apiClientCollectionRunName(workspace, collectionId, folderId), [collectionId, folderId, workspace]);
  const activeEnvironment = workspace.environments.find((environment) => environment.id === workspace.activeEnvironmentId);
  const [stopOnFailure, setStopOnFailure] = useState(false);
  const [running, setRunning] = useState(false);
  const [summary, setSummary] = useState<ApiClientCollectionRunResult>();
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const abortRef = useRef<AbortController | undefined>(undefined);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const startRun = async () => {
    if (running || queue.length === 0) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    setSummary(undefined);
    setRows(Object.fromEntries(queue.map((request) => [request.id, { status: 'pending' as RowStatus }])));

    const result = await runApiClientCollection({
      workspace,
      collectionId,
      folderId,
      runName,
      credentials,
      requestInterceptor,
      externalVariables,
      externalEnvironmentVariables,
      stopOnFailure,
      signal: controller.signal,
      fetcher,
      onCollectionChanges,
      onEnvironmentChanges,
      onRequestStart: (request) => {
        if (!mountedRef.current) return;
        setRows((current) => ({ ...current, [request.id]: { status: 'running' } }));
      },
      onRequestComplete: (item) => {
        if (!mountedRef.current) return;
        setRows((current) => ({
          ...current,
          [item.requestId]: {
            status: item.cancelled ? 'cancelled' : item.passed ? 'passed' : 'failed',
            item,
          },
        }));
      },
    });

    if (!mountedRef.current) return;
    onWorkspaceChange(result.workspace);
    setRows((current) => Object.fromEntries(queue.map((request) => {
      const existing = current[request.id] || { status: 'pending' as RowStatus };
      return [request.id, existing.status === 'pending' && result.stopped ? { status: 'skipped' as RowStatus } : existing];
    })));
    setSummary(result);
    setRunning(false);
    abortRef.current = undefined;
  };

  const stopRun = () => abortRef.current?.abort();
  const panelClass = theme === 'dark' ? 'border-gray-700 bg-gray-800/60 text-gray-100' : 'border-gray-200 bg-gray-50 text-gray-900';
  const mutedClass = theme === 'dark' ? 'text-gray-400' : 'text-gray-500';
  const rowClass = theme === 'dark' ? 'border-gray-700 bg-gray-900/40' : 'border-gray-200 bg-white';

  return <section className={`rounded-xl border p-4 md:p-5 ${panelClass}`} aria-labelledby='api-client-runner-heading'>
    <div className='space-y-5'>
      <header className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
        <div className='flex items-start gap-3'>
          <button type='button' className='inline-flex min-h-10 items-center gap-2 rounded-md border px-3 py-2 text-sm' onClick={onBack}><ArrowLeft className='h-4 w-4' /> Client</button>
          <div>
            <div className='flex items-center gap-2'><Play className='h-5 w-5' /><h2 id='api-client-runner-heading' className='text-lg font-semibold'>Collection runner</h2></div>
            <p className='mt-1 text-sm font-medium'>{runName}</p>
            <p className={`mt-1 text-xs ${mutedClass}`}>{queue.length} saved request{queue.length === 1 ? '' : 's'} · Environment: {activeEnvironment?.name || 'None'}</p>
          </div>
        </div>
        <div className='flex flex-wrap items-center gap-2'>
          {summary?.runId && <button type='button' className='inline-flex min-h-10 items-center gap-2 rounded-md border px-3 py-2 text-sm' onClick={() => onOpenHistory(undefined, summary.runId)}><History className='h-4 w-4' /> Open run history</button>}
          {running ? <button type='button' className='inline-flex min-h-10 items-center gap-2 rounded-md border border-red-300 px-3 py-2 text-sm text-red-700' onClick={stopRun}><Square className='h-4 w-4' /> Stop run</button> : <button type='button' disabled={queue.length === 0} className='inline-flex min-h-10 items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50' onClick={() => void startRun()}><Play className='h-4 w-4' /> {summary ? 'Run again' : 'Start run'}</button>}
        </div>
      </header>

      <div className='flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between'>
        <label className='inline-flex items-center gap-2 text-sm'>
          <input type='checkbox' checked={stopOnFailure} disabled={running} onChange={(event) => setStopOnFailure(event.target.checked)} />
          Stop on runner failure
        </label>
        <p className={`text-xs ${mutedClass}`}>Runner failure means transport/script/test failure. HTTP 4xx/5xx alone does not fail an item.</p>
      </div>

      {summary && <div className='grid gap-2 sm:grid-cols-5'>
        <div className='rounded-md border px-3 py-2 text-sm'><div className={mutedClass}>Progress</div><strong>{summary.completed} / {summary.total}</strong></div>
        <div className='rounded-md border px-3 py-2 text-sm'><div className={mutedClass}>Passed</div><strong className='text-green-600'>{summary.passed}</strong></div>
        <div className='rounded-md border px-3 py-2 text-sm'><div className={mutedClass}>Failed</div><strong className='text-red-600'>{summary.failed}</strong></div>
        <div className='rounded-md border px-3 py-2 text-sm'><div className={mutedClass}>Cancelled</div><strong>{summary.cancelled}</strong></div>
        <div className='rounded-md border px-3 py-2 text-sm'><div className={mutedClass}>Run</div><strong>{summary.stopped ? 'Stopped' : 'Complete'}</strong></div>
      </div>}

      <section className='space-y-3' aria-labelledby='api-client-runner-order-heading'>
        <div>
          <h3 id='api-client-runner-order-heading' className='font-semibold'>Execution order</h3>
          <p className={`text-xs ${mutedClass}`}>Requests execute sequentially in saved-request order. Folder runs include descendant folders; this list is the exact order that will run.</p>
        </div>
        {queue.map((request, index) => {
          const state = rows[request.id] || { status: 'pending' as RowStatus };
          const result = state.item?.outcome.result;
          const tests = state.item?.outcome.scriptTests || [];
          const passedTests = tests.filter((test) => test.passed).length;
          const httpError = result?.status !== undefined && result.status >= 400;
          return <div key={request.id} data-runner-request-id={request.id} className={`rounded-lg border p-3 ${rowClass}`}>
            <div className='flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between'>
              <div className='min-w-0'>
                <div className='flex flex-wrap items-center gap-2 text-sm'>
                  <span className={`text-xs ${mutedClass}`}>{index + 1}</span>
                  <span className='font-mono font-bold text-blue-600'>{request.request.method.toUpperCase()}</span>
                  <span className='font-medium'>{request.name}</span>
                </div>
                <div className={`mt-1 text-xs ${mutedClass}`}>{folderPath(workspace, request)}</div>
                <div className='mt-1 truncate font-mono text-xs' title={request.request.url}>{request.request.url}</div>
              </div>
              <div className='flex shrink-0 flex-wrap items-center gap-2 text-xs'>
                {state.status === 'running' && <Loader2 className='h-4 w-4 animate-spin' />}
                {state.status === 'passed' && <CheckCircle2 className='h-4 w-4 text-green-600' />}
                {state.status === 'failed' && <XCircle className='h-4 w-4 text-red-600' />}
                <span>{statusLabel(state)}</span>
                {result?.status !== undefined && <span className={httpError ? 'text-amber-600' : mutedClass}>HTTP {result.status}</span>}
                {result?.responseTime !== undefined && <span className={mutedClass}><Clock3 className='mr-1 inline h-3.5 w-3.5' />{result.responseTime} ms</span>}
              </div>
            </div>
            {tests.length > 0 && <div className={`mt-2 text-xs ${tests.some((test) => !test.passed) ? 'text-red-600' : mutedClass}`}>{passedTests}/{tests.length} tests passed</div>}
            {state.item?.outcome.scriptError && <div className='mt-2 text-xs text-red-600'>{state.item.outcome.scriptError}</div>}
            {state.item?.outcome.error && !state.item.cancelled && <div className='mt-2 text-xs text-red-600'>{state.item.outcome.error}</div>}
            {state.item?.historyEntryId && <button type='button' className='mt-2 text-xs font-medium text-blue-600 underline underline-offset-2' aria-label={`Open history for ${request.name}`} onClick={() => onOpenHistory(state.item?.historyEntryId, state.item?.outcome.result ? summary?.runId : undefined)}>Inspect history</button>}
          </div>;
        })}
        {queue.length === 0 && <div className={`rounded-lg border px-4 py-8 text-center text-sm ${mutedClass}`}>There are no saved requests in this run scope yet.</div>}
      </section>
    </div>
  </section>;
};
