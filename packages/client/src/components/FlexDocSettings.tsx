import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type { ExpandOption, ExpandSection } from '../types/options';
import { EXPAND_SECTIONS } from '../utils/renderer-preferences';

interface FlexDocSettingsProps {
  open: boolean;
  theme: 'light' | 'dark';
  viewerExpand?: ExpandOption;
  effectiveExpandedSections: ExpandSection[];
  onExpandChange: (expand?: ExpandOption) => void;
  onClose: () => void;
}

const LABELS: Record<ExpandSection, string> = {
  parameters: 'Parameters',
  requestBody: 'Request body',
  responses: 'Responses',
  tryIt: 'Try It',
  codeSamples: 'Code examples',
};

function modeFor(expand?: ExpandOption): string {
  if (expand === undefined) return 'host';
  if (Array.isArray(expand)) return 'custom';
  return expand === 'none' ? 'minimal' : expand;
}

function focusableElements(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(
    'button:not([disabled]), select:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
  )).filter((element) => element.getAttribute('aria-hidden') !== 'true');
}

export const FlexDocSettings: React.FC<FlexDocSettingsProps> = ({
  open,
  theme,
  viewerExpand,
  effectiveExpandedSections,
  onExpandChange,
  onClose,
}) => {
  const dialogRef = useRef<HTMLElement>(null);
  const expansionSelectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (!open || typeof document === 'undefined') return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    expansionSelectRef.current?.focus();

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
      document.removeEventListener('keydown', onKeyDown);
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [open, onClose]);

  if (!open) return null;
  const dark = theme === 'dark';
  const panel = dark ? 'border-gray-700 bg-gray-900 text-gray-100' : 'border-gray-200 bg-white text-gray-900';
  const field = dark ? 'border-gray-700 bg-gray-800 text-gray-100' : 'border-gray-300 bg-white text-gray-900';
  const customSections = Array.isArray(viewerExpand) ? viewerExpand.filter((entry): entry is ExpandSection => EXPAND_SECTIONS.includes(entry as ExpandSection)) : [];

  return <div className='fixed inset-0 z-[70]'>
    <button aria-label='Close settings backdrop' className='absolute inset-0 bg-black/40' onClick={onClose} />
    <aside
      ref={dialogRef}
      role='dialog'
      aria-modal='true'
      aria-label='Viewer settings'
      tabIndex={-1}
      className={`absolute inset-y-0 right-0 flex w-[min(92vw,24rem)] flex-col border-l shadow-2xl ${panel}`}
    >
      <div className='flex min-h-14 items-center justify-between border-b px-4'>
        <div>
          <div className='font-semibold'>Settings</div>
          <div className='text-xs opacity-65'>Preferences are saved for this documentation.</div>
        </div>
        <button type='button' aria-label='Close settings' className='inline-flex h-11 w-11 items-center justify-center rounded-md' onClick={onClose}><X className='h-5 w-5' /></button>
      </div>
      <div className='flex-1 overflow-y-auto p-4'>
        <section aria-labelledby='expansion-settings-heading'>
          <h2 id='expansion-settings-heading' className='mb-1 text-sm font-semibold'>Default expanded sections</h2>
          <p className='mb-3 text-xs opacity-65'>This preference overrides the documentation author's default. Opening or closing a section manually remains temporary.</p>
          <select
            ref={expansionSelectRef}
            aria-label='Default expanded sections'
            className={`w-full rounded-md border px-3 py-2 text-sm ${field}`}
            value={modeFor(viewerExpand)}
            onChange={(event) => {
              const value = event.target.value;
              if (value === 'host') onExpandChange(undefined);
              else if (value === 'custom') onExpandChange([...effectiveExpandedSections]);
              else onExpandChange(value as ExpandOption);
            }}
          >
            <option value='host'>Use documentation default</option>
            <option value='minimal'>Minimal</option>
            <option value='documentation'>Documentation</option>
            <option value='interactive'>Interactive</option>
            <option value='all'>All sections</option>
            <option value='custom'>Custom sections</option>
          </select>

          {Array.isArray(viewerExpand) && <fieldset className='mt-4 space-y-2'>
            <legend className='mb-2 text-xs font-medium uppercase tracking-wide opacity-65'>Custom sections</legend>
            {EXPAND_SECTIONS.map((section) => <label key={section} className='flex min-h-9 items-center gap-2 text-sm'>
              <input
                type='checkbox'
                checked={customSections.includes(section)}
                onChange={(event) => {
                  const next = new Set(customSections);
                  if (event.target.checked) next.add(section);
                  else next.delete(section);
                  onExpandChange(EXPAND_SECTIONS.filter((candidate) => next.has(candidate)));
                }}
              />
              {LABELS[section]}
            </label>)}
          </fieldset>}

          {viewerExpand !== undefined && <button type='button' className='mt-5 rounded-md border px-3 py-2 text-sm' onClick={() => onExpandChange(undefined)}>Reset to documentation defaults</button>}
        </section>
      </div>
    </aside>
  </div>;
};
