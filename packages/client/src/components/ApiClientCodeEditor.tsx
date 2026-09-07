import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { EditorState, Compartment, Prec, type Extension } from '@codemirror/state';
import { EditorView, drawSelection, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers, type KeyBinding } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';

export type ApiClientCodeLanguage = 'javascript' | 'json' | 'text' | 'xml' | 'html' | 'graphql';

/** Imperative handle for focusing and querying the CodeMirror editor instance. */
export interface ApiClientCodeEditorHandle {
  focus: () => void;
  getSelection: () => { from: number; to: number };
  setSelection: (from: number, to?: number) => void;
  coordsAtPos: (position: number) => { left: number; right: number; top: number; bottom: number } | null;
}

/** Props for the shared CodeMirror-based editor used by API Client panels. */
export interface ApiClientCodeEditorProps {
  ariaLabel: string;
  value: string;
  onChange: (value: string) => void;
  language?: ApiClientCodeLanguage;
  theme?: 'light' | 'dark';
  minLines?: number;
  maxLines?: number;
  dataTestId?: string;
  wrap?: boolean;
  autoIndent?: boolean;
  ariaControls?: string;
  ariaActiveDescendant?: string;
  ariaAutocomplete?: 'none' | 'inline' | 'list' | 'both';
  ariaExpanded?: boolean;
  onEditorKeyDown?: (event: KeyboardEvent) => void;
  onCursorChange?: (position: number) => void;
}

function contentAttributes({
  ariaLabel,
  dataTestId,
  ariaControls,
  ariaActiveDescendant,
  ariaAutocomplete,
  ariaExpanded,
}: Pick<ApiClientCodeEditorProps, 'ariaLabel' | 'dataTestId' | 'ariaControls' | 'ariaActiveDescendant' | 'ariaAutocomplete' | 'ariaExpanded'>): Record<string, string> {
  const attributes: Record<string, string> = {
    'aria-label': ariaLabel,
    'aria-multiline': 'true',
    role: 'textbox',
    spellcheck: 'false',
  };
  if (dataTestId) attributes['data-testid'] = dataTestId;
  if (ariaControls) attributes['aria-controls'] = ariaControls;
  if (ariaActiveDescendant) attributes['aria-activedescendant'] = ariaActiveDescendant;
  if (ariaAutocomplete) attributes['aria-autocomplete'] = ariaAutocomplete;
  if (ariaExpanded !== undefined) attributes['aria-expanded'] = String(ariaExpanded);
  return attributes;
}

function visualTheme(theme: 'light' | 'dark'): Extension {
  const dark = theme === 'dark';
  return EditorView.theme({
    '&': {
      height: '100%',
      backgroundColor: dark ? '#030712' : '#ffffff',
      color: dark ? '#f3f4f6' : '#111827',
    },
    '&.cm-focused': { outline: 'none' },
    '.cm-scroller': {
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      fontSize: '12px',
      lineHeight: '24px',
      overflow: 'auto',
    },
    '.cm-content': {
      minHeight: '100%',
      padding: '8px 12px',
      caretColor: dark ? '#f9fafb' : '#111827',
    },
    '.cm-line': { padding: '0' },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: dark ? '#f9fafb' : '#111827' },
    '.cm-gutters': {
      backgroundColor: dark ? '#111827' : '#f9fafb',
      color: dark ? '#6b7280' : '#9ca3af',
      borderRight: `1px solid ${dark ? '#1f2937' : '#e5e7eb'}`,
    },
    '.cm-activeLine': { backgroundColor: dark ? '#11182780' : '#f3f4f680' },
    '.cm-activeLineGutter': { backgroundColor: dark ? '#1f2937' : '#f3f4f6' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
      backgroundColor: dark ? '#1d4ed880' : '#bfdbfe',
    },
  }, { dark });
}

const plainNewline: KeyBinding = {
  key: 'Enter',
  run: (view: EditorView) => {
    view.dispatch(view.state.replaceSelection('\n'));
    return true;
  },
};

function editorKeymap(autoIndent: boolean): Extension {
  const base = defaultKeymap.filter((binding) => binding.key !== 'Enter');
  return keymap.of(autoIndent
    ? [...defaultKeymap, ...historyKeymap, indentWithTab]
    : [plainNewline, ...base, ...historyKeymap]);
}

/** CodeMirror editor with language modes for API Client request and response bodies. */
export const ApiClientCodeEditor = forwardRef<ApiClientCodeEditorHandle, ApiClientCodeEditorProps>(({
  ariaLabel,
  value,
  onChange,
  language = 'text',
  theme = 'light',
  minLines = 7,
  maxLines = 16,
  dataTestId,
  wrap = false,
  autoIndent = false,
  ariaControls,
  ariaActiveDescendant,
  ariaAutocomplete,
  ariaExpanded,
  onEditorKeyDown,
  onCursorChange,
}, forwardedRef) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onCursorChangeRef = useRef(onCursorChange);
  const onEditorKeyDownRef = useRef(onEditorKeyDown);
  const syncingValueRef = useRef(false);
  const initialConfigRef = useRef({ value, theme, wrap, autoIndent, ariaLabel, dataTestId, ariaControls, ariaActiveDescendant, ariaAutocomplete, ariaExpanded });

  const themeCompartment = useMemo(() => new Compartment(), []);
  const wrapCompartment = useMemo(() => new Compartment(), []);
  const gutterCompartment = useMemo(() => new Compartment(), []);
  const keymapCompartment = useMemo(() => new Compartment(), []);
  const attributesCompartment = useMemo(() => new Compartment(), []);

  onChangeRef.current = onChange;
  onCursorChangeRef.current = onCursorChange;
  onEditorKeyDownRef.current = onEditorKeyDown;

  useImperativeHandle(forwardedRef, () => ({
    focus: () => viewRef.current?.focus(),
    getSelection: () => {
      const main = viewRef.current?.state.selection.main;
      return main ? { from: main.from, to: main.to } : { from: 0, to: 0 };
    },
    setSelection: (from, to = from) => {
      const view = viewRef.current;
      if (!view) return;
      const length = view.state.doc.length;
      const anchor = Math.max(0, Math.min(from, length));
      const head = Math.max(0, Math.min(to, length));
      view.dispatch({ selection: { anchor, head }, scrollIntoView: true });
      view.focus();
      onCursorChangeRef.current?.(anchor);
    },
    coordsAtPos: (position) => {
      const view = viewRef.current;
      if (!view) return null;
      const safePosition = Math.max(0, Math.min(position, view.state.doc.length));
      const coords = view.coordsAtPos(safePosition);
      return coords ? { left: coords.left, right: coords.right, top: coords.top, bottom: coords.bottom } : null;
    },
  }), []);

  useEffect(() => {
    if (!hostRef.current || viewRef.current) return;
    const initial = initialConfigRef.current;
    const state = EditorState.create({
      doc: initial.value,
      extensions: [
        history(),
        drawSelection(),
        themeCompartment.of(visualTheme(initial.theme)),
        wrapCompartment.of(initial.wrap ? EditorView.lineWrapping : []),
        gutterCompartment.of(initial.wrap ? [] : [lineNumbers(), highlightActiveLineGutter(), highlightActiveLine()]),
        keymapCompartment.of(editorKeymap(initial.autoIndent)),
        attributesCompartment.of(EditorView.contentAttributes.of(contentAttributes(initial))),
        Prec.highest(EditorView.domEventHandlers({
          keydown: (event) => {
            onEditorKeyDownRef.current?.(event);
            return event.defaultPrevented;
          },
        })),
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !syncingValueRef.current) onChangeRef.current(update.state.doc.toString());
          if (update.selectionSet || update.docChanged) onCursorChangeRef.current?.(update.state.selection.main.head);
        }),
      ],
    });
    const view = new EditorView({ state, parent: hostRef.current });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [attributesCompartment, gutterCompartment, keymapCompartment, themeCompartment, wrapCompartment]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || view.state.doc.toString() === value) return;
    const selection = view.state.selection.main;
    syncingValueRef.current = true;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: value },
      selection: { anchor: Math.min(selection.anchor, value.length), head: Math.min(selection.head, value.length) },
    });
    syncingValueRef.current = false;
  }, [value]);

  useEffect(() => {
    viewRef.current?.dispatch({ effects: themeCompartment.reconfigure(visualTheme(theme)) });
  }, [theme, themeCompartment]);

  useEffect(() => {
    viewRef.current?.dispatch({ effects: wrapCompartment.reconfigure(wrap ? EditorView.lineWrapping : []) });
    viewRef.current?.dispatch({ effects: gutterCompartment.reconfigure(wrap ? [] : [lineNumbers(), highlightActiveLineGutter(), highlightActiveLine()]) });
  }, [gutterCompartment, wrap, wrapCompartment]);

  useEffect(() => {
    viewRef.current?.dispatch({ effects: keymapCompartment.reconfigure(editorKeymap(autoIndent)) });
  }, [autoIndent, keymapCompartment]);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: attributesCompartment.reconfigure(EditorView.contentAttributes.of(contentAttributes({
        ariaLabel,
        dataTestId,
        ariaControls,
        ariaActiveDescendant,
        ariaAutocomplete,
        ariaExpanded,
      }))),
    });
  }, [ariaActiveDescendant, ariaAutocomplete, ariaControls, ariaExpanded, ariaLabel, attributesCompartment, dataTestId]);

  const lineCount = Math.max(1, value.split('\n').length);
  const visibleLines = Math.min(maxLines, Math.max(minLines, lineCount));
  const height = visibleLines * 24 + 16;
  const dark = theme === 'dark';

  return <div
    className={`api-client-code-editor min-w-0 overflow-hidden rounded-md border focus-within:ring-2 focus-within:ring-inset focus-within:ring-blue-500 ${dark ? 'border-gray-700 bg-gray-950' : 'border-gray-300 bg-white'}`}
    data-editor='codemirror'
    data-language={language}
    data-wrap={wrap ? 'soft' : 'off'}
    style={{ height }}
  >
    <div ref={hostRef} className='h-full min-w-0' />
  </div>;
});

ApiClientCodeEditor.displayName = 'ApiClientCodeEditor';
