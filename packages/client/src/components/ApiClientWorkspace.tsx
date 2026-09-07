import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { ApiClient } from './ApiClient';
import type { ApiClientExecutionResult, ApiClientProps, ApiClientRequestTab, ApiClientScriptTab } from './ApiClient';
import { ApiClientCollections } from './ApiClientCollections';
import { ApiClientEnvironments } from './ApiClientEnvironments';
import { ApiClientHistory } from './ApiClientHistory';
import { ApiClientHistoryPage } from './ApiClientHistoryPage';
import { ApiClientImport } from './ApiClientImport';
import { ApiClientRunnerPage } from './ApiClientRunnerPage';
import { inferHttpBodyMode } from '../utils/http-client';
import type { HttpAuth, HttpRequestDraft } from '../utils/http-client';
import type { ApiClientRequestScripts, ApiClientScriptCollectionChange, ApiClientScriptEnvironmentChange } from '../utils/api-client-scripting';
import type { BuiltRequest } from '../utils/request-builder';
import {
  activeApiClientEnvironmentVariables,
  addApiClientHistoryEntry,
  applyApiClientCollectionChanges,
  applyApiClientEnvironmentChanges,
  apiClientCollectionVariables,
  cloneRequestDraft,
  createDefaultApiClientWorkspace,
  loadApiClientWorkspace,
  resolveApiClientAuth,
  saveApiClientWorkspace,
} from '../utils/api-client-workspace';
import { cloneApiClientScripts } from '../utils/api-client-scripting';
import { readApiClientUiPreferences, writeApiClientUiPreferences } from '../utils/api-client-ui-preferences';
import type { ApiClientWorkspaceState } from '../utils/api-client-workspace';

export interface ApiClientWorkspaceChromeState { environments: Array<{ id: string; name: string }>; activeEnvironmentId?: string; hasUnsavedRequest: boolean; }
export interface ApiClientWorkspaceHandoff { id: number; request: HttpRequestDraft; scripts?: ApiClientRequestScripts; requestTab?: ApiClientRequestTab; scriptTab?: ApiClientScriptTab; serverUrl?: string; }
export interface ApiClientWorkspaceProps extends ApiClientProps {
  persistenceKey?: string | false;
  pageMode?: boolean;
  manageTheme?: boolean;
  handoff?: ApiClientWorkspaceHandoff;
  activeEnvironmentId?: string | null;
  onActiveEnvironmentIdChange?: (environmentId?: string) => void;
  onChromeStateChange?: (state: ApiClientWorkspaceChromeState) => void;
}

function withWorkspaceDefaults(initialRequest?: Partial<HttpRequestDraft>): HttpRequestDraft {
  return {
    method: initialRequest?.method || 'GET',
    url: initialRequest?.url || '',
    query: initialRequest?.query?.map((entry) => ({ ...entry })) || [],
    headers: initialRequest?.headers?.map((entry) => ({ ...entry })) || [],
    body: initialRequest?.body || '',
    contentType: initialRequest?.contentType || 'application/json',
    bodyMode: initialRequest?.bodyMode,
    urlencoded: initialRequest?.urlencoded?.map((entry) => ({ ...entry })),
    formData: initialRequest?.formData?.map((entry) => ({ ...entry })),
    binary: initialRequest?.binary ? { ...initialRequest.binary } : undefined,
    graphql: initialRequest?.graphql ? { ...initialRequest.graphql } : undefined,
    hostExecution: initialRequest?.hostExecution ? { ...initialRequest.hostExecution } : undefined,
    auth: initialRequest?.auth
      ? initialRequest.auth.type === 'oauth2'
        ? { ...initialRequest.auth, scopes: initialRequest.auth.scopes ? [...initialRequest.auth.scopes] : undefined }
        : { ...initialRequest.auth }
      : { type: 'inherit' },
  };
}

function preferredSavedRequestTab(request: HttpRequestDraft, scripts: ApiClientRequestScripts): ApiClientRequestTab {
  if (inferHttpBodyMode(request) !== 'none') return 'body';
  if (scripts.preRequest.trim() || scripts.tests.trim()) return 'scripts';
  if (request.auth && request.auth.type !== 'none' && request.auth.type !== 'inherit') return 'authorization';
  if ((request.headers || []).some((entry) => entry.enabled !== false && entry.key.trim())) return 'headers';
  return 'params';
}

function preferredScriptTab(scripts: ApiClientRequestScripts): ApiClientScriptTab {
  return scripts.tests.trim() && !scripts.preRequest.trim() ? 'tests' : 'pre-request';
}

function requestStateFingerprint(request: HttpRequestDraft, scripts?: ApiClientRequestScripts): string {
  return JSON.stringify({ request, scripts: cloneApiClientScripts(scripts) }, (_key, value) => {
    if (typeof File !== 'undefined' && value instanceof File) {
      return { name: value.name, size: value.size, type: value.type, lastModified: value.lastModified };
    }
    return value;
  });
}

function hasMeaningfulDraft(request: HttpRequestDraft, scripts: ApiClientRequestScripts): boolean {
  return !!request.url.trim()
    || !!request.body?.trim()
    || !!request.query?.some((entry) => entry.key.trim() || entry.value.trim())
    || !!request.headers?.some((entry) => entry.key.trim() || entry.value.trim())
    || !!scripts.preRequest.trim()
    || !!scripts.tests.trim();
}

export const ApiClientWorkspace: React.FC<ApiClientWorkspaceProps> = ({
  initialRequest,
  initialScripts,
  initialRequestTab,
  initialScriptTab,
  theme = 'light',
  persistenceKey = 'default',
  pageMode = false,
  manageTheme = true,
  handoff,
  activeEnvironmentId,
  onActiveEnvironmentIdChange,
  onChromeStateChange,
  onRequestChange,
  onDraftChange,
  onScriptsChange,
  onRequestTabChange,
  onScriptTabChange,
  onExecutionStart,
  onExecutionComplete,
  variables: externalVariables = {},
  environmentVariables: externalEnvironmentVariables = {},
  onCollectionChanges,
  onEnvironmentChanges,
  ...apiClientProps
}) => {
  const initialDraft = withWorkspaceDefaults(initialRequest);
  const initialScriptState = cloneApiClientScripts(initialScripts);
  const initialWorkspace = createDefaultApiClientWorkspace();
  const initialUiPreferences = persistenceKey === false ? { version: 1 as const } : readApiClientUiPreferences(persistenceKey);
  const [editorRequest, setEditorRequest] = useState<HttpRequestDraft>(initialDraft);
  const [currentRequest, setCurrentRequest] = useState<HttpRequestDraft>(initialDraft);
  const [editorScripts, setEditorScripts] = useState<ApiClientRequestScripts>(initialScriptState);
  const [currentScripts, setCurrentScripts] = useState<ApiClientRequestScripts>(initialScriptState);
  const [editorServerUrl, setEditorServerUrl] = useState<string | undefined>(apiClientProps.initialServerUrl);
  const [editorRevision, setEditorRevision] = useState(0);
  const [editorRequestTab, setEditorRequestTab] = useState<ApiClientRequestTab>(initialRequestTab || initialUiPreferences.requestTab || 'params');
  const [editorScriptTab, setEditorScriptTab] = useState<ApiClientScriptTab>(initialScriptTab || initialUiPreferences.scriptTab || preferredScriptTab(initialScriptState));
  const [activeView, setActiveView] = useState<'request' | 'history' | 'runner'>('request');
  const [historyFocus, setHistoryFocus] = useState<{ entryId?: string; runId?: string }>({});
  const [runnerTarget, setRunnerTarget] = useState<{ collectionId: string; folderId?: string }>();
  const [workspace, setWorkspace] = useState<ApiClientWorkspaceState>(initialWorkspace);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | undefined>(initialWorkspace.collections[0]?.id);
  const [selectedFolderId, setSelectedFolderId] = useState('');
  const executionCollectionIdRef = useRef<string | undefined>(initialWorkspace.collections[0]?.id);
  const executionFolderIdRef = useRef<string | undefined>(undefined);
  const [hydrated, setHydrated] = useState(persistenceKey === false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(initialUiPreferences.sidebarCollapsed ?? false);
  const [workspaceTheme, setWorkspaceTheme] = useState<'light' | 'dark'>(initialUiPreferences.theme || theme);
  const activeTheme = manageTheme ? workspaceTheme : theme;

  useEffect(() => {
    if (persistenceKey === false) return;
    let cancelled = false;
    loadApiClientWorkspace(persistenceKey)
      .then((next) => {
        if (cancelled) return;
        setWorkspace(next);
        setSelectedCollectionId(next.collections[0]?.id);
        setSelectedFolderId('');
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

  useEffect(() => {
    if (activeEnvironmentId === undefined) return;
    const next = activeEnvironmentId || undefined;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setWorkspace((current) => current.activeEnvironmentId === next ? current : { ...current, activeEnvironmentId: next });
    });
    return () => { cancelled = true; };
  }, [activeEnvironmentId]);
  const currentFingerprint = useMemo(() => requestStateFingerprint(currentRequest, currentScripts), [currentRequest, currentScripts]);
  const hasUnsavedRequest = useMemo(
    () => hasMeaningfulDraft(currentRequest, currentScripts)
      && !workspace.requests.some((saved) => requestStateFingerprint(saved.request, saved.scripts) === currentFingerprint),
    [currentFingerprint, currentRequest, currentScripts, workspace.requests],
  );

  useEffect(() => {
    onChromeStateChange?.({ environments: workspace.environments.map(({ id, name }) => ({ id, name })), activeEnvironmentId: workspace.activeEnvironmentId, hasUnsavedRequest });
  }, [hasUnsavedRequest, onChromeStateChange, workspace.activeEnvironmentId, workspace.environments]);

  const resolveAuth = useCallback((auth: HttpAuth | undefined) => resolveApiClientAuth(
    workspace,
    selectedCollectionId,
    selectedFolderId || undefined,
    auth || { type: 'none' },
  ), [selectedCollectionId, selectedFolderId, workspace]);

  const handleSelectedCollectionChange = useCallback((collectionId?: string) => {
    setSelectedCollectionId(collectionId);
    setSelectedFolderId('');
  }, []);

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

  const handleRequestTabChange = (tab: ApiClientRequestTab) => {
    setEditorRequestTab(tab);
    if (persistenceKey !== false) writeApiClientUiPreferences(persistenceKey, { requestTab: tab });
    onRequestTabChange?.(tab);
  };

  const handleScriptTabChange = (tab: ApiClientScriptTab) => {
    setEditorScriptTab(tab);
    if (persistenceKey !== false) writeApiClientUiPreferences(persistenceKey, { scriptTab: tab });
    onScriptTabChange?.(tab);
  };

  const handleCollectionChanges = (changes: ApiClientScriptCollectionChange[]) => {
    const collectionId = executionCollectionIdRef.current || selectedCollectionId;
    setWorkspace((current) => applyApiClientCollectionChanges(current, collectionId, changes));
    onCollectionChanges?.(changes);
  };

  const handleEnvironmentChanges = (changes: ApiClientScriptEnvironmentChange[]) => {
    setWorkspace((current) => applyApiClientEnvironmentChanges(current, changes));
    onEnvironmentChanges?.(changes);
  };

  const handleExecutionStart = () => {
    executionCollectionIdRef.current = selectedCollectionId;
    executionFolderIdRef.current = selectedFolderId || undefined;
    onExecutionStart?.();
  };

  const handleExecutionComplete = (result: ApiClientExecutionResult) => {
    setWorkspace((current) => addApiClientHistoryEntry(current, { ...result, collectionId: executionCollectionIdRef.current, folderId: executionFolderIdRef.current }));
    onExecutionComplete?.(result);
  };

  const loadSavedRequest = (request: HttpRequestDraft, scripts?: ApiClientRequestScripts, collectionId?: string, folderId?: string) => {
    setActiveView('request');
    const validCollectionId = collectionId && workspace.collections.some((collection) => collection.id === collectionId) ? collectionId : undefined;
    if (validCollectionId) setSelectedCollectionId(validCollectionId);
    const targetCollectionId = validCollectionId || selectedCollectionId;
    const validFolderId = folderId && workspace.folders.some((folder) => folder.id === folderId && folder.collectionId === targetCollectionId) ? folderId : '';
    setSelectedFolderId(validFolderId);
    const nextRequest = cloneRequestDraft(request);
    const nextScripts = cloneApiClientScripts(scripts);
    const nextRequestTab = preferredSavedRequestTab(nextRequest, nextScripts);
    const nextScriptTab = preferredScriptTab(nextScripts);
    setEditorRequestTab(nextRequestTab);
    setEditorScriptTab(nextScriptTab);
    if (persistenceKey !== false) writeApiClientUiPreferences(persistenceKey, { requestTab: nextRequestTab, scriptTab: nextScriptTab });
    setEditorRequest(nextRequest);
    setCurrentRequest(nextRequest);
    setEditorScripts(nextScripts);
    setCurrentScripts(nextScripts);
    setEditorServerUrl(undefined);
    setEditorRevision((revision) => revision + 1);
  };

  useEffect(() => {
    if (!handoff) return;
    const nextRequest = cloneRequestDraft(handoff.request);
    const nextScripts = cloneApiClientScripts(handoff.scripts);
    const nextRequestTab = handoff.requestTab || preferredSavedRequestTab(nextRequest, nextScripts);
    const nextScriptTab = handoff.scriptTab || preferredScriptTab(nextScripts);
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setActiveView('request');
      setEditorRequest(nextRequest);
      setCurrentRequest(nextRequest);
      setEditorScripts(nextScripts);
      setCurrentScripts(nextScripts);
      setEditorServerUrl(handoff.serverUrl);
      setEditorRequestTab(nextRequestTab);
      setEditorScriptTab(nextScriptTab);
      setEditorRevision((revision) => revision + 1);
    });
    return () => { cancelled = true; };
  }, [handoff]);

  const openRunner = (collectionId: string, folderId?: string) => {
    setSelectedCollectionId(collectionId);
    setSelectedFolderId(folderId || '');
    setRunnerTarget({ collectionId, folderId });
    setActiveView('runner');
  };

  const openHistory = (entryId?: string, runId?: string) => {
    setHistoryFocus({ entryId, runId });
    setActiveView('history');
  };

  const toggleSidebar = () => setSidebarCollapsed((current) => {
    const next = !current;
    if (persistenceKey !== false) writeApiClientUiPreferences(persistenceKey, { sidebarCollapsed: next });
    return next;
  });

  const panelClass = activeTheme === 'dark' ? 'border-gray-700 bg-gray-900/40 text-gray-100' : 'border-gray-200 bg-white text-gray-900';
  const inputClass = activeTheme === 'dark' ? 'border-gray-700 bg-gray-900 text-gray-100' : 'border-gray-300 bg-white text-gray-900';

  return <div className={`grid h-full min-h-0 min-w-0 ${pageMode ? 'gap-0' : 'gap-4'} ${sidebarCollapsed ? 'lg:grid-cols-[3.5rem_minmax(0,1fr)]' : 'lg:grid-cols-[19rem_minmax(0,1fr)]'}`} data-api-client-workspace>
    <aside className={`min-h-0 min-w-0 overflow-y-auto border p-3 ${pageMode ? 'rounded-none border-b-0 border-l-0 border-t-0' : 'rounded-xl'} ${panelClass}`} data-api-client-workspace-sidebar data-collapsed={sidebarCollapsed ? 'true' : 'false'}>
      <div className={`mb-3 flex ${sidebarCollapsed ? 'justify-center' : 'justify-end'}`}>
        <button type='button' className='inline-flex h-10 w-10 items-center justify-center rounded-md border' aria-label={sidebarCollapsed ? 'Expand API Client sidebar' : 'Collapse API Client sidebar'} aria-expanded={!sidebarCollapsed} onClick={toggleSidebar}>
          {sidebarCollapsed ? <PanelLeftOpen className='h-4 w-4' /> : <PanelLeftClose className='h-4 w-4' />}
        </button>
      </div>
      {!sidebarCollapsed && <div className='space-y-5'>
      <ApiClientImport
        onWorkspaceChange={setWorkspace}
        onSelectedCollectionChange={handleSelectedCollectionChange}
        theme={activeTheme}
      />
      <div className='border-t pt-4'>
        <ApiClientEnvironments workspace={workspace} onWorkspaceChange={setWorkspace} theme={activeTheme} />
      </div>
      <div className='border-t pt-4'>
        <ApiClientCollections
          request={currentRequest}
          scripts={currentScripts}
          onLoadRequest={loadSavedRequest}
          onSelectedCollectionChange={handleSelectedCollectionChange}
          onSelectedFolderChange={setSelectedFolderId}
          onRunCollection={(collectionId) => openRunner(collectionId)}
          onRunFolder={(collectionId, folderId) => openRunner(collectionId, folderId)}
          selectedCollectionId={selectedCollectionId}
          selectedFolderId={selectedFolderId}
          workspace={workspace}
          onWorkspaceChange={setWorkspace}
          hostExecution={apiClientProps.hostExecution}
          theme={activeTheme}
        />
      </div>
      <div className='border-t pt-4'>
        <ApiClientHistory
          workspace={workspace}
          onWorkspaceChange={setWorkspace}
          onLoadRequest={loadSavedRequest}
          onViewAll={() => openHistory()}
          theme={activeTheme}
        />
      </div>
      </div>}
    </aside>
    <div className='min-h-0 min-w-0 overflow-y-auto overscroll-contain'>
    <div className={`mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-xs ${panelClass}`} data-api-client-toolbar>
      <label className='flex items-center gap-2'>
        <span>{apiClientProps.messages?.environment || 'Environment'}</span>
        <select
          aria-label={apiClientProps.messages?.environment || 'API Client environment'}
          className={`rounded-md border px-2 py-1 text-xs ${inputClass}`}
          value={workspace.activeEnvironmentId || ''}
          onChange={(event) => {
            const nextEnvironmentId = event.target.value || undefined;
            setWorkspace((current) => ({ ...current, activeEnvironmentId: nextEnvironmentId }));
            onActiveEnvironmentIdChange?.(nextEnvironmentId);
          }}
        >
          <option value=''>{apiClientProps.messages?.noEnvironment || 'No environment'}</option>
          {workspace.environments.map((environment) => <option key={environment.id} value={environment.id}>{environment.name}</option>)}
        </select>
      </label>
      <div className='flex flex-wrap items-center gap-2'>
        {manageTheme && <button type='button' className={`rounded-md border px-2 py-1 text-xs ${inputClass}`} aria-label={`${apiClientProps.messages?.viewerTheme || 'Theme'}: ${activeTheme === 'dark' ? (apiClientProps.messages?.lightTheme || 'Light') : (apiClientProps.messages?.darkTheme || 'Dark')}`} aria-pressed={activeTheme === 'dark'} onClick={() => { const next = activeTheme === 'dark' ? 'light' : 'dark'; setWorkspaceTheme(next); if (persistenceKey !== false) writeApiClientUiPreferences(persistenceKey, { theme: next }); }}>{apiClientProps.messages?.viewerTheme || 'Theme'}: {activeTheme === 'dark' ? (apiClientProps.messages?.darkTheme || 'Dark') : (apiClientProps.messages?.lightTheme || 'Light')}</button>}
        {activeView === 'request' && hasUnsavedRequest && <span aria-label='Unsaved request changes'>{apiClientProps.messages?.unsavedChanges || 'Unsaved changes'}</span>}
      </div>
    </div>
    {activeView === 'history' ? <ApiClientHistoryPage
      key={`${historyFocus.runId || ''}:${historyFocus.entryId || ''}`}
      workspace={workspace}
      onWorkspaceChange={setWorkspace}
      onLoadRequest={loadSavedRequest}
      onBack={() => setActiveView('request')}
      initialEntryId={historyFocus.entryId}
      initialRunId={historyFocus.runId}
      theme={activeTheme}
    /> : activeView === 'runner' && runnerTarget ? <ApiClientRunnerPage
      workspace={workspace}
      onWorkspaceChange={setWorkspace}
      collectionId={runnerTarget.collectionId}
      folderId={runnerTarget.folderId}
      theme={activeTheme}
      credentials={apiClientProps.credentials}
      requestInterceptor={apiClientProps.requestInterceptor}
      hostExecution={apiClientProps.hostExecution}
      externalVariables={externalVariables}
      externalEnvironmentVariables={externalEnvironmentVariables}
      onCollectionChanges={onCollectionChanges}
      onEnvironmentChanges={onEnvironmentChanges}
      onOpenHistory={openHistory}
      onBack={() => setActiveView('request')}
    /> : <ApiClient
      key={editorRevision}
      {...apiClientProps}
      initialRequest={editorRequest}
      initialScripts={editorScripts}
      initialRequestTab={editorRequestTab}
      initialScriptTab={editorScriptTab}
      initialServerUrl={editorServerUrl}
      theme={activeTheme}
      resolveAuth={resolveAuth}
      variables={variables}
      collectionVariables={collectionVariables}
      externalVariables={externalVariables}
      environmentVariables={environmentVariables}
      onCollectionChanges={handleCollectionChanges}
      onEnvironmentChanges={handleEnvironmentChanges}
      onDraftChange={handleDraftChange}
      onScriptsChange={handleScriptsChange}
      onRequestTabChange={handleRequestTabChange}
      onScriptTabChange={handleScriptTabChange}
      onExecutionStart={handleExecutionStart}
      onExecutionComplete={handleExecutionComplete}
      onRequestChange={handleRequestChange}
    />}
    </div>
  </div>;
};