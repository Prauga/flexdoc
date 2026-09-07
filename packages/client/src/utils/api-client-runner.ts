
import { executeApiClientRequest } from './api-client-execution';
import type { ApiClientExecutionOutcome, ExecuteApiClientRequestOptions } from './api-client-execution';
import type { HttpVariables } from './http-client';
import type { ApiClientScriptCollectionChange, ApiClientScriptEnvironmentChange } from './api-client-scripting';
import {
  activeApiClientEnvironmentVariables,
  addApiClientHistoryEntry,
  apiClientCollectionVariables,
  applyApiClientCollectionChanges,
  applyApiClientEnvironmentChanges,
  createApiClientId,
  resolveApiClientAuth,
} from './api-client-workspace';
import type { ApiClientFolder, ApiClientSavedRequest, ApiClientWorkspaceState } from './api-client-workspace';

export interface ApiClientCollectionRunItem {
  requestId: string;
  requestName: string;
  collectionId: string;
  folderId?: string;
  passed: boolean;
  cancelled: boolean;
  historyEntryId?: string;
  outcome: ApiClientExecutionOutcome;
}

/** Result of executing every request in a collection or folder scope. */
export interface ApiClientCollectionRunResult {
  runId: string;
  runName: string;
  collectionId: string;
  folderId?: string;
  total: number;
  completed: number;
  passed: number;
  failed: number;
  cancelled: number;
  stopped: boolean;
  items: ApiClientCollectionRunItem[];
  workspace: ApiClientWorkspaceState;
}

export interface RunApiClientCollectionOptions {
  workspace: ApiClientWorkspaceState;
  collectionId: string;
  folderId?: string;
  runId?: string;
  runName?: string;
  credentials?: RequestCredentials;
  requestInterceptor?: ExecuteApiClientRequestOptions['requestInterceptor'];
  hostExecution?: ExecuteApiClientRequestOptions['hostExecution'];
  externalVariables?: HttpVariables;
  externalEnvironmentVariables?: HttpVariables;
  stopOnFailure?: boolean;
  signal?: AbortSignal;
  fetcher?: typeof globalThis.fetch;
  now?: () => number;
  onRequestStart?: (request: ApiClientSavedRequest, index: number, total: number) => void;
  onRequestComplete?: (item: ApiClientCollectionRunItem, index: number, total: number) => void;
  onCollectionChanges?: (changes: ApiClientScriptCollectionChange[]) => void;
  onEnvironmentChanges?: (changes: ApiClientScriptEnvironmentChange[]) => void;
}

function folderScope(workspace: ApiClientWorkspaceState, collectionId: string, folderId?: string): Set<string> | null {
  if (!folderId) return null;
  const root = workspace.folders.find((folder) => folder.id === folderId && folder.collectionId === collectionId);
  if (!root) return new Set();
  const scoped = new Set([root.id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const folder of workspace.folders) {
      if (folder.collectionId !== collectionId || !folder.parentFolderId || scoped.has(folder.id)) continue;
      if (scoped.has(folder.parentFolderId)) {
        scoped.add(folder.id);
        changed = true;
      }
    }
  }
  return scoped;
}

/** Saved requests included in a collection or folder run. */
export function apiClientCollectionRunRequests(
  workspace: ApiClientWorkspaceState,
  collectionId: string,
  folderId?: string,
): ApiClientSavedRequest[] {
  const scope = folderScope(workspace, collectionId, folderId);
  return workspace.requests.filter((request) => {
    if (request.collectionId !== collectionId) return false;
    if (!scope) return true;
    return !!request.folderId && scope.has(request.folderId);
  });
}

function folderPath(folders: ApiClientFolder[], folderId: string): string {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const names: string[] = [];
  const seen = new Set<string>();
  let current = byId.get(folderId);
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    names.unshift(current.name);
    current = current.parentFolderId ? byId.get(current.parentFolderId) : undefined;
  }
  return names.join(' / ');
}

/** Default display name for a collection or folder run. */
export function apiClientCollectionRunName(
  workspace: ApiClientWorkspaceState,
  collectionId: string,
  folderId?: string,
): string {
  const collectionName = workspace.collections.find((collection) => collection.id === collectionId)?.name || 'Deleted collection';
  if (!folderId) return collectionName;
  const path = folderPath(workspace.folders.filter((folder) => folder.collectionId === collectionId), folderId);
  return path ? `${collectionName} / ${path}` : `${collectionName} / Deleted folder`;
}

function outcomePassed(outcome: ApiClientExecutionOutcome): boolean {
  return !outcome.error
    && !outcome.scriptError
    && outcome.scriptTests.every((test) => test.passed);
}

/** Execute saved requests in a collection or folder, recording history for each item. */
export async function runApiClientCollection(options: RunApiClientCollectionOptions): Promise<ApiClientCollectionRunResult> {
  const requests = apiClientCollectionRunRequests(options.workspace, options.collectionId, options.folderId);
  const runId = options.runId || createApiClientId('run');
  const runName = options.runName || apiClientCollectionRunName(options.workspace, options.collectionId, options.folderId);
  let workspace = options.workspace;
  const items: ApiClientCollectionRunItem[] = [];
  let stopped = options.signal?.aborted === true;

  for (let index = 0; index < requests.length && !stopped; index += 1) {
    if (options.signal?.aborted) {
      stopped = true;
      break;
    }
    const savedRequest = requests[index];
    options.onRequestStart?.(savedRequest, index, requests.length);
    const collectionVariables = apiClientCollectionVariables(workspace, options.collectionId);
    const workspaceEnvironmentVariables = activeApiClientEnvironmentVariables(workspace);
    const environmentVariables = {
      ...(options.externalEnvironmentVariables || {}),
      ...workspaceEnvironmentVariables,
    };
    const variables = {
      ...collectionVariables,
      ...(options.externalVariables || {}),
      ...environmentVariables,
    };

    const outcome = await executeApiClientRequest({
      request: savedRequest.request,
      scripts: savedRequest.scripts,
      credentials: options.credentials,
      requestInterceptor: options.requestInterceptor,
      hostExecution: options.hostExecution,
      resolveAuth: (auth) => resolveApiClientAuth(
        workspace,
        savedRequest.collectionId,
        savedRequest.folderId,
        auth || { type: 'none' },
      ),
      variables,
      collectionVariables,
      externalVariables: options.externalVariables,
      environmentVariables,
      signal: options.signal,
      fetcher: options.fetcher,
      now: options.now,
      onCollectionChanges: (changes) => {
        workspace = applyApiClientCollectionChanges(workspace, savedRequest.collectionId, changes);
        options.onCollectionChanges?.(changes);
      },
      onEnvironmentChanges: (changes) => {
        workspace = applyApiClientEnvironmentChanges(workspace, changes);
        options.onEnvironmentChanges?.(changes);
      },
    });

    const cancelled = options.signal?.aborted === true;
    const passed = !cancelled && outcomePassed(outcome);
    let historyEntryId: string | undefined;
    if (outcome.result && !cancelled) {
      workspace = addApiClientHistoryEntry(workspace, {
        ...outcome.result,
        collectionId: savedRequest.collectionId,
        folderId: savedRequest.folderId,
        runId,
        runName,
        runIndex: index + 1,
        runTotal: requests.length,
        runPassed: passed,
      });
      historyEntryId = workspace.history[0]?.id;
    }

    const item: ApiClientCollectionRunItem = {
      requestId: savedRequest.id,
      requestName: savedRequest.name,
      collectionId: savedRequest.collectionId,
      folderId: savedRequest.folderId,
      passed,
      cancelled,
      historyEntryId,
      outcome,
    };
    items.push(item);
    options.onRequestComplete?.(item, index, requests.length);

    if (cancelled) {
      stopped = true;
      break;
    }
    if (!item.passed && options.stopOnFailure && index < requests.length - 1) {
      stopped = true;
      break;
    }
  }

  const passed = items.filter((item) => item.passed).length;
  const cancelled = items.filter((item) => item.cancelled).length;
  const failed = items.filter((item) => !item.passed && !item.cancelled).length;
  return {
    runId,
    runName,
    collectionId: options.collectionId,
    folderId: options.folderId,
    total: requests.length,
    completed: items.length,
    passed,
    failed,
    cancelled,
    stopped,
    items,
    workspace,
  };
}
