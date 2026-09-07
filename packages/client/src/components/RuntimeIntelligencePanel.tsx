import React from 'react';
import { Activity, AlertTriangle, CheckCircle2, X } from 'lucide-react';
import type { FlexDocRuntimeIntelligenceSnapshot } from '../types/options';

interface Props {
  open: boolean;
  theme: 'light' | 'dark';
  loading: boolean;
  error?: string;
  snapshot?: FlexDocRuntimeIntelligenceSnapshot;
  onClose: () => void;
}

export const RuntimeIntelligencePanel: React.FC<Props> = ({ open, theme, loading, error, snapshot, onClose }) => {
  if (!open) return null;
  const surface = theme === 'dark' ? 'border-gray-700 bg-gray-900 text-gray-100' : 'border-gray-200 bg-white text-gray-900';
  const muted = theme === 'dark' ? 'text-gray-400' : 'text-gray-600';
  return <div className='fixed inset-0 z-50' role='dialog' aria-modal='true' aria-label='Runtime intelligence'>
    <button className='absolute inset-0 bg-black/40' aria-label='Close runtime intelligence' onClick={onClose} />
    <section className={`absolute inset-y-0 right-0 w-[min(92vw,32rem)] overflow-y-auto border-l p-5 shadow-2xl ${surface}`}>
      <div className='mb-5 flex items-start justify-between gap-4'>
        <div><div className='flex items-center gap-2 text-lg font-semibold'><Activity className='h-5 w-5' />Runtime intelligence</div><p className={`mt-1 text-sm ${muted}`}>Live route presence from the backend hosting this documentation.</p></div>
        <button className='inline-flex h-10 w-10 items-center justify-center rounded-md border' aria-label='Close runtime intelligence panel' onClick={onClose}><X className='h-4 w-4' /></button>
      </div>
      {loading && <p className={muted}>Inspecting runtime routes…</p>}
      {error && <div className='rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800'>{error}</div>}
      {snapshot && <div className='space-y-5'>
        <div className='grid grid-cols-2 gap-3 text-sm'>
          <div className='rounded-lg border p-3'><div className={muted}>Framework</div><div className='font-semibold'>{snapshot.framework}{snapshot.frameworkVersion ? ` ${snapshot.frameworkVersion}` : ''}</div></div>
          <div className='rounded-lg border p-3'><div className={muted}>Matched</div><div className='font-semibold'>{snapshot.summary.matched} / {snapshot.summary.documented}</div></div>
          <div className='col-span-2 rounded-lg border p-3'><div className={muted}>Runtime</div><div className='font-semibold'>{snapshot.runtime.name} {snapshot.runtime.version}</div><div className={`mt-1 text-xs ${muted}`}>{snapshot.runtime.platform} · {snapshot.runtime.arch}</div></div>
          {snapshot.serverOrigin && <div className='col-span-2 rounded-lg border p-3'><div className={muted}>Runtime server</div><code className='break-all text-xs'>{snapshot.serverOrigin}</code></div>}
        </div>
        {!snapshot.discoveryComplete && <div className='flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900'><AlertTriangle className='mt-0.5 h-4 w-4 shrink-0' />Route discovery is partial; documented routes not observed at runtime may be false positives.</div>}
        <RouteList title='Implemented but undocumented' routes={snapshot.runtimeOnly} empty='No undocumented runtime routes discovered.' theme={theme} warning />
        <RouteList title='Documented but not observed' routes={snapshot.documentedOnly} empty='Every documented route was observed.' theme={theme} />
        {snapshot.summary.runtimeOnly === 0 && snapshot.summary.documentedOnly === 0 && snapshot.discoveryComplete && <div className='flex items-center gap-2 text-sm text-green-700'><CheckCircle2 className='h-4 w-4' />Runtime routes and OpenAPI paths are aligned.</div>}
      </div>}
    </section>
  </div>;
};

function RouteList({ title, routes, empty, theme, warning = false }: { title: string; routes: Array<{method:string;path:string}>; empty: string; theme: 'light'|'dark'; warning?: boolean }) {
  const muted = theme === 'dark' ? 'text-gray-400' : 'text-gray-600';
  return <section><h3 className='mb-2 font-semibold'>{title} <span className={muted}>({routes.length})</span></h3>{routes.length ? <div className='space-y-2'>{routes.map((route) => <div key={`${route.method}:${route.path}`} className={`flex gap-2 rounded border p-2 text-sm ${warning ? 'border-amber-300' : ''}`}><span className='w-14 shrink-0 font-semibold'>{route.method}</span><code className='break-all'>{route.path}</code></div>)}</div> : <p className={`text-sm ${muted}`}>{empty}</p>}</section>;
}
