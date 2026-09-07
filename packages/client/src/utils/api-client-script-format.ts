export interface ApiClientScriptDiagnostic {
  valid: boolean;
  message: string;
}

export interface ApiClientScriptFormattedSelection {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

export function apiClientScriptDiagnostic(source: string): ApiClientScriptDiagnostic {
  if (!source.trim()) return { valid: true, message: 'Ready' };
  try {
    // Compile the same async wrapper used by the trusted local script runner, without executing it.
    new Function('flex', 'console', `"use strict"; return (async () => {\n${source}\n});`);
    return { valid: true, message: 'Syntax OK' };
  } catch (cause) {
    return {
      valid: false,
      message: cause instanceof Error ? cause.message : String(cause),
    };
  }
}

interface ScanState {
  quote?: "'" | '"' | '`';
  escaped: boolean;
  blockComment: boolean;
}

function scanBraces(line: string, state: ScanState): { opens: number; closes: number; state: ScanState } {
  let opens = 0;
  let closes = 0;
  const next = { ...state };

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const following = line[index + 1];

    if (next.blockComment) {
      if (char === '*' && following === '/') {
        next.blockComment = false;
        index += 1;
      }
      continue;
    }

    if (next.quote) {
      if (next.escaped) {
        next.escaped = false;
        continue;
      }
      if (char === '\\') {
        next.escaped = true;
        continue;
      }
      if (char === next.quote) next.quote = undefined;
      continue;
    }

    if (char === '/' && following === '/') break;
    if (char === '/' && following === '*') {
      next.blockComment = true;
      index += 1;
      continue;
    }
    if (char === "'" || char === '"' || char === '`') {
      next.quote = char;
      next.escaped = false;
      continue;
    }
    if (char === '{') opens += 1;
    else if (char === '}') closes += 1;
  }

  return { opens, closes, state: next };
}

export function formatApiClientScript(source: string): string {
  const normalized = source.replace(/\r\n?/g, '\n');
  if (!normalized.trim()) return normalized;

  let indent = 0;
  let state: ScanState = { escaped: false, blockComment: false };
  const formatted = normalized.split('\n').map((rawLine) => {
    const withoutTrailing = rawLine.replace(/[ \t]+$/g, '');
    const trimmed = withoutTrailing.trimStart();
    if (!trimmed) return '';

    const leadingClosers = trimmed.match(/^}+/)?.[0].length || 0;
    const lineIndent = Math.max(0, indent - leadingClosers);
    const scan = scanBraces(trimmed, state);
    state = scan.state;
    indent = Math.max(0, indent + scan.opens - scan.closes);
    return `${'  '.repeat(lineIndent)}${trimmed}`;
  });

  return formatted.join('\n');
}

function normalizedOffset(source: string, offset: number): number {
  return source.slice(0, Math.max(0, Math.min(offset, source.length))).replace(/\r\n?/g, '\n').length;
}

function remapOffset(normalizedSource: string, formatted: string, offset: number): number {
  const sourceLines = normalizedSource.split('\n');
  const formattedLines = formatted.split('\n');
  const prefix = normalizedSource.slice(0, Math.max(0, Math.min(offset, normalizedSource.length)));
  const lineIndex = prefix.split('\n').length - 1;
  const lastBreak = prefix.lastIndexOf('\n');
  const column = prefix.length - (lastBreak + 1);
  const sourceLine = sourceLines[lineIndex] || '';
  const formattedLine = formattedLines[lineIndex] || '';
  const sourceIndent = sourceLine.length - sourceLine.trimStart().length;
  const formattedIndent = formattedLine.length - formattedLine.trimStart().length;
  const formattedContentLength = formattedLine.length - formattedIndent;
  const nextColumn = column <= sourceIndent
    ? Math.min(column, formattedIndent)
    : formattedIndent + Math.min(column - sourceIndent, formattedContentLength);
  const precedingLength = formattedLines.slice(0, lineIndex).reduce((total, line) => total + line.length + 1, 0);
  return precedingLength + nextColumn;
}

export function formatApiClientScriptSelection(source: string, selectionStart: number, selectionEnd = selectionStart): ApiClientScriptFormattedSelection {
  const normalized = source.replace(/\r\n?/g, '\n');
  const value = formatApiClientScript(source);
  const start = remapOffset(normalized, value, normalizedOffset(source, selectionStart));
  const end = remapOffset(normalized, value, normalizedOffset(source, selectionEnd));
  return {
    value,
    selectionStart: Math.min(start, value.length),
    selectionEnd: Math.min(Math.max(start, end), value.length),
  };
}
