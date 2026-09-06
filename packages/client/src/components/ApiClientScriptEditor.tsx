import React, { useMemo, useRef, useState } from 'react';
import {
  apiClientScriptCompletionsAtPosition,
} from '../utils/api-client-script-intellisense';
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
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [completion, setCompletion] = useState<ApiClientScriptCompletionContext | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listId = useMemo(() => `api-client-script-completions-${ariaLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, [ariaLabel]);
  const dark = theme === 'dark';

  const refreshCompletion = (source: string, position: number, explicit = false) => {
    const next = apiClientScriptCompletionsAtPosition(source, position, phase, variableKeys, explicit);
    setCompletion(next);
    setSelectedIndex(0);
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
  const textareaClass = dark
    ? 'w-full min-h-40 max-h-96 resize-y rounded-md border border-gray-700 bg-gray-900 px-3 py-2 font-mono text-xs text-gray-100 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400'
    : 'w-full min-h-40 max-h-96 resize-y rounded-md border border-gray-300 bg-white px-3 py-2 font-mono text-xs text-gray-900 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600';
  const popupClass = dark
    ? 'absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-gray-700 bg-gray-900 text-gray-100 shadow-xl'
    : 'absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-gray-200 bg-white text-gray-900 shadow-xl';

  return <div className='relative'>
    <textarea
      ref={textareaRef}
      aria-label={ariaLabel}
      aria-autocomplete='list'
      aria-controls={completion ? listId : undefined}
      aria-expanded={!!completion}
      aria-activedescendant={completion ? `${listId}-${selectedIndex}` : undefined}
      className={textareaClass}
      data-api-client-script-phase={phase}
      data-testid={`${ariaLabel}-editor`}
      onBlur={() => setCompletion(null)}
      onChange={(event) => {
        const nextValue = event.target.value;
        const position = event.target.selectionStart;
        onChange(nextValue);
        refreshCompletion(nextValue, position);
      }}
      onKeyDown={handleKeyDown}
      spellCheck={false}
      value={value}
    />
    {completion && completion.items.length > 0 && <div className={popupClass}>
      <div id={listId} role='listbox' className='max-h-52 overflow-y-auto py-1'>
        {completion.items.map((item, index) => <button
          aria-selected={index === selectedIndex}
          className={`flex w-full items-baseline gap-2 px-3 py-1.5 text-left text-xs ${index === selectedIndex ? (dark ? 'bg-blue-700 text-white' : 'bg-blue-50 text-gray-900') : (dark ? 'hover:bg-gray-800' : 'hover:bg-gray-50')}`}
          id={`${listId}-${index}`}
          key={`${item.kind}-${item.label}`}
          onMouseDown={(event) => {
            event.preventDefault();
            applyCompletion(item);
          }}
          role='option'
          type='button'
        >
          <span className='font-mono font-semibold'>{item.label}</span>
          <span className={`truncate ${index === selectedIndex && dark ? 'text-blue-100' : (dark ? 'text-gray-400' : 'text-gray-500')}`}>{item.signature || item.kind}</span>
        </button>)}
      </div>
      {selected && <div className={`border-t px-3 py-2 text-[11px] ${dark ? 'border-gray-700 text-gray-300' : 'border-gray-200 text-gray-600'}`}>
        {selected.signature && <div className='mb-1 font-mono text-xs'>{selected.signature}</div>}
        <div>{selected.documentation}</div>
      </div>}
    </div>}
    <div className={`mt-1 text-[11px] ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
      IntelliSense: type <code>flex.</code> or press Ctrl+Space. Use ↑/↓ and Enter or Tab to complete. Known variable names are suggested inside variable helpers.
    </div>
  </div>;
};
