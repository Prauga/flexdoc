import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, WandSparkles } from 'lucide-react';
import { ApiClientCodeEditor } from './ApiClientCodeEditor';
import type { ApiClientCodeEditorHandle } from './ApiClientCodeEditor';
import { apiClientScriptDiagnostic, formatApiClientScriptSelection } from '../utils/api-client-script-format';
import { apiClientScriptCompletionsAtPosition } from '../utils/api-client-script-intellisense';
import type {
  ApiClientScriptCompletionContext,
  ApiClientScriptCompletionItem,
  ApiClientScriptPhase,
  ApiClientScriptVariableKeys,
} from '../utils/api-client-script-intellisense';

/** Props for the pre-request and test script editor with IntelliSense and formatting. */
export interface ApiClientScriptEditorProps {
  ariaLabel: string;
  value: string;
  onChange: (value: string) => void;
  phase: ApiClientScriptPhase;
  theme?: 'light' | 'dark';
  variableKeys?: ApiClientScriptVariableKeys;
}

/** Script editor for API Client pre-request and test phases. */
export const ApiClientScriptEditor: React.FC<ApiClientScriptEditorProps> = ({
  ariaLabel,
  value,
  onChange,
  phase,
  theme = 'light',
  variableKeys = {},
}) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<ApiClientCodeEditorHandle | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [completion, setCompletion] = useState<ApiClientScriptCompletionContext | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [popup, setPopup] = useState({ left: 12, top: 36 });
  const listId = useMemo(() => `api-client-script-completions-${ariaLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, [ariaLabel]);
  const diagnostic = useMemo(() => apiClientScriptDiagnostic(value), [value]);
  const dark = theme === 'dark';

  const updatePopup = (position: number) => {
    const editor = editorRef.current;
    const host = hostRef.current;
    if (!editor || !host) return;
    const caret = editor.coordsAtPos(position);
    if (!caret) return;
    const hostRect = host.getBoundingClientRect();
    const desiredLeft = caret.left - hostRect.left;
    const maxLeft = Math.max(8, hostRect.width - 430);
    const desiredTop = caret.bottom - hostRect.top + 2;
    const maxTop = Math.max(8, hostRect.height - 96);
    setPopup({
      left: Math.max(8, Math.min(desiredLeft, maxLeft)),
      top: Math.max(8, Math.min(desiredTop, maxTop)),
    });
  };

  const refreshCompletion = (source: string, position: number, explicit = false) => {
    const next = apiClientScriptCompletionsAtPosition(source, position, phase, variableKeys, explicit);
    setCompletion(next);
    setSelectedIndex(0);
    if (next) requestAnimationFrame(() => updatePopup(position));
  };

  const applyCompletion = (item: ApiClientScriptCompletionItem) => {
    if (!completion) return;
    const nextValue = `${value.slice(0, completion.from)}${item.label}${value.slice(completion.to)}`;
    const nextPosition = completion.from + item.label.length;
    onChange(nextValue);
    setCompletion(null);
    requestAnimationFrame(() => {
      editorRef.current?.setSelection(nextPosition);
    });
  };

  const formatCurrent = () => {
    if (!diagnostic.valid) return;
    const selection = editorRef.current?.getSelection() ?? { from: value.length, to: value.length };
    const formatted = formatApiClientScriptSelection(value, selection.from, selection.to);
    if (formatted.value !== value) onChange(formatted.value);
    setCompletion(null);
    requestAnimationFrame(() => {
      editorRef.current?.setSelection(formatted.selectionStart, formatted.selectionEnd);
    });
  };

  useEffect(() => {
    optionRefs.current[selectedIndex]?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const handleKeyDown = (event: KeyboardEvent) => {
    const position = editorRef.current?.getSelection().from ?? value.length;
    if ((event.ctrlKey || event.metaKey) && event.code === 'Space') {
      event.preventDefault();
      refreshCompletion(value, position, true);
      return;
    }
    if (event.shiftKey && event.altKey && event.code === 'KeyF') {
      event.preventDefault();
      formatCurrent();
      return;
    }
    if (!completion || completion.items.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedIndex((current) => (current + 1) % completion.items.length);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedIndex((current) => (current - 1 + completion.items.length) % completion.items.length);
      return;
    }
    if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault();
      applyCompletion(completion.items[selectedIndex]);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      setCompletion(null);
    }
  };

  const selected = completion?.items[selectedIndex];
  const completionOpen = !!completion && completion.items.length > 0;
  const popupClass = dark
    ? 'border-gray-700 bg-gray-900 text-gray-100 shadow-2xl'
    : 'border-gray-200 bg-white text-gray-900 shadow-2xl';

  return <div ref={hostRef} className='relative min-w-0' onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setCompletion(null);
  }}>
    <div className='mb-1 flex flex-wrap items-center justify-between gap-2'>
      <span role={diagnostic.valid ? 'status' : 'alert'} className={`inline-flex items-center gap-1 text-[11px] ${diagnostic.valid ? (dark ? 'text-emerald-300' : 'text-emerald-700') : (dark ? 'text-amber-300' : 'text-amber-700')}`}>
        {diagnostic.valid ? <CheckCircle2 className='h-3.5 w-3.5' /> : <AlertTriangle className='h-3.5 w-3.5' />}
        <span className='max-w-[24rem] truncate'>{diagnostic.message}</span>
      </span>
      <button type='button' className='inline-flex min-h-9 items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50' disabled={!diagnostic.valid || !value.trim()} onMouseDown={(event) => event.preventDefault()} onClick={formatCurrent} aria-label='Format current script'>
        <WandSparkles className='h-3.5 w-3.5' />Format
      </button>
    </div>
    <ApiClientCodeEditor
      ref={editorRef}
      ariaActiveDescendant={completionOpen ? `${listId}-${selectedIndex}` : undefined}
      ariaAutocomplete='list'
      ariaControls={completionOpen ? listId : undefined}
      ariaExpanded={completionOpen}
      ariaLabel={ariaLabel}
      autoIndent
      dataTestId={`${ariaLabel}-editor`}
      language='javascript'
      onChange={(nextValue) => {
        const position = editorRef.current?.getSelection().from ?? nextValue.length;
        onChange(nextValue);
        requestAnimationFrame(() => {
          const currentPosition = editorRef.current?.getSelection().from ?? position;
          refreshCompletion(nextValue, currentPosition);
        });
      }}
      onCursorChange={(position) => {
        if (completion) updatePopup(position);
      }}
      onEditorKeyDown={handleKeyDown}
      theme={theme}
      value={value}
      wrap
    />
    {completionOpen && <div
      className={`absolute z-[70] w-[min(26rem,calc(100%-1rem))] overflow-hidden rounded-md border ${popupClass}`}
      data-testid={`${ariaLabel}-completion-popup`}
      style={{ left: popup.left, top: popup.top }}
    >
      <div id={listId} role='listbox' aria-label='Script suggestions' className='max-h-56 overflow-y-auto py-1'>
        {completion.items.map((item, index) => <button
          ref={(node) => { optionRefs.current[index] = node; }}
          aria-label={item.label}
          aria-selected={index === selectedIndex}
          className={`flex w-full items-baseline gap-2 px-3 py-1.5 text-left text-xs ${index === selectedIndex ? (dark ? 'bg-blue-700 text-white' : 'bg-blue-50 text-gray-900') : (dark ? 'hover:bg-gray-800' : 'hover:bg-gray-50')}`}
          id={`${listId}-${index}`}
          key={`${item.kind}-${item.label}`}
          onMouseEnter={() => setSelectedIndex(index)}
          onMouseDown={(event) => {
            event.preventDefault();
            applyCompletion(item);
          }}
          role='option'
          type='button'
        >
          <span aria-hidden='true' className='shrink-0 rounded bg-black/5 px-1 font-mono text-[10px] uppercase opacity-60 dark:bg-white/10'>{item.kind}</span>
          <span className='font-mono font-semibold'>{item.label}</span>
          <span aria-hidden='true' className={`min-w-0 truncate ${index === selectedIndex && dark ? 'text-blue-100' : (dark ? 'text-gray-400' : 'text-gray-500')}`}>{item.signature || ''}</span>
        </button>)}
      </div>
      {selected && <div className={`border-t px-3 py-2 text-[11px] ${dark ? 'border-gray-700 text-gray-300' : 'border-gray-200 text-gray-600'}`}>
        {selected.signature && <div className='mb-1 overflow-x-auto whitespace-nowrap font-mono text-xs'>{selected.signature}</div>}
        <div>{selected.documentation}</div>
      </div>}
    </div>}
    <div className={`mt-1 flex flex-wrap gap-x-3 text-[11px] ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
      <span><code>flex.</code> or Ctrl+Space</span><span>Enter keeps indentation</span><span>↑/↓ choose</span><span>Enter/Tab complete</span><span>Shift+Alt+F format</span>
    </div>
  </div>;
};
