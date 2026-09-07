import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { OpenAPIParser } from '../utils/openapi-parser';
import type { OpenAPISpec } from '../types/openapi';
import { commandWindowRange } from '../utils/command-palette-window';
import type { FlexDocMessages } from '../types/options';

interface Props {
  spec: OpenAPISpec;
  theme: 'light' | 'dark';
  onEndpointSelect: (path: string, method: string) => void;
  onHome: () => void;
  onOpenSettings: () => void;
  onOpenApiClient: () => void;
  onOpenRuntime?: () => void;
  onSendCurrent?: () => void;
  messages?: FlexDocMessages;
}

type Command = { id: string; label: string; action: () => void };
const ROW_HEIGHT = 44;

function focusableElements(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(
    'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
  ));
}

export const FlexDocCommandPalette: React.FC<Props> = ({ spec, theme, onEndpointSelect, onHome, onOpenSettings, onOpenApiClient, onOpenRuntime, onSendCurrent, messages }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const hasVisibleSendTarget = open && typeof document !== 'undefined' && Array.from(document.querySelectorAll<HTMLElement>('[data-api-client-send="true"]')).some((element) => !element.closest('.hidden'));

  const commands = useMemo<Command[]>(() => {
    const next: Command[] = [
      { id: 'overview', label: messages?.openOverview || 'Open Overview', action: onHome },
      { id: 'api-client', label: messages?.openApiClient || 'Open API Client', action: onOpenApiClient },
      ...(onOpenRuntime ? [{ id: 'runtime', label: messages?.openRuntime || 'Open Runtime Intelligence', action: onOpenRuntime }] : []),
      { id: 'settings', label: messages?.openSettings || 'Open Viewer Settings', action: onOpenSettings },
      ...(onSendCurrent && hasVisibleSendTarget ? [{ id: 'send-current', label: messages?.sendCurrentRequest || 'Send current request', action: onSendCurrent }] : []),
    ];
    for (const [path, pathItem] of Object.entries(spec.paths)) {
      for (const method of OpenAPIParser.getHttpMethods(pathItem)) {
        next.push({ id: `operation:${method}:${path}`, label: `${method.toUpperCase()} ${path}`, action: () => onEndpointSelect(path, method) });
      }
    }
    return next;
  }, [hasVisibleSendTarget, messages?.openApiClient, messages?.openOverview, messages?.openRuntime, messages?.openSettings, messages?.sendCurrentRequest, onEndpointSelect, onHome, onOpenApiClient, onOpenRuntime, onOpenSettings, onSendCurrent, spec]);

  const normalizedQuery = query.trim().toLowerCase();
  const visible = useMemo(() => normalizedQuery
    ? commands.filter((command) => command.label.toLowerCase().includes(normalizedQuery))
    : commands, [commands, normalizedQuery]);
  const { start: windowStart, end: windowEnd } = commandWindowRange(visible.length, activeIndex);
  const rendered = visible.slice(windowStart, windowEnd);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setActiveIndex(0);
  }, []);

  const activate = useCallback((command?: Command) => {
    if (!command) return;
    close();
    command.action();
  }, [close]);

  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'k') return;
      event.preventDefault();
      setOpen((current) => !current);
    };
    document.addEventListener('keydown', shortcut);
    return () => document.removeEventListener('keydown', shortcut);
  }, []);

  useEffect(() => {
    if (!open || typeof document === 'undefined') return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => inputRef.current?.focus());

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        setActiveIndex((current) => {
          if (!visible.length) return 0;
          if (event.key === 'Home') return 0;
          if (event.key === 'End') return visible.length - 1;
          return event.key === 'ArrowDown' ? (current + 1) % visible.length : (current - 1 + visible.length) % visible.length;
        });
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        activate(visible[activeIndex]);
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = focusableElements(dialogRef.current);
      if (!focusable.length) return;
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
  }, [activeIndex, activate, close, open, visible]);

  useEffect(() => {
    resultRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  if (!open) return null;
  const surface = theme === 'dark' ? 'border-gray-700 bg-gray-900 text-gray-100' : 'border-gray-200 bg-white text-gray-900';
  const activeClass = theme === 'dark' ? 'bg-blue-950/70 text-blue-100' : 'bg-blue-50 text-blue-900';

  return <div className='fixed inset-0 z-[80]'>
    <button type='button' aria-label={messages?.closeCommandPalette || 'Close command palette'} className='absolute inset-0 bg-black/40' onClick={close} />
    <div ref={dialogRef} role='dialog' aria-modal='true' aria-label={messages?.commandPalette || 'Command palette'} className={`relative mx-auto mt-[10vh] w-[min(94vw,56rem)] overflow-hidden rounded-xl border shadow-2xl ${surface}`}>
      <input
        ref={inputRef}
        aria-label={messages?.searchCommands || 'Search commands'}
        className='w-full border-b bg-transparent p-3 text-sm outline-none'
        placeholder={messages?.searchCommandsPlaceholder || 'Search operations and commands…'}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setActiveIndex(0);
        }}
      />
      <div className='max-h-[60vh] overflow-y-auto p-2' role='listbox' aria-label={messages?.commandResults || 'Command results'}>
        {windowStart > 0 && <div aria-hidden='true' style={{ height: windowStart * ROW_HEIGHT }} />}
        {rendered.map((command, offset) => {
          const index = windowStart + offset;
          return <button
            ref={(node) => { resultRefs.current[index] = node; }}
            key={command.id}
            type='button'
            role='option'
            aria-selected={index === activeIndex}
            aria-posinset={index + 1}
            aria-setsize={visible.length}
            className={`w-full rounded-md p-2 text-left text-sm ${index === activeIndex ? activeClass : ''}`}
            style={{ height: ROW_HEIGHT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            onMouseEnter={() => setActiveIndex(index)}
            onClick={() => activate(command)}
          >{command.label}</button>;
        })}
        {windowEnd < visible.length && <div aria-hidden='true' style={{ height: (visible.length - windowEnd) * ROW_HEIGHT }} />}
        {!visible.length && <div className='p-3 text-sm opacity-65'>{messages?.noCommandResults || 'No matching commands.'}</div>}
      </div>
    </div>
  </div>;
};
