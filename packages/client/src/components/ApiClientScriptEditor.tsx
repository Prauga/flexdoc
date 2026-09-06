import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ApiClientCodeEditor } from './ApiClientCodeEditor';
import { apiClientEditorCaretPosition } from '../utils/api-client-editor-caret';
import { apiClientScriptCompletionsAtPosition } from '../utils/api-client-script-intellisense';
import type {
  ApiClientScriptCompletionContext,
  ApiClientScriptCompletionItem,
  ApiClientScriptPhase,
  ApiClientScriptVariableKeys,
} from '../utils/api-client-script-intellisense';

export interface ApiClientScriptEditorProps {
  ariaLabel: string;
  value: string;
  onChange: (value: string) => void;
  phase: ApiClientScriptPhase;
  theme?: 'light' | 'dark';
  variableKeys?: ApiClientScriptVariableKeys;
}

export const ApiClientScriptEditor: React.FC<ApiClientScriptEditorProps> = ({
  ariaLabel,
  value,
  onChange,
  phase,
  theme = 'light',
  variableKeys = {},
}) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [completion, setCompletion] = useState<ApiClientScriptCompletionContext | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [popup, setPopup] = useState({ left: 12, top: 36 });
  const listId = useMemo(() => `api-client-script-completions-${ariaLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, [ariaLabel]);
  const dark = theme === 'dark';

  const updatePopup = (position: number) => {
    const textarea = textareaRef.current;
    const host = hostRef.current;
    if (!textarea || !host) return;
    const caret = apiClientEditorCaretPosition(textarea, position);
    const hostRect = host.getBoundingClientRect();
    const desiredLeft = caret.left - hostRect.left;
    const maxLeft = Math.max(8, hostRect.width - 430);
    setPopup({
      left: Math.max(8, Math.min(desiredLeft, maxLeft)),
      top: Math.max(8, caret.bottom - hostRect.top + 2),
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
      const textarea = textareaRef.current;
      if (!textarea) return;
      textarea.focus();
      textarea.setSelectionRange(nextPosition, nextPosition);
    });
  };

  useEffect(() => {
    optionRefs.current[selectedIndex]?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = event.currentTarget;
    if ((event.ctrlKey || event.metaKey) && event.code === 'Space') {
      event.preventDefault();
      refreshCompletion(value, textarea.selectionStart, true);
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
    if (event.key === 'Home') {
      event.preventDefault();
      setSelectedIndex(0);
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      setSelectedIndex(completion.items.length - 1);
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
  const popupClass = dark
    ? 'border-gray-700 bg-gray-900 text-gray-100 shadow-2xl'
    : 'border-gray-200 bg-white text-gray-900 shadow-2xl';

  return <div ref={hostRef} className='relative' onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setCompletion(null);
  }}>
    <ApiClientCodeEditor
      ref={textareaRef}
      ariaLabel={ariaLabel}
      dataTestId={`${ariaLabel}-editor`}
      language='javascript'
      onChange={(nextValue) => {
        const textarea = textareaRef.current;
        const position = textarea?.selectionStart ?? nextValue.length;
        onChange(nextValue);
        requestAnimationFrame(() => {
          const current = textareaRef.current;
          refreshCompletion(nextValue, current?.selectionStart ?? position);
        });
      }}
      onCursorChange={(position) => {
        if (completion) updatePopup(position);
      }}
      onEditorKeyDown={handleKeyDown}
      theme={theme}
      value={value}
    />
    {completion && completion.items.length > 0 && <div
      className={`absolute z-[70] w-[min(26rem,calc(100%-1rem))] overflow-hidden rounded-md border ${popupClass}`}
      data-testid={`${ariaLabel}-completion-popup`}
      style={{ left: popup.left, top: popup.top }}
    >
      <div id={listId} role='listbox' className='max-h-56 overflow-y-auto py-1'>
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
      <span><code>flex.</code> or Ctrl+Space</span><span>↑/↓ choose</span><span>Enter/Tab complete</span><span>Esc dismiss</span><span>Tab indents when suggestions are closed</span>
    </div>
  </div>;
};
