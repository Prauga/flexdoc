import React, { useEffect, useMemo, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import type { OpenAPISpec, Operation } from '../types/openapi';
import type { FlexDocRendererOptions } from '../types/options';
import type { BuiltRequest } from '../utils/request-builder';
import { initialRequestValues } from '../utils/request-builder';
import type { HttpRequestDraft } from '../utils/http-client';
import type { ApiClientRequestScripts } from '../utils/api-client-scripting';
import { cloneApiClientScripts } from '../utils/api-client-scripting';
import type { OpenApiApiClientSession } from '../utils/openapi-api-client-session';
import { createOpenApiApiClientSession } from '../utils/openapi-api-client-session';
import {
  activeApiClientEnvironmentVariables,
  applyApiClientEnvironmentChanges,
  createDefaultApiClientWorkspace,
  loadApiClientWorkspace,
  saveApiClientWorkspace,
} from '../utils/api-client-workspace';
import { createDefaultApiClientPersistenceKey } from '../utils/api-client-workspace';
import type { ApiClientWorkspaceState } from '../utils/api-client-workspace';
import type { ApiClientRequestTab, ApiClientScriptTab } from './ApiClient';
import { ApiClient } from './ApiClient';

export interface TryItApiClientHandoff extends OpenApiApiClientSession {
  scripts: ApiClientRequestScripts;
  requestTab: ApiClientRequestTab;
  scriptTab: ApiClientScriptTab;
}

interface Props {
  spec: OpenAPISpec;
  path: string;
  method: string;
  theme: 'light' | 'dark';
  options?: FlexDocRendererOptions;
  initialRequestTab?: ApiClientRequestTab;
  initialScriptTab?: ApiClientScriptTab;
  onRequestChange?: (request: BuiltRequest) => void;
  onOpenInApiClient?: (session: TryItApiClientHandoff) => void;
}

type Density = 'basic' | 'advanced';

function replaceViewerState(name: string, value?: string): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (value) url.searchParams.set(name, value);
  else url.searchParams.delete(name);
  window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
}

function initialDensity(requestTab?: ApiClientRequestTab, scriptTab?: ApiClientScriptTab): Density {
  if (requestTab === 'scripts' || scriptTab) return 'advanced';
  if (typeof window === 'undefined') return 'basic';
  return new URLSearchParams(window.location.search).get('density') === 'advanced' ? 'advanced' : 'basic';
}

function fingerprint(request: HttpRequestDraft, scripts: ApiClientRequestScripts): string {
  return JSON.stringify({ request, scripts }, (_key, value) => {
    if (typeof File !== 'undefined' && value instanceof File) return { name: value.name, size: value.size, type: value.type, lastModified: value.lastModified };
    return value;
  });
}

export const TryItApiClientWorkspace: React.FC<Props> = ({
  spec,
  path,
  method,
  theme,
  options,
  initialRequestTab,
  initialScriptTab,
  onRequestChange,
  onOpenInApiClient,
}) => {
  const pathItem = spec.paths[path];
  const operation = pathItem?.[method.toLowerCase() as keyof typeof pathItem] as Operation | undefined;
  const servers = operation?.servers || pathItem?.servers || spec.servers || [];
  const persistenceKey = options?.tryIt?.apiClientPersistenceKey
    ?? createDefaultApiClientPersistenceKey(spec.info?.title, typeof window === 'undefined' ? undefined : window.location.host);
  const initialSession = useMemo(() => {
    const values = { ...initialRequestValues(spec, path, method), serverUrl: options?.tryIt?.defaultServer };
    return createOpenApiApiClientSession(spec, path, method, values, options?.tryIt?.defaultServer);
  }, [method, options?.tryIt?.defaultServer, path, spec]);
  const initialScripts = useMemo(() => cloneApiClientScripts(), []);
  const [density, setDensity] = useState<Density>(() => initialDensity(initialRequestTab, initialScriptTab));
  const [draft, setDraft] = useState<HttpRequestDraft>(initialSession.request);
  const [serverUrl, setServerUrl] = useState(initialSession.serverUrl);
  const [scripts, setScripts] = useState<ApiClientRequestScripts>(initialScripts);
  const [requestTab, setRequestTab] = useState<ApiClientRequestTab>(initialRequestTab || 'params');
  const [scriptTab, setScriptTab] = useState<ApiClientScriptTab>(initialScriptTab || 'pre-request');
  const [environmentWorkspace, setEnvironmentWorkspace] = useState<ApiClientWorkspaceState>(() => createDefaultApiClientWorkspace());
  const [environmentHydrated, setEnvironmentHydrated] = useState(persistenceKey === false);
  const messages = options?.messages;

  useEffect(() => {
    if (persistenceKey === false) return;
    let cancelled = false;
    loadApiClientWorkspace(persistenceKey).then((workspace) => {
      if (cancelled) return;
      setEnvironmentWorkspace(workspace);
      setEnvironmentHydrated(true);
    }).catch(() => { if (!cancelled) setEnvironmentHydrated(true); });
    return () => { cancelled = true; };
  }, [persistenceKey]);

  useEffect(() => {
    if (!environmentHydrated || persistenceKey === false) return;
    void saveApiClientWorkspace(persistenceKey, environmentWorkspace).catch(() => undefined);
  }, [environmentHydrated, environmentWorkspace, persistenceKey]);

  const environmentVariables = useMemo(() => activeApiClientEnvironmentVariables(environmentWorkspace), [environmentWorkspace]);
  const dirty = fingerprint(draft, scripts) !== fingerprint(initialSession.request, initialScripts);
  const advanced = density === 'advanced';
  const panel = theme === 'dark' ? 'border-gray-700 bg-gray-900/40 text-gray-100' : 'border-gray-200 bg-white text-gray-900';
  const input = theme === 'dark' ? 'border-gray-700 bg-gray-900 text-gray-100' : 'border-gray-300 bg-white text-gray-900';

  const setDensityAndUrl = (next: Density) => {
    setDensity(next);
    replaceViewerState('density', next === 'advanced' ? 'advanced' : undefined);
  };

  const openFullClient = () => onOpenInApiClient?.({
    request: draft,
    scripts: cloneApiClientScripts(scripts),
    serverUrl,
    requestTab,
    scriptTab,
  });

  return <div className='space-y-3' data-try-it-session>
    <div className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border p-2 ${panel}`}>
      <div className='flex rounded-md border p-1' role='group' aria-label='Try It density'>
        <button type='button' aria-pressed={!advanced} className={`rounded px-3 py-1.5 text-sm ${!advanced ? 'bg-blue-600 text-white' : ''}`} onClick={() => setDensityAndUrl('basic')}>{messages?.tryItBasic || 'Basic'}</button>
        <button type='button' aria-pressed={advanced} className={`rounded px-3 py-1.5 text-sm ${advanced ? 'bg-blue-600 text-white' : ''}`} onClick={() => setDensityAndUrl('advanced')}>{messages?.tryItAdvanced || 'Advanced'}</button>
      </div>
      <div className='flex flex-wrap items-center gap-2'>
        {advanced && dirty && <span aria-label='Unsaved Try It changes' className='text-xs font-medium'>{messages?.unsavedChanges || 'Unsaved changes'}</span>}
        {onOpenInApiClient && <button type='button' className='inline-flex min-h-10 items-center gap-2 rounded-md border px-3 py-1.5 text-sm' onClick={openFullClient}><ExternalLink className='h-4 w-4' />{messages?.openApiClient || 'Open in API Client'}</button>}
      </div>
    </div>

    {advanced && <div className={`rounded-lg border p-3 ${panel}`}>
      <label className='flex flex-wrap items-center gap-2 text-sm font-medium'>
        <span>{messages?.environment || 'Environment'}</span>
        <select
          aria-label={messages?.environment || 'Try It environment'}
          className={`min-w-48 rounded-md border px-2 py-1.5 text-sm ${input}`}
          value={environmentWorkspace.activeEnvironmentId || ''}
          onChange={(event) => setEnvironmentWorkspace((current) => ({ ...current, activeEnvironmentId: event.target.value || undefined }))}
        >
          <option value=''>{messages?.noEnvironment || 'No environment'}</option>
          {environmentWorkspace.environments.map((environment) => <option key={environment.id} value={environment.id}>{environment.name}</option>)}
        </select>
      </label>
    </div>}

    <ApiClient
      initialRequest={initialSession.request}
      initialScripts={initialScripts}
      initialRequestTab={requestTab}
      initialScriptTab={scriptTab}
      density={density}
      theme={theme}
      messages={messages}
      credentials={options?.tryIt?.credentials || 'same-origin'}
      requestInterceptor={options?.tryIt?.requestInterceptor}
      hostExecution={options?.tryIt?.hostExecution}
      environmentVariables={environmentVariables}
      serverOptions={servers}
      initialServerUrl={initialSession.serverUrl}
      onServerUrlChange={setServerUrl}
      onRequestChange={onRequestChange}
      onDraftChange={setDraft}
      onScriptsChange={(next) => setScripts(cloneApiClientScripts(next))}
      onRequestTabChange={(tab) => { setRequestTab(tab); replaceViewerState('tab', tab); }}
      onScriptTabChange={(tab) => { setScriptTab(tab); replaceViewerState('script', tab); }}
      onEnvironmentChanges={(changes) => setEnvironmentWorkspace((current) => applyApiClientEnvironmentChanges(current, changes))}
    />
  </div>;
};
