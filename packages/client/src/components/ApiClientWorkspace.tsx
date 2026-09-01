import React, { useState } from 'react';
import { ApiClient } from './ApiClient';
import type { ApiClientProps } from './ApiClient';
import { ApiClientCollections } from './ApiClientCollections';
import { requestDraftFromBuiltRequest } from '../utils/http-client';
import type { HttpRequestDraft } from '../utils/http-client';
import type { BuiltRequest } from '../utils/request-builder';

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
  ...apiClientProps
}) => {
  const initialDraft = withWorkspaceDefaults(initialRequest);
  const [editorRequest, setEditorRequest] = useState<HttpRequestDraft>(initialDraft);
  const [currentRequest, setCurrentRequest] = useState<HttpRequestDraft>(initialDraft);
  const [editorRevision, setEditorRevision] = useState(0);

  const handleRequestChange = (request: BuiltRequest) => {
    setCurrentRequest(requestDraftFromBuiltRequest(request));
    onRequestChange?.(request);
  };

  const loadSavedRequest = (request: HttpRequestDraft) => {
    setEditorRequest(request);
    setCurrentRequest(request);
    setEditorRevision((revision) => revision + 1);
  };

  const panelClass = theme === 'dark' ? 'border-gray-700 bg-gray-900/40 text-gray-100' : 'border-gray-200 bg-white text-gray-900';

  return <div className='grid gap-4 lg:grid-cols-[17rem_minmax(0,1fr)]'>
    <div className={`rounded-xl border p-4 ${panelClass}`}>
      <ApiClientCollections
        request={currentRequest}
        onLoadRequest={loadSavedRequest}
        theme={theme}
        persistenceKey={persistenceKey}
      />
    </div>
    <ApiClient
      key={editorRevision}
      {...apiClientProps}
      initialRequest={editorRequest}
      theme={theme}
      onRequestChange={handleRequestChange}
    />
  </div>;
};
