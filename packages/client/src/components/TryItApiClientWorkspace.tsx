import React, { useRef, useState } from 'react';
import type { OpenAPISpec, Operation } from '../types/openapi';
import type { FlexDocRendererOptions } from '../types/options';
import type { BuiltRequest, RequestValues } from '../utils/request-builder';
import { requestDraftFromOpenApiRequest } from '../utils/openapi-api-client-auth';
import { createDefaultApiClientPersistenceKey } from '../utils/api-client-workspace';
import { ApiClientWorkspace } from './ApiClientWorkspace';
import { RequestPlayground } from './RequestPlayground';

interface Props {
  spec: OpenAPISpec;
  path: string;
  method: string;
  theme: 'light' | 'dark';
  options?: FlexDocRendererOptions;
  onRequestChange?: (request: BuiltRequest) => void;
}

interface ApiClientSession {
  id: number;
  request: BuiltRequest;
  serverUrl?: string;
  values: RequestValues;
}

/**
 * Composes OpenAPI Try It with the standalone API Client while keeping the
 * handoff state next to the editor that owns the live request values.
 */
export const TryItApiClientWorkspace: React.FC<Props> = ({ spec, path, method, theme, options, onRequestChange }) => {
  const [session, setSession] = useState<ApiClientSession | null>(null);
  const nextSessionId = useRef(0);
  // Translate supported OpenAPI credentials into canonical API Client auth.
  // Unsupported or compound requirements stay as raw transport data.
  const draft = session ? requestDraftFromOpenApiRequest(spec, path, method, session.values, session.request) : null;
  const pathItem = spec.paths[path];
  const operation = pathItem?.[method.toLowerCase() as keyof typeof pathItem] as Operation | undefined;
  const servers = operation?.servers || pathItem?.servers || spec.servers || [];
  const persistenceKey = options?.tryIt?.apiClientPersistenceKey
    ?? createDefaultApiClientPersistenceKey(spec.info?.title, typeof window === 'undefined' ? undefined : window.location.host);

  const openInApiClient = (request: BuiltRequest, serverUrl?: string, values: RequestValues = {}) => {
    nextSessionId.current += 1;
    setSession({ id: nextSessionId.current, request, serverUrl, values });
  };

  return <>
    <RequestPlayground
      spec={spec}
      path={path}
      method={method}
      theme={theme}
      options={options}
      onRequestChange={onRequestChange}
      onOpenInApiClient={openInApiClient}
    />

    {session && draft && <section className='mt-6' aria-labelledby='api-client-heading'>
      <h2 id='api-client-heading' className='mb-2 text-base font-semibold sm:text-lg'>API Client</h2>
      <p className={`mb-4 text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
        Changes in Try It do not refresh this client automatically. Reopen it to load the latest Try It values. Saved collections stay local to this browser.
      </p>
      <ApiClientWorkspace
        key={session.id}
        initialRequest={draft}
        theme={theme}
        credentials={options?.tryIt?.credentials || 'same-origin'}
        requestInterceptor={options?.tryIt?.requestInterceptor}
        onRequestChange={onRequestChange}
        serverOptions={servers}
        initialServerUrl={session.serverUrl}
        persistenceKey={persistenceKey}
      />
    </section>}
  </>;
};
