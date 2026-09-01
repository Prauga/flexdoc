import React, { useEffect, useMemo, useState } from 'react';
import { ApiClient } from './ApiClient';
import type { ApiClientProps } from './ApiClient';
import { ApiClientCollections } from './ApiClientCollections';
import { ApiClientEnvironments } from './ApiClientEnvironments';
import type { HttpRequestDraft } from '../utils/http-client';
import type { BuiltRequest } from '../utils/request-builder';
import {
  activeApiClientEnvironmentVariables,
  cloneRequestDraft,
  createDefaultApiClientWorkspace,
  loadApiClientWorkspace,
  saveApiClientWorkspace,
} from '../utils/api-client-workspace';
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

export const ApiClientWorkspace: React.FC<ApiClientWorkspaceProps> = ({
  initialRequest,
  theme = 'light',
  persistenceKey = 'default',
  onRequestChange,
  onDraftChange,
  variables: externalVariables = {},
  ...apiClientProps
}) => {
  const initialDraft = withWorkspaceDefaults(initialRequest);
  const initialWorkspace = createDefaultApiClientWorkspace();
  const [editorRequest, setEditorRequest] = useState<HttpRequestDraft>(initialDraft);
  const [currentRequest, setCurrentRequest] = useState<HttpRequestDraft>(initialDraft);
  const [editorRevision, setEditorRevision] = useState(0);
  const [workspace, setWorkspace] = useState<ApiClientWorkspaceState>(initialWorkspace);
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

  const environmentVariables = useMemo(() => activeApiClientEnvironmentVariables(workspace), [workspace]);
  const variables = useMemo(() => ({ ...externalVariables, ...environmentVariables }), [environmentVariables, externalVariables]);

  const handleRequestChange = (request: BuiltRequest) => {
    onRequestChange?.(request);
  };

  const handleDraftChange = (request: HttpRequestDraft) => {
    setCurrentRequest(cloneRequestDraft(request));
    onDraftChange?.(cloneRequestDraft(request));
  };

  const loadSavedRequest = (request: HttpRequestDraft) => {
    const next = cloneRequestDraft(request);
    setEditorRequest(next);
    setCurrentRequest(next);
    setEditorRevision((revision) => revision + 1);
  };

  const panelClass = theme === 'dark' ? 'border-gray-700 bg-gray-900/40 text-gray-100' : 'border-gray-200 bg-white text-gray-900';

  return <div className='grid gap-4 lg:grid-cols-[19rem_minmax(0,1fr)]'>
    <aside className={`space-y-5 rounded-xl border p-4 ${panelClass}`}>
      <ApiClientEnvironments workspace={workspace} onWorkspaceChange={setWorkspace} theme={theme} />
      <div className='border-t pt-4'>
        <ApiClientCollections
          request={currentRequest}
          onLoadRequest={loadSavedRequest}
          workspace={workspace}
          onWorkspaceChange={setWorkspace}
          theme={theme}
        />
      </div>
    </aside>
    <ApiClient
      key={editorRevision}
      {...apiClientProps}
      initialRequest={editorRequest}
      theme={theme}
      variables={variables}
      onDraftChange={handleDraftChange}
      onRequestChange={handleRequestChange}
    />
  </div>;
};
