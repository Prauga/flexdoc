import React, { useEffect, useRef } from 'react';
import { Activity, AlertTriangle, CheckCircle2, X } from 'lucide-react';
import type { FlexDocMessages, FlexDocRuntimeIntelligenceSnapshot } from '../types/options';

interface Props {
  open: boolean;
  theme: 'light' | 'dark';
  loading: boolean;
  error?: string;
  snapshot?: FlexDocRuntimeIntelligenceSnapshot;
  onClose: () => void;
  onEndpointSelect?: (path: string, method: string) => void;
  messages?: FlexDocMessages;
}

function focusableElements(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(
    'button:not([disabled]), select:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
  )).filter((element) => element.getAttribute('aria-hidden') !== 'true');
}

export const RuntimeIntelligencePanel: React.FC<Props> = ({ open, theme, loading, error, snapshot, onClose, onEndpointSelect, messages }) => {
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open || typeof document === 'undefined') return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;

      const focusable = focusableElements(dialogRef.current);
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !dialogRef.current.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !dialogRef.current.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [open, onClose]);

  if (!open) return null;
  const dark = theme === 'dark';
  const surface = dark ? 'border-gray-700 bg-gray-900 text-gray-100' : 'border-gray-200 bg-white text-gray-900';
  const muted = dark ? 'text-gray-400' : 'text-gray-600';
  const errorClasses = dark ? 'border-red-800 bg-red-950/50 text-red-200' : 'border-red-300 bg-red-50 text-red-800';
  const warningClasses = dark ? 'border-amber-700 bg-amber-950/50 text-amber-200' : 'border-amber-300 bg-amber-50 text-amber-900';
  const successClasses = dark ? 'text-green-300' : 'text-green-700';

  return <div className='fixed inset-0 z-50'>
    <button tabIndex={-1} className='absolute inset-0 bg-black/40' aria-label={messages?.closeRuntimeIntelligence || 'Close runtime intelligence'} onClick={onClose} />
    <section
      ref={dialogRef}
      role='dialog'
      aria-modal='true'
      aria-labelledby='runtime-intelligence-heading'
      tabIndex={-1}
      className={`absolute inset-y-0 right-0 w-[min(92vw,32rem)] overflow-y-auto border-l p-5 shadow-2xl ${surface}`}
    >
      <div className='mb-5 flex items-start justify-between gap-4'>
        <div><div id='runtime-intelligence-heading' className='flex items-center gap-2 text-lg font-semibold'><Activity className='h-5 w-5' />{messages?.runtimeIntelligence || 'Runtime intelligence'}</div><p className={`mt-1 text-sm ${muted}`}>{messages?.runtimeIntelligenceDescription || 'Live route presence from the backend hosting this documentation.'}</p></div>
        <button ref={closeButtonRef} className='inline-flex h-10 w-10 items-center justify-center rounded-md border' aria-label={messages?.closeRuntimeIntelligencePanel || 'Close runtime intelligence panel'} onClick={onClose}><X className='h-4 w-4' /></button>
      </div>
      {loading && <p className={muted}>{messages?.inspectingRuntimeRoutes || 'Inspecting runtime routes…'}</p>}
      {error && <div role='alert' className={`rounded-lg border p-3 text-sm ${errorClasses}`}>{error}</div>}
      {snapshot && <div className='space-y-5'>
        <div className='grid grid-cols-2 gap-3 text-sm'>
          <div className='rounded-lg border p-3'><div className={muted}>{messages?.framework || 'Framework'}</div><div className='font-semibold'>{snapshot.framework}{snapshot.frameworkVersion ? ` ${snapshot.frameworkVersion}` : ''}</div></div>
          <div className='rounded-lg border p-3'><div className={muted}>{messages?.matched || 'Matched'}</div><div className='font-semibold'>{snapshot.summary.matched} / {snapshot.summary.documented}</div></div>
          <div className='col-span-2 rounded-lg border p-3'><div className={muted}>{messages?.runtime || 'Runtime'}</div><div className='font-semibold'>{snapshot.runtime.name} {snapshot.runtime.version}</div><div className={`mt-1 text-xs ${muted}`}>{snapshot.runtime.platform} · {snapshot.runtime.arch}</div></div>
          {(snapshot.serverOrigin || snapshot.server?.localPort) && <div className='col-span-2 rounded-lg border p-3'><div className={muted}>{messages?.runtimeServer || 'Runtime server'}</div>{snapshot.serverOrigin && <code className='block break-all text-xs'>{snapshot.serverOrigin}</code>}{snapshot.server?.localPort && <div className={`mt-1 text-xs ${muted}`}>{messages?.backendListenerPort || 'Backend listener port'} {snapshot.server.localPort}</div>}</div>}
          {snapshot.environment?.name && <div className='col-span-2 rounded-lg border p-3'><div className={muted}>{messages?.environment || 'Environment'}</div><div className='font-semibold'>{snapshot.environment.name}</div></div>}
        </div>
        {!snapshot.discoveryComplete && <div className={`flex gap-2 rounded-lg border p-3 text-sm ${warningClasses}`}><AlertTriangle className='mt-0.5 h-4 w-4 shrink-0' />{messages?.routeDiscoveryPartial || 'Route discovery is partial; documented routes not observed at runtime may be false positives.'}</div>}
        <RouteList title={messages?.implementedButUndocumented || 'Implemented but undocumented'} routes={snapshot.runtimeOnly} empty={messages?.noUndocumentedRuntimeRoutes || 'No undocumented runtime routes discovered.'} theme={theme} warning openLabel={messages?.openRuntimeRoute || 'Open runtime route'} />
        <RouteList
          title={messages?.documentedButNotObserved || 'Documented but not observed'}
          routes={snapshot.documentedOnly}
          empty={messages?.everyDocumentedRouteObserved || 'Every documented route was observed.'}
          theme={theme}
          openLabel={messages?.openRuntimeRoute || 'Open runtime route'}
          onSelect={onEndpointSelect ? (route) => {
            onEndpointSelect(route.path, route.method);
            onClose();
          } : undefined}
        />
        {snapshot.summary.runtimeOnly === 0 && snapshot.summary.documentedOnly === 0 && snapshot.discoveryComplete && <div className={`flex items-center gap-2 text-sm ${successClasses}`}><CheckCircle2 className='h-4 w-4' />{messages?.runtimeAligned || 'Runtime routes and OpenAPI paths are aligned.'}</div>}
      </div>}
    </section>
  </div>;
};

function RouteList({ title, routes, empty, theme, warning = false, onSelect, openLabel = 'Open runtime route' }: { title: string; routes: Array<{method:string;path:string}>; empty: string; theme: 'light'|'dark'; warning?: boolean; onSelect?: (route: { method: string; path: string }) => void; openLabel?: string }) {
  const dark = theme === 'dark';
  const muted = dark ? 'text-gray-400' : 'text-gray-600';
  const warningBorder = warning ? (dark ? 'border-amber-700' : 'border-amber-300') : '';
  return <section><h3 className='mb-2 font-semibold'>{title} <span className={muted}>({routes.length})</span></h3>{routes.length ? <div className='space-y-2'>{routes.map((route) => onSelect ? <button type='button' key={`${route.method}:${route.path}`} aria-label={`${openLabel} ${route.method} ${route.path}`} className={`flex w-full gap-2 rounded border p-2 text-left text-sm transition hover:border-blue-500 hover:bg-blue-500/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${warningBorder}`} onClick={() => onSelect(route)}><span className='w-14 shrink-0 font-semibold'>{route.method}</span><code className='break-all'>{route.path}</code></button> : <div key={`${route.method}:${route.path}`} className={`flex gap-2 rounded border p-2 text-sm ${warningBorder}`}><span className='w-14 shrink-0 font-semibold'>{route.method}</span><code className='break-all'>{route.path}</code></div>)}</div> : <p className={`text-sm ${muted}`}>{empty}</p>}</section>;
}
