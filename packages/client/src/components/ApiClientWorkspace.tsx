import React, { useEffect, useMemo, useState } from 'react';
import { ApiClient } from './ApiClient';
import type { ApiClientExecutionResult, ApiClientProps } from './ApiClient';
import { ApiClientCollections } from './ApiClientCollections';
import { ApiClientEnvironments } from './ApiClientEnvironments';
import { ApiClientHistory } from './ApiClientHistory';
import type { HttpRequestDraft } from '../utils/http-client';
import type { ApiClientRequestScripts, ApiClientScriptEnvironmentChange } from '../utils/api-client-scripting';
import type { BuiltRequest } from '../utils/request-builder';
import {
  activeApiClientEnvironmentVariables,
  addApiClientHistoryEntry,
  apiClientCollectionVariables,
  cloneRequestDraft,
  createApiClientId,
  createDefaultApiClientWorkspace,
  loadApiClientWorkspace,
  saveApiClientWorkspace,
} from '../utils/api-client-workspace';
import { cloneApiClientScripts } from '../utils/api-client-scripting';
import type { ApiClientWorkspaceState } from '../utils/api-client-workspace';

export interface ApiClientWorkspaceProps extends ApiClientProps {
  persistenceKey?: string | false;
}

function withWorkspaceDefaults(initialRequest?: Partial<HttpRequestDraft>): HttpRequestDraft {
  return {
    method: initialRequest?.method || 'GET',
    url: initialRequest?.url || '',
    query: initialRequest?.query?.map((entry) => ({ ...entry })) || [],
    headers: initialRequest?.headers?.map((entry) => ({ ...entry })) || [],
    body: initialRequest?.body || '',
    contentType: initialRequest?.contentType || 'application/json',
    auth: initialRequest?.auth ? { ...initialRequest.auth } : { type: 'none' },
  };
}

function applyEnvironmentChanges(workspace: ApiClientWorkspaceState, changes: ApiClientScriptEnvironmentChange[]): ApiClientWorkspaceState {
  if (!workspace.activeEnvironmentId || changes.length === 0) return workspace;
  const environmentIndex = workspace.environments.findIndex((environment) => environment.id === workspace.activeEnvironmentId);
  if (environmentIndex < 0) return workspace;

  const environment = workspace.environments[environmentIndex];
  let variables = environment.variables.map((variable) => ({ ...variable }));
  let changed = false;

  for (const change of changes) {
    const key = change.key.trim();
    if (!key) continue;
    if (change.action === 'unset') {
      const next = variables.filter((variable) => variable.key.trim() !== key);
      if (next.length !== variables.length) {
        variables = next;
        changed = true;
      }
      continue;
    }

    const indexes = variables
      .map((variable, index) => variable.key.trim() === key ? index : -1)
      .filter((index) => index >= 0);
    const value = change.value || '';
    if (indexes.length > 0) {
      const first = indexes[0];
      variables[first] = { ...variables[first], key, value, enabled: true };
      if (indexes.length > 1) variables = variables.filter((variable, index) => index === first || variable.key.trim() !== key);
    } else {
      variables.push({ id: createApiClientId('variable'), key, value, enabled: true });
    }
    changed = true;
  }

  if (!changed) return workspace;
  const environments = workspace.environments.map((candidate, index) => index === environmentIndex
    ? { ...candidate, variables, updatedAt: new Date().toISOString() }
    : candidate);
  return { ...workspace, environments };
}

export const ApiClientWorkspace: React.FC<ApiClientWorkspaceProps> = ({
  initialRequest,
  initialScripts,
  theme = 'light',
  persistenceKey = 'default',
  onRequestChange,
  onDraftChange,
  onScriptsChange,
  onExecutionComplete,
  variables: externalVariables = {},
  environmentVariables: externalEnvironmentVariables = {},
  onEnvironmentChanges,
  ...apiClientProps
}) => {
  const initialDraft = withWorkspaceDefaults(initialRequest);
  const initialScriptState = cloneApiClientScripts(initialScripts);
  const initialWorkspace = createDefaultApiClientWorkspace();
  const [editorRequest, setEditorRequest] = useState<HttpRequestDraft>(initialDraft);
  const [currentRequest, setCurrentRequest] = useState<HttpRequestDraft>(initialDraft);
  const [editorScripts, setEditorScripts] = useState<ApiClientRequestScripts>(initialScriptState);
  const [currentScripts, setCurrentScripts] = useState<ApiClientRequestScripts>(initialScriptState);
  const [editorRevision, setEditorRevision] = useState(0);
  const [workspace, setWorkspace] = useState<ApiClientWorkspaceState>(initialWorkspace);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | undefined>(initialWorkspace.collections[0]?.id);
  const [hydrated, setHydrated] = useState(persistenceKey === false);

  useEffect(() => {
    if (persistenceKey === false) return;
    let cancelled = false;
    loadApiClientWorkspace(persistenceKey)
      .then((next) => {
        if (cancelled) return;
        setWorkspace(next);
        setHydrated(true);
      })
      .catch(() => {
        if (!cancelled) setHydrated(true);
      });
    return () => { cancelled = true; };
  }, [persistenceKey]);

  useEffect(() => {
    if (!hydrated || persistenceKey === false) return;
    void saveApiClientWorkspace(persistenceKey, workspace).catch(() => undefined);
  }, [hydrated, persistenceKey, workspace]);

  const collectionVariables = useMemo(
    () => apiClientCollectionVariables(workspace, selectedCollectionId),
    [selectedCollectionId, workspace],
  );
  const workspaceEnvironmentVariables = useMemo(() => activeApiClientEnvironmentVariables(workspace), [workspace]);
  const environmentVariables = useMemo(
    () => ({ ...externalEnvironmentVariables, ...workspaceEnvironmentVariables }),
    [externalEnvironmentVariables, workspaceEnvironmentVariables],
  );
  const variables = useMemo(
    () => ({ ...collectionVariables, ...externalVariables, ...environmentVariables }),
    [collectionVariables, environmentVariables, externalVariables],
  );

  const handleRequestChange = (request: BuiltRequest) => {
    onRequestChange?.(request);
  };

  const handleDraftChange = (request: HttpRequestDraft) => {
    setCurrentRequest(cloneRequestDraft(request));
    onDraftChange?.(cloneRequestDraft(request));
  };

  const handleScriptsChange = (scripts: ApiClientRequestScripts) => {
    const next = cloneApiClientScripts(scripts);
    setCurrentScripts(next);
    onScriptsChange?.(next);
  };

  const handleEnvironmentChanges = (changes: ApiClientScriptEnvironmentChange[]) => {
    setWorkspace((current) => applyEnvironmentChanges(current, changes));
    onEnvironmentChanges?.(changes);
  };

  const handleExecutionComplete = (result: ApiClientExecutionResult) => {
    setWorkspace((current) => addApiClientHistoryEntry(current, result));
    onExecutionComplete?.(result);
  };

  const loadSavedRequest = (request: HttpRequestDraft, scripts?: ApiClientRequestScripts) => {
    const nextRequest = cloneRequestDraft(request);
    const nextScripts = cloneApiClientScripts(scripts);
    setEditorRequest(nextRequest);
    setCurrentRequest(nextRequest);
    setEditorScripts(nextScripts);
    setCurrentScripts(nextScripts);
    setEditorRevision((revision) => revision + 1);
  };

  const panelClass = theme === 'dark' ? 'border-gray-700 bg-gray-900/40 text-gray-100' : 'border-gray-200 bg-white text-gray-900';

  return <div className='grid gap-4 lg:grid-cols-[19rem_minmax(0,1fr)]'>
    <aside className={`space-y-5 rounded-xl border p-4 ${panelClass}`}>
      <ApiClientEnvironments workspace={workspace} onWorkspaceChange={setWorkspace} theme={theme} />
      <div className='border-t pt-4'>
        <ApiClientCollections
          request={currentRequest}
          scripts={currentScripts}
          onLoadRequest={loadSavedRequest}
          onSelectedCollectionChange={setSelectedCollectionId}
          workspace={workspace}
          onWorkspaceChange={setWorkspace}
          theme={theme}
        />
      </div>
      <div className='border-t pt-4'>
        <ApiClientHistory
          workspace={workspace}
          onWorkspaceChange={setWorkspace}
          onLoadRequest={loadSavedRequest}
          theme={theme}
        />
      </div>
    </aside>
    <ApiClient
      key={editorRevision}
      {...apiClientProps}
      initialRequest={editorRequest}
      initialScripts={editorScripts}
      theme={theme}
      variables={variables}
      environmentVariables={environmentVariables}
      onEnvironmentChanges={handleEnvironmentChanges}
      onDraftChange={handleDraftChange}
      onScriptsChange={handleScriptsChange}
      onExecutionComplete={handleExecutionComplete}
      onRequestChange={handleRequestChange}
    />
  </div>;
};
