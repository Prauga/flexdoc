export type ApiClientScriptPhase = 'pre-request' | 'tests';
export type ApiClientScriptCompletionKind = 'property' | 'method' | 'function' | 'variable' | 'namespace';

export interface ApiClientScriptCompletionItem {
  label: string;
  kind: ApiClientScriptCompletionKind;
  signature?: string;
  documentation: string;
  testsOnly?: boolean;
}

export interface ApiClientScriptVariableKeys {
  environment?: string[];
  collection?: string[];
  variables?: string[];
}

const variableStoreMembers: ApiClientScriptCompletionItem[] = [
  { label: 'get', kind: 'method', signature: 'get(key: string): string | undefined', documentation: 'Read a variable by key.' },
  { label: 'has', kind: 'method', signature: 'has(key: string): boolean', documentation: 'Check whether a variable is defined.' },
  { label: 'set', kind: 'method', signature: 'set(key: string, value: unknown): void', documentation: 'Set a variable. Collection and environment stores persist the change in the workspace.' },
  { label: 'unset', kind: 'method', signature: 'unset(key: string): void', documentation: 'Remove a variable by key.' },
  { label: 'replaceIn', kind: 'method', signature: 'replaceIn(value: string): string', documentation: 'Replace {{variable}} placeholders using this variable scope.' },
];

export const API_CLIENT_SCRIPT_COMPLETION_PATHS: Readonly<Record<string, readonly ApiClientScriptCompletionItem[]>> = {
  flex: [
    { label: 'request', kind: 'property', documentation: 'The mutable request draft available to pre-request and test scripts.' },
    { label: 'response', kind: 'property', documentation: 'The response from the executed request.', testsOnly: true },
    { label: 'environment', kind: 'property', documentation: 'Read and mutate variables in the active environment.' },
    { label: 'collection', kind: 'property', documentation: 'Read and mutate variables on the current collection.' },
    { label: 'variables', kind: 'property', documentation: 'Read and mutate the effective variables for this execution.' },
    { label: 'expect', kind: 'function', signature: 'expect(actual: unknown): FlexExpectation', documentation: 'Create an assertion chain for a value.' },
    { label: 'test', kind: 'function', signature: 'test(name: string, callback: () => unknown | Promise<unknown>): void', documentation: 'Register a post-response test.', testsOnly: true },
  ],
  'flex.request': [
    { label: 'method', kind: 'property', signature: 'method: string', documentation: 'Read or replace the HTTP method.' },
    { label: 'url', kind: 'property', signature: 'url: string', documentation: 'Read or replace the request URL before variable resolution.' },
    { label: 'headers', kind: 'property', documentation: 'Mutable request-header helpers.' },
    { label: 'body', kind: 'property', documentation: 'Mutable raw request-body helpers.' },
  ],
  'flex.request.headers': [
    { label: 'get', kind: 'method', signature: 'get(name: string): string | undefined', documentation: 'Read a request header case-insensitively.' },
    { label: 'has', kind: 'method', signature: 'has(name: string): boolean', documentation: 'Check whether a request header exists.' },
    { label: 'set', kind: 'method', signature: 'set(name: string, value: unknown): void', documentation: 'Set or replace a request header.' },
    { label: 'upsert', kind: 'method', signature: 'upsert({ key, value }: { key: string; value: unknown }): void', documentation: 'Set or replace a request header from a key/value object.' },
    { label: 'remove', kind: 'method', signature: 'remove(name: string): void', documentation: 'Remove a request header case-insensitively.' },
    { label: 'toObject', kind: 'method', signature: 'toObject(): Record<string, string>', documentation: 'Return enabled request headers as an object.' },
  ],
  'flex.request.body': [
    { label: 'raw', kind: 'property', signature: 'raw: string', documentation: 'Read or replace the raw request body.' },
  ],
  'flex.response': [
    { label: 'code', kind: 'property', signature: 'code: number', documentation: 'HTTP response status code.', testsOnly: true },
    { label: 'status', kind: 'property', signature: 'status: string', documentation: 'HTTP response status text.', testsOnly: true },
    { label: 'responseTime', kind: 'property', signature: 'responseTime: number', documentation: 'Measured response time in milliseconds.', testsOnly: true },
    { label: 'headers', kind: 'property', documentation: 'Read-only response-header helpers.', testsOnly: true },
    { label: 'text', kind: 'method', signature: 'text(): string', documentation: 'Return the response body as text.', testsOnly: true },
    { label: 'json', kind: 'method', signature: 'json(): unknown', documentation: 'Parse and return the response body as JSON.', testsOnly: true },
  ],
  'flex.response.headers': [
    { label: 'get', kind: 'method', signature: 'get(name: string): string | undefined', documentation: 'Read a response header case-insensitively.', testsOnly: true },
    { label: 'has', kind: 'method', signature: 'has(name: string): boolean', documentation: 'Check whether a response header exists.', testsOnly: true },
    { label: 'toObject', kind: 'method', signature: 'toObject(): Record<string, string>', documentation: 'Return response headers as an object.', testsOnly: true },
  ],
  'flex.environment': variableStoreMembers,
  'flex.collection': variableStoreMembers,
  'flex.variables': variableStoreMembers.map((item) => ({
    ...item,
    documentation: item.label === 'set' || item.label === 'unset'
      ? `${item.documentation} Local effective-variable changes apply only to the current request execution.`
      : item.documentation,
  })),
  'flex.expect.to': [
    { label: 'equal', kind: 'method', signature: 'equal(expected: unknown): void', documentation: 'Assert strict equality with Object.is.' },
    { label: 'eql', kind: 'method', signature: 'eql(expected: unknown): void', documentation: 'Assert deep structural equality.' },
    { label: 'include', kind: 'method', signature: 'include(expected: unknown): void', documentation: 'Assert that a string or array contains the expected value.' },
    { label: 'match', kind: 'method', signature: 'match(pattern: RegExp): void', documentation: 'Assert that a string matches a regular expression.' },
    { label: 'have', kind: 'property', documentation: 'Property assertions.' },
    { label: 'be', kind: 'property', documentation: 'Boolean, range, and membership assertions.' },
  ],
  'flex.expect.to.have': [
    { label: 'property', kind: 'method', signature: 'property(name: string, expected?: unknown): void', documentation: 'Assert that an object has a property, optionally with an expected value.' },
  ],
  'flex.expect.to.be': [
    { label: 'above', kind: 'method', signature: 'above(expected: number): void', documentation: 'Assert that a number is greater than expected.' },
    { label: 'below', kind: 'method', signature: 'below(expected: number): void', documentation: 'Assert that a number is less than expected.' },
    { label: 'oneOf', kind: 'method', signature: 'oneOf(expected: unknown[]): void', documentation: 'Assert deep equality with one value from a list.' },
    { label: 'ok', kind: 'property', signature: 'ok: true', documentation: 'Assert that the value is truthy.' },
    { label: 'true', kind: 'property', signature: 'true: true', documentation: 'Assert that the value is exactly true.' },
    { label: 'false', kind: 'property', signature: 'false: true', documentation: 'Assert that the value is exactly false.' },
  ],
  console: [
    { label: 'log', kind: 'method', signature: 'log(...values: unknown[]): void', documentation: 'Write a line to the API Client script console.' },
    { label: 'info', kind: 'method', signature: 'info(...values: unknown[]): void', documentation: 'Write an informational line to the API Client script console.' },
    { label: 'warn', kind: 'method', signature: 'warn(...values: unknown[]): void', documentation: 'Write a warning line to the API Client script console.' },
    { label: 'error', kind: 'method', signature: 'error(...values: unknown[]): void', documentation: 'Write an error line to the API Client script console.' },
  ],
};

export function apiClientScriptMemberCompletions(path: string, phase: ApiClientScriptPhase): ApiClientScriptCompletionItem[] {
  return [...(API_CLIENT_SCRIPT_COMPLETION_PATHS[path] || [])]
    .filter((item) => phase === 'tests' || !item.testsOnly)
    .map((item) => ({ ...item }));
}

export function apiClientScriptVariableKeyCompletions(
  scope: keyof ApiClientScriptVariableKeys,
  prefix: string,
  keys: ApiClientScriptVariableKeys = {},
): ApiClientScriptCompletionItem[] {
  const normalizedPrefix = prefix.toLowerCase();
  return [...new Set(keys[scope] || [])]
    .filter(Boolean)
    .filter((key) => key.toLowerCase().startsWith(normalizedPrefix))
    .sort((left, right) => left.localeCompare(right))
    .map((key) => ({
      label: key,
      kind: 'variable',
      signature: key,
      documentation: `Known ${scope === 'variables' ? 'effective' : scope} variable.`,
    }));
}


export interface ApiClientScriptCompletionContext {
  from: number;
  to: number;
  items: ApiClientScriptCompletionItem[];
}

const ROOT_SCRIPT_COMPLETIONS: ApiClientScriptCompletionItem[] = [
  { label: 'flex', kind: 'namespace', documentation: 'FlexDoc request, response, variables, assertions, and test scripting API.' },
  { label: 'console', kind: 'namespace', documentation: 'Captured script console with log, info, warn, and error methods.' },
];

function assertionCompletionContext(textBeforeCursor: string): { path: string; prefix: string } | null {
  const start = textBeforeCursor.lastIndexOf('flex.expect(');
  if (start < 0) return null;
  const tail = textBeforeCursor.slice(start);
  const paths: Array<[RegExp, string]> = [
    [/\.to\.have\.([A-Za-z_$][\w$]*)?$/, 'flex.expect.to.have'],
    [/\.to\.be\.([A-Za-z_$][\w$]*)?$/, 'flex.expect.to.be'],
    [/\.to\.([A-Za-z_$][\w$]*)?$/, 'flex.expect.to'],
  ];
  for (const [pattern, path] of paths) {
    const match = tail.match(pattern);
    if (match) return { path, prefix: match[1] || '' };
  }
  return null;
}

function variableCompletionContext(textBeforeCursor: string): { scope: keyof ApiClientScriptVariableKeys; prefix: string } | null {
  const match = textBeforeCursor.match(/flex\.(environment|collection|variables)\.(?:get|has|set|unset)\(\s*['"]([^'"]*)$/);
  if (!match) return null;
  return { scope: match[1] as keyof ApiClientScriptVariableKeys, prefix: match[2] || '' };
}

function memberCompletionContext(textBeforeCursor: string): { path: string; prefix: string } | null {
  const match = textBeforeCursor.match(/(?:^|[^\w$])((?:flex|console)(?:\.[A-Za-z_$][\w$]*)*)\.([A-Za-z_$][\w$]*)?$/);
  if (!match) return null;
  return { path: match[1], prefix: match[2] || '' };
}

export function apiClientScriptCompletionsAtPosition(
  source: string,
  position: number,
  phase: ApiClientScriptPhase,
  variableKeys: ApiClientScriptVariableKeys = {},
  explicit = false,
): ApiClientScriptCompletionContext | null {
  const safePosition = Math.max(0, Math.min(position, source.length));
  const before = source.slice(0, safePosition);

  const variable = variableCompletionContext(before);
  if (variable) {
    const items = apiClientScriptVariableKeyCompletions(variable.scope, variable.prefix, variableKeys);
    return items.length > 0 ? { from: safePosition - variable.prefix.length, to: safePosition, items } : null;
  }

  const assertion = assertionCompletionContext(before);
  if (assertion) {
    const items = apiClientScriptMemberCompletions(assertion.path, phase)
      .filter((item) => item.label.toLowerCase().startsWith(assertion.prefix.toLowerCase()));
    return items.length > 0 ? { from: safePosition - assertion.prefix.length, to: safePosition, items } : null;
  }

  const member = memberCompletionContext(before);
  if (member) {
    const items = apiClientScriptMemberCompletions(member.path, phase)
      .filter((item) => item.label.toLowerCase().startsWith(member.prefix.toLowerCase()));
    return items.length > 0 ? { from: safePosition - member.prefix.length, to: safePosition, items } : null;
  }

  const word = before.match(/([A-Za-z_$][\w$]*)$/)?.[1] || '';
  if (!explicit && !word) return null;
  const items = ROOT_SCRIPT_COMPLETIONS.filter((item) => !word || item.label.startsWith(word));
  if (!explicit && items.length === 0) return null;
  return items.length > 0 ? { from: safePosition - word.length, to: safePosition, items: items.map((item) => ({ ...item })) } : null;
}
