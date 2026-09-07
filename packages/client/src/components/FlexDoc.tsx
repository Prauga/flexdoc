import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, ArrowLeft, Menu, PanelLeftClose, PanelLeftOpen, Settings as SettingsIcon, X } from 'lucide-react';
import * as yaml from 'js-yaml';
import { OpenAPISpec } from '../types/openapi';
import { Sidebar } from './Sidebar';
import { EndpointDetail } from './EndpointDetail';
import { Overview } from './Overview';
import '../index.css';
import { Footer } from './Footer';
import { themeVariant } from '../utils/theme';
import { OpenAPIParser } from '../utils/openapi-parser';
import type { ExpandOption, FlexDocRendererOptions, FlexDocRuntimeIntelligenceSnapshot, FlexDocViewerTheme, LogoOptions, ThemeConfig } from '../types/options';
import {
  createFlexDocViewerPreferencesKey,
  readFlexDocViewerPreferences,
  resolveExpandSections,
  writeFlexDocViewerExpandPreference,
  writeFlexDocViewerExpandedTagsPreference,
  writeFlexDocViewerSidebarPreference,
  writeFlexDocViewerThemePreference,
} from '../utils/renderer-preferences';
import type { FlexDocViewerPreferences } from '../utils/renderer-preferences';
import { parseRuntimeIntelligenceSnapshot } from '../utils/runtime-intelligence';
import { operationHashId, legacyOperationHashId } from '../utils/operation-id';
import { createDefaultApiClientPersistenceKey } from '../utils/api-client-workspace';
import { FlexDocCommandPalette } from './FlexDocCommandPalette';
import { FlexDocSettings } from './FlexDocSettings';
import { RuntimeIntelligencePanel } from './RuntimeIntelligencePanel';
import { ApiClientWorkspace } from './ApiClientWorkspace';
import type { ApiClientWorkspaceChromeState, ApiClientWorkspaceHandoff } from './ApiClientWorkspace';
import type { TryItApiClientHandoff } from './TryItApiClientWorkspace';

export interface FlexDocProps {
  /** Parsed OpenAPI document to render. */
  spec: OpenAPISpec;
  /** Root theme for the documentation chrome. */
  theme?: 'light' | 'dark';
  /** Inline styles applied to the renderer root element. */
  customStyles?: React.CSSProperties;
  /** Renderer configuration such as Try It, theme tokens, and runtime intelligence. */
  options?: FlexDocRendererOptions;
}

type FlexDocView = 'docs' | 'api-client';

function cssValue(value?: string | number): string | undefined {
  if (value === undefined) return undefined;
  return typeof value === 'number' ? `${value}px` : value;
}

function themeStyles(theme: 'light' | 'dark', config?: ThemeConfig): React.CSSProperties {
  if (!config) return {};
  const colors = config.colors || {};
  const typography = config.typography || {};
  const sidebar = config.sidebar || {};
  return {
    '--flexdoc-primary': colors.primary?.main,
    '--flexdoc-text': colors.text?.primary,
    '--flexdoc-text-muted': colors.text?.secondary,
    '--flexdoc-border': theme === 'dark' ? colors.border?.dark : colors.border?.light,
    '--flexdoc-sidebar-bg': theme === 'dark' ? sidebar.backgroundColorDark : sidebar.backgroundColor,
    '--flexdoc-sidebar-text': theme === 'dark' ? sidebar.textColorDark : sidebar.textColor,
    '--flexdoc-sidebar-active-text': theme === 'dark' ? sidebar.activeTextColorDark : sidebar.activeTextColor,
    '--flexdoc-heading-font': typography.headings?.fontFamily,
    '--flexdoc-heading-weight': typography.headings?.fontWeight,
    '--flexdoc-code-font': typography.code?.fontFamily,
    '--flexdoc-code-size': typography.code?.fontSize,
    '--flexdoc-code-line-height': typography.code?.lineHeight,
    '--flexdoc-code-color': typography.code?.color,
    '--flexdoc-code-bg': typography.code?.backgroundColor,
    fontFamily: typography.fontFamily,
    fontSize: typography.fontSize,
    lineHeight: typography.lineHeight,
  } as React.CSSProperties;
}

function endpointFromHash(spec: OpenAPISpec, hash: string): { path: string; method: string } | null {
  const normalized = hash.replace(/^#/, '');
  if (!normalized) return null;
  const legacyMatches: Array<{ path: string; method: string }> = [];
  for (const [path, pathItem] of Object.entries(spec.paths)) {
    for (const method of OpenAPIParser.getHttpMethods(pathItem)) {
      if (operationHashId(path, method) === normalized) return { path, method };
      if (legacyOperationHashId(path, method) === normalized) legacyMatches.push({ path, method });
    }
  }
  return legacyMatches.length === 1 ? legacyMatches[0] : null;
}

function viewFromLocation(): FlexDocView {
  if (typeof window === 'undefined') return 'docs';
  return new URLSearchParams(window.location.search).get('view') === 'api-client' ? 'api-client' : 'docs';
}

function replaceViewState(view?: FlexDocView): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (view === 'api-client') url.searchParams.set('view', 'api-client');
  else url.searchParams.delete('view');
  window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
}

function downloadSpec(spec: OpenAPISpec, format: 'json' | 'yaml'): string | undefined {
  if (typeof document === 'undefined' || typeof URL === 'undefined') return 'Downloads are unavailable in this environment.';
  try {
    const content = format === 'yaml'
      ? yaml.dump(spec, { lineWidth: 120, noRefs: false })
      : JSON.stringify(spec, null, 2);
    const blob = new Blob([content], { type: format === 'yaml' ? 'application/yaml;charset=utf-8' : 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `openapi.${format === 'yaml' ? 'yaml' : 'json'}`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    return undefined;
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    return `Unable to download ${format.toUpperCase()}: ${reason}`;
  }
}

function Logo({ logo, onHome }: { logo: string | LogoOptions; onHome: () => void }) {
  const config: LogoOptions = typeof logo === 'string' ? { url: logo } : logo;
  const padding = typeof config.padding === 'object'
    ? `${cssValue(config.padding.vertical) || '0'} ${cssValue(config.padding.horizontal) || '0'}`
    : config.padding;
  const image = <img src={config.url} alt={config.alt || 'API documentation logo'} style={{ maxHeight: cssValue(config.maxHeight) || '32px', maxWidth: cssValue(config.maxWidth) || '180px' }} />;
  return <div className={`flex items-center ${config.containerClass || ''}`} style={{ backgroundColor: config.backgroundColor, padding }}>
    {config.clickable === false ? image : <button type='button' aria-label='Documentation home' onClick={onHome}>{image}</button>}
  </div>;
}

/** Self-hosted OpenAPI documentation renderer with Try It and API Client integration. */
export const FlexDoc: React.FC<FlexDocProps> = ({
  spec,
  theme = 'light',
  customStyles = {},
  options = {},
}: FlexDocProps) => {
  const preferenceKey = createFlexDocViewerPreferencesKey(spec.info.title, typeof window === 'undefined' ? undefined : window.location.host);
  const initialPreferences = readFlexDocViewerPreferences(preferenceKey);
  const apiClientPersistenceKey = options.tryIt?.apiClientPersistenceKey
    ?? createDefaultApiClientPersistenceKey(spec.info.title, typeof window === 'undefined' ? undefined : window.location.host);
  const initialView = viewFromLocation();
  const [selectedEndpoint, setSelectedEndpoint] = useState<{ path: string; method: string } | null>(() =>
    typeof window === 'undefined' ? null : endpointFromHash(spec, window.location.hash)
  );
  const [activeView, setActiveView] = useState<FlexDocView>(initialView);
  const [apiClientVisited, setApiClientVisited] = useState(initialView === 'api-client');
  const [apiClientHandoff, setApiClientHandoff] = useState<ApiClientWorkspaceHandoff>();
  const nextHandoffId = useRef(0);
  const [apiClientChrome, setApiClientChrome] = useState<ApiClientWorkspaceChromeState>({ environments: [], hasUnsavedRequest: false });
  const [requestedApiClientEnvironmentId, setRequestedApiClientEnvironmentId] = useState<string | null | undefined>(undefined);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [runtimeOpen, setRuntimeOpen] = useState(false);
  const [downloadError, setDownloadError] = useState<string>();
  const [runtimeResult, setRuntimeResult] = useState<{ endpoint: string; snapshot?: FlexDocRuntimeIntelligenceSnapshot; error?: string }>();
  const [viewerPreferenceState, setViewerPreferenceState] = useState<{ key: string; preferences: FlexDocViewerPreferences }>(() => ({
    key: preferenceKey,
    preferences: initialPreferences,
  }));
  const mobileDialogRef = useRef<HTMLDivElement | null>(null);
  const mobileNavTriggerRef = useRef<HTMLButtonElement | null>(null);
  const mainScrollRef = useRef<HTMLElement | null>(null);

  const runtimeAvailable = options.runtimeIntelligence?.available === true;
  const runtimeEndpoint = options.runtimeIntelligence?.endpoint;
  const activeRuntimeResult = runtimeAvailable && runtimeEndpoint && runtimeResult?.endpoint === runtimeEndpoint
    ? runtimeResult
    : undefined;
  const runtimeSnapshot = activeRuntimeResult?.snapshot;
  const runtimeError = activeRuntimeResult?.error;
  const runtimeLoading = Boolean(runtimeAvailable && runtimeEndpoint && !activeRuntimeResult);
  const closeRuntime = useCallback(() => setRuntimeOpen(false), []);
  const viewerPreferences = viewerPreferenceState.key === preferenceKey
    ? viewerPreferenceState.preferences
    : readFlexDocViewerPreferences(preferenceKey);
  const effectiveThemeChoice: FlexDocViewerTheme = viewerPreferences.theme || theme;
  const effectiveTheme: 'light' | 'dark' = effectiveThemeChoice === 'high-contrast' ? 'dark' : effectiveThemeChoice;
  const viewerExpand = viewerPreferences.expand;
  const expandedTags = viewerPreferences.expandedTags ?? ['default'];
  const desktopSidebarCollapsed = viewerPreferences.sidebarCollapsed ?? false;
  const themeConfig = typeof options.theme === 'object' ? options.theme : undefined;
  const mergedStyles = useMemo(() => ({ ...themeStyles(effectiveTheme, themeConfig), ...customStyles }), [effectiveTheme, themeConfig, customStyles]);

  useEffect(() => {
    if (!runtimeAvailable || !runtimeEndpoint) return;
    const controller = new AbortController();
    fetch(runtimeEndpoint, { credentials: 'same-origin', signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Runtime intelligence unavailable: HTTP ${response.status}`);
        return parseRuntimeIntelligenceSnapshot(await response.json());
      })
      .then((snapshot) => setRuntimeResult({ endpoint: runtimeEndpoint, snapshot }))
      .catch((error) => {
        if (controller.signal.aborted) return;
        setRuntimeResult({ endpoint: runtimeEndpoint, error: error instanceof Error ? error.message : String(error) });
      });
    return () => controller.abort();
  }, [runtimeAvailable, runtimeEndpoint]);

  useEffect(() => {
    if (!options.customCss) return;
    const element = document.createElement('style');
    element.dataset.flexdocCustomCss = 'true';
    element.textContent = options.customCss;
    document.head.appendChild(element);
    return () => element.remove();
  }, [options.customCss]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const syncHash = () => setSelectedEndpoint(endpointFromHash(spec, window.location.hash));
    const syncView = () => {
      const nextView = viewFromLocation();
      setActiveView(nextView);
      if (nextView === 'api-client') setApiClientVisited(true);
    };
    syncHash();
    syncView();
    window.addEventListener('hashchange', syncHash);
    window.addEventListener('popstate', syncView);
    return () => {
      window.removeEventListener('hashchange', syncHash);
      window.removeEventListener('popstate', syncView);
    };
  }, [spec]);

  useEffect(() => {
    if (!mobileNavOpen || typeof document === 'undefined') return;
    const previousOverflow = document.body.style.overflow;
    const trigger = mobileNavTriggerRef.current;
    document.body.style.overflow = 'hidden';
    const dialog = mobileDialogRef.current;
    const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>('button:not([data-focus-trap-ignore]):not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') || []);
    requestAnimationFrame(() => focusable()[0]?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setMobileNavOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      trigger?.focus();
    };
  }, [mobileNavOpen]);

  const setViewerPreferencesFromStorage = () => {
    setViewerPreferenceState({ key: preferenceKey, preferences: readFlexDocViewerPreferences(preferenceKey) });
  };

  const updateViewerPreferences = (patch: Partial<FlexDocViewerPreferences>) => {
    setViewerPreferenceState((current) => {
      const base = current.key === preferenceKey ? current.preferences : readFlexDocViewerPreferences(preferenceKey);
      return { key: preferenceKey, preferences: { ...base, ...patch, version: 1 } };
    });
  };

  const resetMainScroll = () => requestAnimationFrame(() => mainScrollRef.current?.scrollTo({ top: 0, behavior: 'auto' }));

  const handleEndpointSelect = (path: string, method: string) => {
    setSelectedEndpoint({ path, method });
    setActiveView('docs');
    setMobileNavOpen(false);
    replaceViewState('docs');
    if (typeof window !== 'undefined') window.location.hash = operationHashId(path, method);
    resetMainScroll();
  };

  const handleHome = () => {
    setSelectedEndpoint(null);
    setActiveView('docs');
    setMobileNavOpen(false);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('view');
      url.hash = '';
      window.history.replaceState(null, '', `${url.pathname}${url.search}`);
    }
    resetMainScroll();
  };

  const openApiClient = (session?: TryItApiClientHandoff) => {
    if (session) {
      nextHandoffId.current += 1;
      setApiClientHandoff({ id: nextHandoffId.current, request: session.request, scripts: session.scripts, requestTab: session.requestTab, scriptTab: session.scriptTab, serverUrl: session.serverUrl });
    }
    setApiClientVisited(true);
    setActiveView('api-client');
    replaceViewState('api-client');
  };

  const backToOperation = () => {
    setActiveView('docs');
    replaceViewState('docs');
    resetMainScroll();
  };

  const toggleDesktopSidebar = () => {
    const next = !desktopSidebarCollapsed;
    writeFlexDocViewerSidebarPreference(preferenceKey, next);
    updateViewerPreferences({ sidebarCollapsed: next });
  };

  const hostExpandedSections = resolveExpandSections(options.expand, options.expand === undefined ? options.expandResponses : undefined);
  const defaultExpandedSections = viewerExpand === undefined ? hostExpandedSections : resolveExpandSections(viewerExpand);
  const handleViewerExpandChange = (expand?: ExpandOption) => {
    writeFlexDocViewerExpandPreference(preferenceKey, expand);
    setViewerPreferencesFromStorage();
  };
  const handleViewerThemeChange = (nextTheme?: FlexDocViewerTheme) => {
    writeFlexDocViewerThemePreference(preferenceKey, nextTheme);
    setViewerPreferencesFromStorage();
  };
  const handleExpandedTagsChange = (tags: string[]) => {
    writeFlexDocViewerExpandedTagsPreference(preferenceKey, tags);
    updateViewerPreferences({ expandedTags: tags });
  };

  const sendCurrentRequest = useCallback(() => {
    if (typeof document === 'undefined') return;
    const scope = activeView === 'api-client'
      ? document.querySelector<HTMLElement>('[data-api-client-page="api-client"]:not(.hidden)')
      : document.querySelector<HTMLElement>('[data-flexdoc-docs-view="docs"]:not(.hidden)');
    scope?.querySelector<HTMLButtonElement>('[data-api-client-send="true"]:not([disabled])')?.click();
  }, [activeView]);

  const footerClasses = themeVariant(effectiveTheme, 'border-gray-200 bg-white text-gray-600', 'border-gray-700 bg-gray-800 text-gray-300');
  const rootClasses = effectiveTheme === 'dark' ? 'bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-900';
  const floatingButtonTheme = effectiveTheme === 'dark' ? 'border-gray-700 bg-gray-900 text-gray-100' : 'border-gray-200 bg-white text-gray-900';
  const messages = options.messages;

  const settingsButton = (floating = false) => <button
    type='button'
    data-flexdoc-floating-control={floating ? 'settings' : undefined}
    className={floating
      ? `fixed bottom-4 right-4 z-40 inline-flex h-11 w-11 items-center justify-center rounded-full border shadow-lg ${floatingButtonTheme}`
      : 'inline-flex h-11 w-11 items-center justify-center rounded-md border'}
    aria-label={messages?.openSettings || 'Open settings'}
    aria-expanded={settingsOpen}
    onClick={() => setSettingsOpen(true)}
  ><SettingsIcon className='h-5 w-5' /></button>;

  const runtimeButton = (floating = false) => runtimeAvailable ? <button
    type='button'
    data-flexdoc-floating-control={floating ? 'runtime' : undefined}
    className={floating
      ? `fixed bottom-4 right-[4.25rem] z-40 inline-flex h-11 w-11 items-center justify-center rounded-full border shadow-lg ${floatingButtonTheme}`
      : 'inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-md border px-2 text-sm sm:px-3'}
    onClick={() => setRuntimeOpen(true)}
    aria-label={messages?.openRuntime || 'Open runtime intelligence'}
    aria-expanded={runtimeOpen}
  ><Activity className='h-4 w-4' />{!floating && <span className='hidden sm:inline'>{runtimeSnapshot ? `Runtime ${runtimeSnapshot.summary.matched}/${runtimeSnapshot.summary.documented}` : runtimeLoading ? 'Runtime…' : 'Runtime'}</span>}</button> : null;

  const mobileNavButton = (floating = false) => <button
    ref={mobileNavTriggerRef}
    type='button'
    data-flexdoc-floating-control={floating ? 'navigation' : undefined}
    data-flexdoc-mobile-nav-trigger={floating ? 'floating' : 'topbar'}
    className={floating
      ? `fixed left-4 top-4 z-[65] pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-full border shadow-lg lg:hidden ${floatingButtonTheme}`
      : 'inline-flex h-11 w-11 items-center justify-center rounded-md lg:hidden'}
    aria-label={messages?.apiNavigation || 'Open API navigation'}
    aria-expanded={mobileNavOpen}
    onClick={() => setMobileNavOpen(true)}
  ><Menu className='h-5 w-5' /></button>;

  const sidebar = <Sidebar
    spec={spec}
    onEndpointSelect={handleEndpointSelect}
    theme={effectiveTheme}
    selectedEndpoint={selectedEndpoint || undefined}
    expandedTags={expandedTags}
    onExpandedTagsChange={handleExpandedTagsChange}
    messages={messages}
  />;

  return (
    <div lang={options.locale} className={`flexdoc-root flex h-full min-h-0 flex-col ${rootClasses}`} style={mergedStyles} data-theme={effectiveThemeChoice} data-flexdoc-view={activeView}>
      {!options.hideTopbar && (
        <header className={`z-30 flex flex-wrap min-h-14 shrink-0 items-center gap-3 border-b px-3 sm:px-5 ${effectiveTheme === 'dark' ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-white'}`}>
          {activeView === 'api-client' ? <>
            <button type='button' className='inline-flex min-h-11 items-center gap-2 rounded-md border px-3 text-sm' onClick={backToOperation}><ArrowLeft className='h-4 w-4' />{messages?.backToOperation || 'Back to operation'}</button>
            <div className='min-w-0 flex-1 truncate font-semibold'>{messages?.apiClient || 'API Client'}</div>
            <label className='flex shrink-0 items-center gap-1 text-xs sm:gap-2'>
              <span className='sr-only'>{messages?.environment || 'Environment'}</span>
              <select
                aria-label={messages?.environment || 'API Client environment'}
                style={{ maxWidth: '10rem' }}
                className={`rounded-md border px-2 py-1.5 text-xs ${effectiveTheme === 'dark' ? 'border-gray-700 bg-gray-900' : 'border-gray-300 bg-white'}`}
                value={requestedApiClientEnvironmentId ?? apiClientChrome.activeEnvironmentId ?? ''}
                onChange={(event) => setRequestedApiClientEnvironmentId(event.target.value || null)}
              >
                <option value=''>{messages?.noEnvironment || 'No environment'}</option>
                {apiClientChrome.environments.map((environment) => <option key={environment.id} value={environment.id}>{environment.name}</option>)}
              </select>
            </label>
            {apiClientChrome.hasUnsavedRequest && <span className='shrink-0 text-xs font-medium' aria-label={messages?.unsavedChanges || 'Unsaved request changes'}>{messages?.unsavedChanges || 'Unsaved changes'}</span>}
            {settingsButton()}
          </> : <>
            {mobileNavButton()}
            <button type='button' className='hidden h-11 w-11 items-center justify-center rounded-md border lg:inline-flex' aria-label={desktopSidebarCollapsed ? 'Expand API navigation sidebar' : 'Collapse API navigation sidebar'} aria-expanded={!desktopSidebarCollapsed} onClick={toggleDesktopSidebar}>{desktopSidebarCollapsed ? <PanelLeftOpen className='h-5 w-5' /> : <PanelLeftClose className='h-5 w-5' />}</button>
            {options.logo && <Logo logo={options.logo} onHome={handleHome} />}
            <div className='min-w-0 flex-1'>
              <div className='truncate font-semibold'>{spec.info.title}</div>
              {!options.hideHostname && spec.servers?.[0]?.url && <div className='truncate text-xs opacity-60'>{spec.servers[0].url}</div>}
            </div>
            {runtimeButton()}
            {selectedEndpoint && <button type='button' className='hidden shrink-0 rounded-md border px-3 py-2 text-sm md:inline-flex' aria-label={messages?.printOperation || 'Print operation'} onClick={() => { if (typeof window !== 'undefined') window.print(); }}>{messages?.printOperation || 'Print operation'}</button>}
            {!options.hideDownloadButton && <div className='flex shrink-0 items-center gap-1' aria-label='Download OpenAPI specification'>
              <button type='button' className='rounded-md border px-2 py-2 text-xs sm:px-3 sm:text-sm' onClick={() => setDownloadError(downloadSpec(spec, 'json'))}>JSON</button>
              <button type='button' className='rounded-md border px-2 py-2 text-xs sm:px-3 sm:text-sm' onClick={() => setDownloadError(downloadSpec(spec, 'yaml'))}>YAML</button>
            </div>}
            {settingsButton()}
          </>}
        </header>
      )}

      {options.hideTopbar && activeView === 'docs' && mobileNavButton(true)}
      {options.hideTopbar && activeView === 'docs' && runtimeButton(true)}
      {options.hideTopbar && settingsButton(true)}
      {options.hideTopbar && activeView === 'docs' && <button type='button' data-flexdoc-floating-control='desktop-navigation' className={`fixed left-4 top-4 z-40 hidden h-11 w-11 items-center justify-center rounded-full border shadow-lg lg:inline-flex ${floatingButtonTheme}`} aria-label={desktopSidebarCollapsed ? 'Expand API navigation sidebar' : 'Collapse API navigation sidebar'} aria-expanded={!desktopSidebarCollapsed} onClick={toggleDesktopSidebar}>{desktopSidebarCollapsed ? <PanelLeftOpen className='h-5 w-5' /> : <PanelLeftClose className='h-5 w-5' />}</button>}
      {options.hideTopbar && activeView === 'api-client' && <>
        <button type='button' data-flexdoc-floating-control='api-client-back' className={`fixed left-4 top-4 z-[65] inline-flex min-h-11 items-center gap-2 rounded-full border px-3 shadow-lg ${floatingButtonTheme}`} onClick={backToOperation}><ArrowLeft className='h-4 w-4' />{messages?.backToOperation || 'Back'}</button>
        <div data-flexdoc-floating-control='api-client-status' className={`fixed right-4 top-4 z-[65] flex items-center gap-2 rounded-full border px-2 py-1.5 shadow-lg ${floatingButtonTheme}`} style={{ maxWidth: 'calc(100vw - 8rem)' }}>
          <label className='flex min-w-0 items-center gap-1 text-xs'>
            <span className='sr-only'>{messages?.environment || 'Environment'}</span>
            <select aria-label={messages?.environment || 'API Client environment'} style={{ maxWidth: '8rem' }} className={`rounded-md border px-2 py-1 text-xs ${effectiveTheme === 'dark' ? 'border-gray-700 bg-gray-900' : 'border-gray-300 bg-white'}`} value={requestedApiClientEnvironmentId ?? apiClientChrome.activeEnvironmentId ?? ''} onChange={(event) => setRequestedApiClientEnvironmentId(event.target.value || null)}>
              <option value=''>{messages?.noEnvironment || 'No environment'}</option>
              {apiClientChrome.environments.map((environment) => <option key={environment.id} value={environment.id}>{environment.name}</option>)}
            </select>
          </label>
          {apiClientChrome.hasUnsavedRequest && <span className='truncate text-xs font-medium' aria-label={messages?.unsavedChanges || 'Unsaved request changes'}>{messages?.unsavedChanges || 'Unsaved changes'}</span>}
        </div>
      </>}

      <div className='relative flex min-h-0 flex-1 overflow-hidden'>
        <div data-flexdoc-docs-view='docs' className={`${activeView === 'docs' ? 'flex' : 'hidden'} min-h-0 min-w-0 flex-1`}>
          <aside className={`hidden min-h-0 shrink-0 overflow-hidden transition-[width] duration-200 motion-reduce:transition-none lg:block ${desktopSidebarCollapsed ? 'w-14' : 'w-80'}`} data-docs-sidebar data-collapsed={desktopSidebarCollapsed ? 'true' : 'false'} style={{ background: 'var(--flexdoc-sidebar-bg)', color: 'var(--flexdoc-sidebar-text)' }}>
            {!desktopSidebarCollapsed && sidebar}
          </aside>

          <main ref={mainScrollRef} data-flexdoc-main-scroll className='min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain'>
            {selectedEndpoint ? (
              <EndpointDetail
                spec={spec}
                path={selectedEndpoint.path}
                method={selectedEndpoint.method}
                theme={effectiveTheme}
                options={options}
                defaultExpandedSections={defaultExpandedSections}
                runtimeSnapshot={runtimeSnapshot}
                onOpenInApiClient={openApiClient}
              />
            ) : (
              <Overview spec={spec} onEndpointSelect={handleEndpointSelect} theme={effectiveTheme} />
            )}
            <Footer footerClasses={footerClasses} footer={options.footer} />
          </main>
        </div>

        {apiClientVisited && <div data-api-client-page='api-client' className={`${activeView === 'api-client' ? 'block' : 'hidden'} min-h-0 min-w-0 flex-1 overflow-hidden`}>
          <ApiClientWorkspace
            pageMode
            manageTheme={false}
            theme={effectiveTheme}
            messages={messages}
            persistenceKey={apiClientPersistenceKey}
            handoff={apiClientHandoff}
            activeEnvironmentId={requestedApiClientEnvironmentId}
            onActiveEnvironmentIdChange={(environmentId) => setRequestedApiClientEnvironmentId(environmentId ?? null)}
            onChromeStateChange={(state) => {
              setApiClientChrome(state);
              setRequestedApiClientEnvironmentId((current) => current === undefined ? state.activeEnvironmentId ?? null : current);
            }}
            credentials={options.tryIt?.credentials || 'same-origin'}
            requestInterceptor={options.tryIt?.requestInterceptor}
            hostExecution={options.tryIt?.hostExecution}
            serverOptions={spec.servers || []}
          />
        </div>}
      </div>

      {mobileNavOpen && <div ref={mobileDialogRef} className='fixed inset-0 z-[70] lg:hidden' role='dialog' aria-modal='true' aria-label={messages?.apiNavigation || 'API navigation'}>
        <button type='button' tabIndex={-1} data-focus-trap-ignore aria-label='Close navigation backdrop' className='absolute inset-0 bg-black/40' onClick={() => setMobileNavOpen(false)} />
        <aside className={`absolute inset-y-0 left-0 flex w-[min(88vw,22rem)] flex-col shadow-2xl ${effectiveTheme === 'dark' ? 'bg-gray-900' : 'bg-white'}`}>
          <div className='flex h-14 items-center justify-between border-b px-4'>
            <span className='font-semibold'>{messages?.apiNavigation || 'API navigation'}</span>
            <button type='button' className='inline-flex h-11 w-11 items-center justify-center rounded-md' aria-label={messages?.closeApiNavigation || 'Close API navigation'} onClick={() => setMobileNavOpen(false)}><X className='h-5 w-5' /></button>
          </div>
          <div className='min-h-0 flex-1 overflow-y-auto'>{sidebar}</div>
        </aside>
      </div>}

      {downloadError && <div role='alert' className={`fixed bottom-4 left-1/2 z-[90] max-w-[min(92vw,40rem)] -translate-x-1/2 rounded-lg border px-4 py-3 text-sm shadow-xl ${effectiveTheme === 'dark' ? 'border-red-800 bg-red-950 text-red-100' : 'border-red-300 bg-white text-red-700'}`} onClick={() => setDownloadError(undefined)}>{messages?.downloadFailed || downloadError}</div>}

      <RuntimeIntelligencePanel open={runtimeOpen && runtimeAvailable} theme={effectiveTheme} loading={runtimeLoading} error={runtimeError} snapshot={runtimeSnapshot} onClose={closeRuntime} onEndpointSelect={handleEndpointSelect} messages={messages} />
      <FlexDocCommandPalette
        spec={spec}
        theme={effectiveTheme}
        messages={messages}
        onEndpointSelect={handleEndpointSelect}
        onHome={handleHome}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenApiClient={() => openApiClient()}
        onOpenRuntime={runtimeAvailable ? () => setRuntimeOpen(true) : undefined}
        onSendCurrent={sendCurrentRequest}
      />
      <FlexDocSettings
        open={settingsOpen}
        theme={effectiveTheme}
        hostTheme={theme}
        viewerTheme={viewerPreferences.theme}
        viewerExpand={viewerExpand}
        effectiveExpandedSections={defaultExpandedSections}
        messages={messages}
        onThemeChange={handleViewerThemeChange}
        onExpandChange={handleViewerExpandChange}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
};
