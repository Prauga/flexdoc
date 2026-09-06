import React, { forwardRef, useMemo, useRef, useState } from 'react';
import Prism from 'prismjs';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-markup';
import 'prismjs/components/prism-graphql';

export type ApiClientCodeLanguage = 'javascript' | 'json' | 'text' | 'xml' | 'html' | 'graphql';

export interface ApiClientCodeEditorProps {
  ariaLabel: string;
  value: string;
  onChange: (value: string) => void;
  language?: ApiClientCodeLanguage;
  theme?: 'light' | 'dark';
  minLines?: number;
  maxLines?: number;
  dataTestId?: string;
  onEditorKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onCursorChange?: (position: number) => void;
}

const TOKEN_STYLE = `
.api-client-code-editor .token.comment,.api-client-code-editor .token.prolog,.api-client-code-editor .token.doctype,.api-client-code-editor .token.cdata{color:#6b7280}
.api-client-code-editor.light .token.punctuation{color:#4b5563}.api-client-code-editor.dark .token.punctuation{color:#d1d5db}
.api-client-code-editor.light .token.property,.api-client-code-editor.light .token.tag,.api-client-code-editor.light .token.boolean,.api-client-code-editor.light .token.number,.api-client-code-editor.light .token.constant,.api-client-code-editor.light .token.symbol{color:#b91c1c}
.api-client-code-editor.dark .token.property,.api-client-code-editor.dark .token.tag,.api-client-code-editor.dark .token.boolean,.api-client-code-editor.dark .token.number,.api-client-code-editor.dark .token.constant,.api-client-code-editor.dark .token.symbol{color:#fca5a5}
.api-client-code-editor.light .token.selector,.api-client-code-editor.light .token.attr-name,.api-client-code-editor.light .token.string,.api-client-code-editor.light .token.char,.api-client-code-editor.light .token.builtin,.api-client-code-editor.light .token.inserted{color:#047857}
.api-client-code-editor.dark .token.selector,.api-client-code-editor.dark .token.attr-name,.api-client-code-editor.dark .token.string,.api-client-code-editor.dark .token.char,.api-client-code-editor.dark .token.builtin,.api-client-code-editor.dark .token.inserted{color:#6ee7b7}
.api-client-code-editor.light .token.operator,.api-client-code-editor.light .token.entity,.api-client-code-editor.light .token.url,.api-client-code-editor.light .token.variable{color:#92400e}
.api-client-code-editor.dark .token.operator,.api-client-code-editor.dark .token.entity,.api-client-code-editor.dark .token.url,.api-client-code-editor.dark .token.variable{color:#fcd34d}
.api-client-code-editor.light .token.atrule,.api-client-code-editor.light .token.attr-value,.api-client-code-editor.light .token.function,.api-client-code-editor.light .token.class-name{color:#1d4ed8}
.api-client-code-editor.dark .token.atrule,.api-client-code-editor.dark .token.attr-value,.api-client-code-editor.dark .token.function,.api-client-code-editor.dark .token.class-name{color:#93c5fd}
.api-client-code-editor.light .token.keyword{color:#7e22ce}.api-client-code-editor.dark .token.keyword{color:#d8b4fe}
.api-client-code-editor.light .token.regex,.api-client-code-editor.light .token.important{color:#c2410c}.api-client-code-editor.dark .token.regex,.api-client-code-editor.dark .token.important{color:#fdba74}
`;

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function prismLanguage(language: ApiClientCodeLanguage): { grammar?: Prism.Grammar; name: string } {
  if (language === 'text') return { name: 'text' };
  if (language === 'xml' || language === 'html') return { grammar: Prism.languages.markup, name: 'markup' };
  return { grammar: Prism.languages[language], name: language };
}

export const ApiClientCodeEditor = forwardRef<HTMLTextAreaElement, ApiClientCodeEditorProps>(({
  ariaLabel,
  value,
  onChange,
  language = 'text',
  theme = 'light',
  minLines = 7,
  maxLines = 16,
  dataTestId,
  onEditorKeyDown,
  onCursorChange,
}, forwardedRef) => {
  const localRef = useRef<HTMLTextAreaElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const lineCount = Math.max(1, value.split('\n').length);
  const visibleLines = Math.min(maxLines, Math.max(minLines, lineCount));
  const height = visibleLines * 24 + 16;
  const highlighted = useMemo(() => {
    const descriptor = prismLanguage(language);
    return descriptor.grammar ? Prism.highlight(value || ' ', descriptor.grammar, descriptor.name) : escapeHtml(value || ' ');
  }, [language, value]);

  const assignRef = (node: HTMLTextAreaElement | null) => {
    localRef.current = node;
    if (typeof forwardedRef === 'function') forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  };

  const setSelectionAfterChange = (position: number) => requestAnimationFrame(() => {
    const textarea = localRef.current;
    if (!textarea) return;
    textarea.focus();
    textarea.setSelectionRange(position, position);
    onCursorChange?.(position);
  });

  const insertIndent = (textarea: HTMLTextAreaElement, reverse: boolean) => {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    if (reverse) {
      const lineStart = value.lastIndexOf('\n', start - 1) + 1;
      const removable = value.slice(lineStart, Math.min(lineStart + 2, value.length)).match(/^ {1,2}/)?.[0] || '';
      if (!removable) return;
      onChange(`${value.slice(0, lineStart)}${value.slice(lineStart + removable.length)}`);
      setSelectionAfterChange(Math.max(lineStart, start - removable.length));
      return;
    }
    onChange(`${value.slice(0, start)}  ${value.slice(end)}`);
    setSelectionAfterChange(start + 2);
  };

  const dark = theme === 'dark';
  return <div className={`api-client-code-editor ${dark ? 'dark' : 'light'} overflow-hidden rounded-md border ${dark ? 'border-gray-700 bg-gray-950' : 'border-gray-300 bg-white'}`}>
    <style>{TOKEN_STYLE}</style>
    <div className='grid grid-cols-[3rem_minmax(0,1fr)]' style={{ height }}>
      <div aria-hidden='true' className={`select-none overflow-hidden border-r py-2 pr-2 text-right font-mono text-xs leading-6 ${dark ? 'border-gray-800 bg-gray-900 text-gray-600' : 'border-gray-200 bg-gray-50 text-gray-400'}`}>
        <div style={{ transform: `translateY(${-scrollTop}px)` }}>
          {Array.from({ length: lineCount }, (_, index) => <div key={index}>{index + 1}</div>)}
        </div>
      </div>
      <div className='relative min-w-0 overflow-hidden'>
        <div aria-hidden='true' className='pointer-events-none absolute inset-0 overflow-hidden'>
          <pre className={`m-0 min-w-max whitespace-pre px-3 py-2 font-mono text-xs leading-6 ${dark ? 'text-gray-100' : 'text-gray-900'}`} style={{ transform: `translate(${-scrollLeft}px, ${-scrollTop}px)`, tabSize: 2 }}>
            <code dangerouslySetInnerHTML={{ __html: highlighted.endsWith('\n') ? highlighted : `${highlighted}\n` }} />
          </pre>
        </div>
        <textarea
          ref={assignRef}
          aria-label={ariaLabel}
          className='absolute inset-0 h-full w-full resize-none overflow-auto bg-transparent px-3 py-2 font-mono text-xs leading-6 outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500'
          data-testid={dataTestId}
          onChange={(event) => {
            onChange(event.target.value);
            onCursorChange?.(event.target.selectionStart);
          }}
          onClick={(event) => onCursorChange?.(event.currentTarget.selectionStart)}
          onKeyDown={(event) => {
            onEditorKeyDown?.(event);
            if (event.defaultPrevented) return;
            if (event.key === 'Tab') {
              event.preventDefault();
              insertIndent(event.currentTarget, event.shiftKey);
            }
          }}
          onKeyUp={(event) => onCursorChange?.(event.currentTarget.selectionStart)}
          onScroll={(event) => {
            setScrollTop(event.currentTarget.scrollTop);
            setScrollLeft(event.currentTarget.scrollLeft);
          }}
          onSelect={(event) => onCursorChange?.(event.currentTarget.selectionStart)}
          spellCheck={false}
          style={{ color: 'transparent', caretColor: dark ? '#f9fafb' : '#111827', WebkitTextFillColor: 'transparent', tabSize: 2, whiteSpace: 'pre' }}
          value={value}
          wrap='off'
        />
      </div>
    </div>
  </div>;
});

ApiClientCodeEditor.displayName = 'ApiClientCodeEditor';
