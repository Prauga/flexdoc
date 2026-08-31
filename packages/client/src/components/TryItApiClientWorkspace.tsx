import React, { useRef, useState } from 'react';
import type { OpenAPISpec, Operation } from '../types/openapi';
import type { FlexDocRendererOptions } from '../types/options';
import type { BuiltRequest } from '../utils/request-builder';
import { requestDraftFromBuiltRequest } from '../utils/http-client';
import { ApiClient } from './ApiClient';
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
}

/**
 * Composes OpenAPI Try It with the standalone API Client while keeping the
 * handoff state next to the editor that owns the live request values.
 */
export const TryItApiClientWorkspace: React.FC<Props> = ({ spec, path, method, theme, options, onRequestChange }) => {
  const [session, setSession] = useState<ApiClientSession | null>(null);
  const nextSessionId = useRef(0);
  // BuiltRequest only retains final transport headers/query values, not the
  // OpenAPI auth scheme that produced them. Handoff therefore keeps those
  // credentials as editable request entries and leaves API Client auth at None.
  const draft = session ? requestDraftFromBuiltRequest(session.request) : null;
  const pathItem = spec.paths[path];
  const operation = pathItem?.[method.toLowerCase() as keyof typeof pathItem] as Operation | undefined;
  const servers = operation?.servers || pathItem?.servers || spec.servers || [];

  const openInApiClient = (request: BuiltRequest, serverUrl?: string) => {
    nextSessionId.current += 1;
    setSession({ id: nextSessionId.current, request, serverUrl });
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
        Changes in Try It do not refresh this client automatically. Reopen it to load the latest Try It values.
      </p>
      <ApiClient
        key={session.id}
        initialRequest={draft}
        theme={theme}
        credentials={options?.tryIt?.credentials || 'same-origin'}
        requestInterceptor={options?.tryIt?.requestInterceptor}
        onRequestChange={onRequestChange}
        serverOptions={servers}
        initialServerUrl={session.serverUrl}
      />
    </section>}
  </>;
};