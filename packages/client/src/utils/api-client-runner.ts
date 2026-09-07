
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

/** Result for one saved request executed by a collection/folder run. */
export interface ApiClientCollectionRunItem {
  /** Id of the saved workspace request that was executed. */ requestId: string;
  /** Display name of the saved request at run time. */ requestName: string;
  /** Collection containing the request. */ collectionId: string;
  /** Folder containing the request, when applicable. */ folderId?: string;
  /** Whether transport/scripts/tests completed without failure. */ passed: boolean;
  /** Whether the item was cancelled by the run abort signal. */ cancelled: boolean;
  /** History entry created for the request when an execution result was recorded. */ historyEntryId?: string;
  /** Complete programmatic execution outcome for the request. */ outcome: ApiClientExecutionOutcome;
}

/** Result of executing every request in a collection or folder scope. */
export interface ApiClientCollectionRunResult {
  /** Stable identifier for this run. */ runId: string;
  /** Display name for this run. */ runName: string;
  /** Collection that was executed. */ collectionId: string;
  /** Optional folder scope limiting the run. */ folderId?: string;
  /** Number of saved requests selected for the run. */ total: number;
  /** Number of items that produced a run item before execution stopped. */ completed: number;
  /** Number of successful run items. */ passed: number;
  /** Number of failed, non-cancelled run items. */ failed: number;
  /** Number of cancelled run items. */ cancelled: number;
  /** Whether the run stopped before naturally exhausting all selected requests. */ stopped: boolean;
  /** Per-request run results in execution order. */ items: ApiClientCollectionRunItem[];
  /** Workspace state after history/script-variable mutations from the run. */ workspace: ApiClientWorkspaceState;
}

/** Options controlling collection/folder execution. */
export interface RunApiClientCollectionOptions {
  /** Workspace containing the collection, folders, saved requests, environment, and history. */ workspace: ApiClientWorkspaceState;
  /** Collection to execute. */ collectionId: string;
  /** Optional folder subtree to execute instead of the full collection. */ folderId?: string;
  /** Explicit run id; generated automatically when omitted. */ runId?: string;
  /** Explicit display name; derived from collection/folder names when omitted. */ runName?: string;
  /** Browser Fetch credentials mode used by direct executions. */ credentials?: RequestCredentials;
  /** Hook that may rewrite direct-browser request URL/init before transport. */ requestInterceptor?: ExecuteApiClientRequestOptions['requestInterceptor'];
  /** API-host execution endpoint/capabilities. */ hostExecution?: ExecuteApiClientRequestOptions['hostExecution'];
  /** External variables merged into request/script resolution. */ externalVariables?: HttpVariables;
  /** External environment variables merged before active workspace environment values. */ externalEnvironmentVariables?: HttpVariables;
  /** Stop after the first failed item instead of continuing through the scope. */ stopOnFailure?: boolean;
  /** Abort signal used to stop the run and cancel the active transport. */ signal?: AbortSignal;
  /** Fetch implementation forwarded to each request execution. */ fetcher?: typeof globalThis.fetch;
  /** Clock forwarded to each request execution for response timing. */ now?: () => number;
  /** Called immediately before each saved request begins. */ onRequestStart?: (request: ApiClientSavedRequest, index: number, total: number) => void;
  /** Called after each saved request produces a run item. */ onRequestComplete?: (item: ApiClientCollectionRunItem, index: number, total: number) => void;
  /** Called with collection-variable changes emitted by request scripts. */ onCollectionChanges?: (changes: ApiClientScriptCollectionChange[]) => void;
  /** Called with environment-variable changes emitted by request scripts. */ onEnvironmentChanges?: (changes: ApiClientScriptEnvironmentChange[]) => void;
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

/**
 * Return saved requests included in a collection or folder run.
 * @param workspace Workspace containing saved requests/folder hierarchy.
 * @param collectionId Collection to inspect.
 * @param folderId Optional folder root; descendants are included recursively.
 * @returns Saved requests in workspace order matching the requested scope.
 */
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

/**
 * Return the default display name for a collection or folder run.
 * @param workspace Workspace containing collection/folder names.
 * @param collectionId Collection being run.
 * @param folderId Optional folder scope.
 * @returns Human-readable collection or collection/folder path.
 */
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

/**
 * Execute saved requests in a collection or folder, recording history for each item.
 * @param options Workspace scope, execution settings, transport overrides, and progress callbacks.
 * @returns Aggregate run result plus the workspace state after run-side mutations.
 */
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
