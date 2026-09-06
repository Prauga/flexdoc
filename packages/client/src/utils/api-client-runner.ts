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
  resolveApiClientAuth,
} from './api-client-workspace';
import type { ApiClientSavedRequest, ApiClientWorkspaceState } from './api-client-workspace';

export interface ApiClientCollectionRunItem {
  requestId: string;
  requestName: string;
  collectionId: string;
  folderId?: string;
  passed: boolean;
  outcome: ApiClientExecutionOutcome;
}

export interface ApiClientCollectionRunResult {
  collectionId: string;
  folderId?: string;
  total: number;
  completed: number;
  passed: number;
  failed: number;
  stopped: boolean;
  items: ApiClientCollectionRunItem[];
  workspace: ApiClientWorkspaceState;
}

export interface RunApiClientCollectionOptions {
  workspace: ApiClientWorkspaceState;
  collectionId: string;
  folderId?: string;
  credentials?: RequestCredentials;
  requestInterceptor?: ExecuteApiClientRequestOptions['requestInterceptor'];
  externalVariables?: HttpVariables;
  externalEnvironmentVariables?: HttpVariables;
  stopOnFailure?: boolean;
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

function outcomePassed(outcome: ApiClientExecutionOutcome): boolean {
  return !outcome.error
    && !outcome.scriptError
    && outcome.scriptTests.every((test) => test.passed);
}

export async function runApiClientCollection(options: RunApiClientCollectionOptions): Promise<ApiClientCollectionRunResult> {
  const requests = apiClientCollectionRunRequests(options.workspace, options.collectionId, options.folderId);
  let workspace = options.workspace;
  const items: ApiClientCollectionRunItem[] = [];
  let stopped = false;

  for (let index = 0; index < requests.length; index += 1) {
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

    if (outcome.result) {
      workspace = addApiClientHistoryEntry(workspace, {
        ...outcome.result,
        collectionId: savedRequest.collectionId,
        folderId: savedRequest.folderId,
      });
    }

    const item: ApiClientCollectionRunItem = {
      requestId: savedRequest.id,
      requestName: savedRequest.name,
      collectionId: savedRequest.collectionId,
      folderId: savedRequest.folderId,
      passed: outcomePassed(outcome),
      outcome,
    };
    items.push(item);
    options.onRequestComplete?.(item, index, requests.length);
    if (!item.passed && options.stopOnFailure) {
      stopped = index < requests.length - 1;
      break;
    }
  }

  const passed = items.filter((item) => item.passed).length;
  return {
    collectionId: options.collectionId,
    folderId: options.folderId,
    total: requests.length,
    completed: items.length,
    passed,
    failed: items.length - passed,
    stopped,
    items,
    workspace,
  };
}
