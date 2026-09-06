import type { ApiClientRequestScripts } from './api-client-scripting';
import type { HttpAuth, HttpKeyValue, HttpRequestDraft } from './http-client';
import { createApiClientId } from './api-client-workspace';
import type {
  ApiClientCollection,
  ApiClientEnvironment,
  ApiClientEnvironmentVariable,
  ApiClientFolder,
  ApiClientSavedRequest,
  ApiClientWorkspaceState,
} from './api-client-workspace';

type UnknownRecord = Record<string, unknown>;

export interface ApiClientImportWarning {
  code: string;
  path: string;
  message: string;
}

export interface PostmanCollectionImportResult {
  collection: ApiClientCollection;
  folders: ApiClientFolder[];
  requests: ApiClientSavedRequest[];
  warnings: ApiClientImportWarning[];
}

export interface PostmanEnvironmentImportResult {
  environment: ApiClientEnvironment;
  warnings: ApiClientImportWarning[];
}

export type PostmanDocumentImportResult =
  | { kind: 'collection'; result: PostmanCollectionImportResult }
  | { kind: 'environment'; result: PostmanEnvironmentImportResult };

interface ScriptBundle {
  preRequest: string[];
  tests: string[];
}

function isRecord(value: unknown): value is UnknownRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function scalarString(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try { return JSON.stringify(value); } catch { return String(value); }
}

function warning(warnings: ApiClientImportWarning[], code: string, path: string, message: string): void {
  warnings.push({ code, path, message });
}

function postmanEntries(value: unknown): UnknownRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function authField(auth: UnknownRecord, type: string, key: string): string {
  const entry = postmanEntries(auth[type]).find((candidate) => candidate.key === key);
  return entry ? scalarString(entry.value) : '';
}

function postmanGrantType(value: string): 'accessToken' | 'authorizationCode' | 'clientCredentials' | 'password' | 'implicit' | undefined {
  switch (value) {
    case 'authorization_code': return 'authorizationCode';
    case 'client_credentials': return 'clientCredentials';
    case 'password_credentials':
    case 'password': return 'password';
    case 'implicit': return 'implicit';
    case 'access_token': return 'accessToken';
    default: return undefined;
  }
}

function parsePostmanAuth(
  value: unknown,
  fallback: HttpAuth,
  path: string,
  warnings: ApiClientImportWarning[],
): HttpAuth {
  if (!isRecord(value) || typeof value.type !== 'string') return { ...fallback };
  const type = value.type.toLowerCase();
  if (type === 'inherit') return { ...fallback };
  if (type === 'noauth') return { type: 'none' };
  if (type === 'bearer') return { type: 'bearer', token: authField(value, 'bearer', 'token') };
  if (type === 'basic') {
    return {
      type: 'basic',
      username: authField(value, 'basic', 'username'),
      password: authField(value, 'basic', 'password'),
    };
  }
  if (type === 'apikey') {
    const location = authField(value, 'apikey', 'in').toLowerCase();
    if (location === 'cookie') {
      warning(warnings, 'postman-auth-host-execution', path, 'Imported Postman cookie API key requires FlexDoc API host execution; the browser will not send this auth mode directly.');
    } else if (location && location !== 'header' && location !== 'query') {
      warning(warnings, 'postman-auth-apikey-location', path, `Unsupported Postman API-key location "${location}"; imported as a header API key.`);
    }
    return {
      type: 'apiKey',
      key: authField(value, 'apikey', 'key'),
      value: authField(value, 'apikey', 'value'),
      in: location === 'query' ? 'query' : location === 'cookie' ? 'cookie' : 'header',
    };
  }
  if (type === 'oauth2') {
    const scope = authField(value, 'oauth2', 'scope');
    const grantType = postmanGrantType(authField(value, 'oauth2', 'grant_type'));
    const clientAuthentication = authField(value, 'oauth2', 'client_authentication').toLowerCase();
    return {
      type: 'oauth2',
      accessToken: authField(value, 'oauth2', 'accessToken'),
      ...(grantType ? { grantType } : {}),
      authorizationUrl: authField(value, 'oauth2', 'authUrl') || undefined,
      tokenUrl: authField(value, 'oauth2', 'accessTokenUrl') || undefined,
      clientId: authField(value, 'oauth2', 'clientId') || undefined,
      clientSecret: authField(value, 'oauth2', 'clientSecret') || undefined,
      clientAuthentication: clientAuthentication === 'header' || clientAuthentication === 'basic' ? 'basic' : 'body',
      redirectUri: authField(value, 'oauth2', 'redirect_uri') || undefined,
      scopes: scope ? scope.split(/[\s,]+/).filter(Boolean) : undefined,
      username: authField(value, 'oauth2', 'username') || undefined,
      password: authField(value, 'oauth2', 'password') || undefined,
      refreshToken: authField(value, 'oauth2', 'refreshToken') || undefined,
    };
  }

  const hostWarning = (name: string) => warning(warnings, 'postman-auth-host-execution', path, `Imported Postman ${name} auth requires FlexDoc API host execution; the browser will not send this auth mode directly.`);
  if (type === 'digest') {
    hostWarning('Digest');
    return { type: 'digest', username: authField(value, 'digest', 'username'), password: authField(value, 'digest', 'password') };
  }
  if (type === 'hawk') {
    hostWarning('Hawk');
    const algorithm = authField(value, 'hawk', 'algorithm').toLowerCase();
    return {
      type: 'hawk',
      id: authField(value, 'hawk', 'authId') || authField(value, 'hawk', 'id'),
      key: authField(value, 'hawk', 'authKey') || authField(value, 'hawk', 'key'),
      algorithm: algorithm === 'sha1' ? 'sha1' : 'sha256',
      ext: authField(value, 'hawk', 'extraData') || authField(value, 'hawk', 'ext') || undefined,
    };
  }
  if (type === 'ntlm') {
    hostWarning('NTLM/Negotiate');
    return {
      type: 'ntlm',
      username: authField(value, 'ntlm', 'username'),
      password: authField(value, 'ntlm', 'password'),
      domain: authField(value, 'ntlm', 'domain') || undefined,
      workstation: authField(value, 'ntlm', 'workstation') || undefined,
    };
  }
  if (type === 'oauth1') {
    hostWarning('OAuth 1.0');
    const signatureMethod = authField(value, 'oauth1', 'signatureMethod').toUpperCase();
    return {
      type: 'oauth1',
      consumerKey: authField(value, 'oauth1', 'consumerKey'),
      consumerSecret: authField(value, 'oauth1', 'consumerSecret'),
      token: authField(value, 'oauth1', 'token') || undefined,
      tokenSecret: authField(value, 'oauth1', 'tokenSecret') || undefined,
      signatureMethod: signatureMethod === 'HMAC-SHA256' || signatureMethod === 'PLAINTEXT' ? signatureMethod : 'HMAC-SHA1',
      realm: authField(value, 'oauth1', 'realm') || undefined,
    };
  }
  if (type === 'awsv4') {
    hostWarning('AWS Signature V4');
    return {
      type: 'awsv4',
      accessKey: authField(value, 'awsv4', 'accessKey'),
      secretKey: authField(value, 'awsv4', 'secretKey'),
      sessionToken: authField(value, 'awsv4', 'sessionToken') || undefined,
      region: authField(value, 'awsv4', 'region'),
      service: authField(value, 'awsv4', 'service'),
    };
  }

  warning(warnings, 'postman-auth-unsupported', path, `Postman auth type "${value.type}" is not supported by FlexDoc and was left to inherited/default auth.`);
  return { ...fallback };
}

function parseVariables(value: unknown, path: string, warnings: ApiClientImportWarning[]): ApiClientEnvironmentVariable[] {
  return postmanEntries(value).flatMap((variable, index) => {
    const key = scalarString(variable.key).trim();
    if (!key) {
      warning(warnings, 'postman-variable-empty-key', `${path}[${index}]`, 'Skipped a Postman variable with an empty key.');
      return [];
    }
    return [{
      id: createApiClientId('variable'),
      key,
      value: scalarString(variable.value),
      enabled: variable.disabled !== true && variable.enabled !== false,
    }];
  });
}

function translatePostmanScript(source: string, path: string, warnings: ApiClientImportWarning[]): string {
  const unsupportedTokens = [
    'pm.sendRequest',
    'pm.globals',
    'pm.iterationData',
    'pm.cookies',
    'pm.vault',
    'pm.require',
    'pm.execution',
    'postman.',
  ].filter((token) => source.includes(token));

  let translated = source
    .replace(/\bpm\.response\.to\.have\.status\(([^)\n]+)\)\s*;?/g, 'flex.expect(flex.response?.code).to.equal($1);')
    .replace(/\bpm\.response\.to\.have\.header\(([^)\n]+)\)\s*;?/g, 'flex.expect(flex.response?.headers.has($1)).to.equal(true);')
    .replace(/\bpm\.collectionVariables\b/g, 'flex.collection')
    .replace(/\bpm\.environment\b/g, 'flex.environment')
    .replace(/\bpm\.variables\b/g, 'flex.variables')
    .replace(/\bpm\.request\b/g, 'flex.request')
    .replace(/\bpm\.response\b/g, 'flex.response')
    .replace(/\bpm\.expect\b/g, 'flex.expect')
    .replace(/\bpm\.test\b/g, 'flex.test')
    .replace(/\bflex\.request\.headers\.add\s*\(/g, 'flex.request.headers.upsert(');

  if (/\bpm\./.test(translated)) unsupportedTokens.push('other pm.* APIs');
  if (unsupportedTokens.length > 0) {
    warning(
      warnings,
      'postman-script-partial-compatibility',
      path,
      `Imported script uses unsupported Postman APIs (${[...new Set(unsupportedTokens)].join(', ')}); review the script before relying on it.`,
    );
    translated = `// Imported from Postman. Review unsupported API usage before relying on this script.\n${translated}`;
  }
  return translated;
}

function eventSource(script: unknown, path: string, warnings: ApiClientImportWarning[]): string {
  if (!isRecord(script)) return '';
  if (script.src !== undefined) {
    warning(warnings, 'postman-script-src', path, 'External Postman script sources are not fetched; only inline script.exec content is imported.');
  }
  if (Array.isArray(script.exec)) return script.exec.map(scalarString).join('\n');
  return scalarString(script.exec);
}

function parseEvents(value: unknown, path: string, warnings: ApiClientImportWarning[]): ScriptBundle {
  const bundle: ScriptBundle = { preRequest: [], tests: [] };
  postmanEntries(value).forEach((event, index) => {
    const listen = scalarString(event.listen).toLowerCase();
    if (listen !== 'prerequest' && listen !== 'test') return;
    const eventPath = `${path}[${index}]`;
    const source = eventSource(event.script, `${eventPath}.script`, warnings).trim();
    if (!source) return;
    const translated = translatePostmanScript(source, `${eventPath}.script`, warnings);
    if (listen === 'prerequest') bundle.preRequest.push(translated);
    else bundle.tests.push(translated);
  });
  return bundle;
}

function combineScripts(parent: ScriptBundle, local: ScriptBundle): ScriptBundle {
  return {
    preRequest: [...parent.preRequest, ...local.preRequest],
    tests: [...parent.tests, ...local.tests],
  };
}

function savedScripts(bundle: ScriptBundle): ApiClientRequestScripts | undefined {
  const preRequest = bundle.preRequest.filter(Boolean).join('\n\n').trim();
  const tests = bundle.tests.filter(Boolean).join('\n\n').trim();
  return preRequest || tests ? { preRequest, tests } : undefined;
}

function decodeQueryPart(value: string): string {
  try { return decodeURIComponent(value.replace(/\+/g, ' ')); } catch { return value; }
}

function splitRawUrl(raw: string): { url: string; query: HttpKeyValue[] } {
  const withoutHash = raw.split('#', 1)[0];
  const question = withoutHash.indexOf('?');
  if (question < 0) return { url: withoutHash, query: [] };
  const queryString = withoutHash.slice(question + 1);
  const query = queryString ? queryString.split('&').map((pair) => {
    const equals = pair.indexOf('=');
    return {
      key: decodeQueryPart(equals >= 0 ? pair.slice(0, equals) : pair),
      value: decodeQueryPart(equals >= 0 ? pair.slice(equals + 1) : ''),
      enabled: true,
    };
  }) : [];
  return { url: withoutHash.slice(0, question), query };
}

function parseQuery(value: unknown): HttpKeyValue[] {
  return postmanEntries(value).map((entry) => ({
    key: scalarString(entry.key),
    value: scalarString(entry.value),
    enabled: entry.disabled !== true,
  }));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replacePathVariables(url: string, variables: unknown): string {
  let next = url;
  for (const variable of postmanEntries(variables)) {
    const key = scalarString(variable.key).trim();
    if (!key) continue;
    next = next.replace(new RegExp(`:${escapeRegExp(key)}(?=/|$)`, 'g'), `{{${key}}}`);
  }
  return next;
}

function parseUrl(value: unknown): { url: string; query: HttpKeyValue[] } {
  if (typeof value === 'string') return splitRawUrl(value);
  if (!isRecord(value)) return { url: '', query: [] };

  const explicitQuery = parseQuery(value.query);
  const raw = scalarString(value.raw);
  if (raw) {
    const parsed = splitRawUrl(raw);
    return {
      url: replacePathVariables(parsed.url, value.variable),
      query: explicitQuery.length > 0 ? explicitQuery : parsed.query,
    };
  }

  const protocol = scalarString(value.protocol).replace(/:$/, '');
  const host = Array.isArray(value.host) ? value.host.map(scalarString).join('.') : scalarString(value.host);
  const port = scalarString(value.port);
  const path = Array.isArray(value.path) ? value.path.map(scalarString).join('/') : scalarString(value.path).replace(/^\//, '');
  const authority = host ? `${protocol ? `${protocol}://` : ''}${host}${port ? `:${port}` : ''}` : '';
  const assembled = authority ? `${authority}${path ? `/${path}` : ''}` : path;
  return { url: replacePathVariables(assembled, value.variable), query: explicitQuery };
}

function parseHeaders(value: unknown): HttpKeyValue[] {
  return postmanEntries(value).map((entry) => ({
    key: scalarString(entry.key),
    value: scalarString(entry.value),
    enabled: entry.disabled !== true,
  }));
}

function contentTypeFromHeaders(headers: HttpKeyValue[]): string | undefined {
  return headers.find((entry) => entry.enabled !== false && entry.key.toLowerCase() === 'content-type')?.value;
}

function contentTypeForRawLanguage(language: string): string | undefined {
  switch (language.toLowerCase()) {
    case 'json': return 'application/json';
    case 'xml': return 'application/xml';
    case 'html': return 'text/html';
    case 'javascript': return 'application/javascript';
    case 'text': return 'text/plain';
    default: return undefined;
  }
}

function parseBody(
  value: unknown,
  headers: HttpKeyValue[],
  path: string,
  warnings: ApiClientImportWarning[],
): Pick<HttpRequestDraft, 'body' | 'contentType' | 'bodyMode' | 'urlencoded' | 'formData' | 'binary' | 'graphql'> {
  const headerContentType = contentTypeFromHeaders(headers);
  if (!isRecord(value) || !value.mode) return { body: '', contentType: headerContentType || 'application/json', bodyMode: 'none' };
  const mode = scalarString(value.mode);

  if (mode === 'raw') {
    const options = isRecord(value.options) && isRecord(value.options.raw) ? value.options.raw : undefined;
    const language = options ? scalarString(options.language) : '';
    return {
      body: scalarString(value.raw),
      contentType: headerContentType || contentTypeForRawLanguage(language) || 'text/plain',
      bodyMode: language.toLowerCase() === 'json' ? 'json' : 'raw',
    };
  }

  if (mode === 'urlencoded') {
    const fields = postmanEntries(value.urlencoded).map((field) => ({ key: scalarString(field.key), value: scalarString(field.value), enabled: field.disabled !== true }));
    return {
      body: '',
      bodyMode: 'urlencoded',
      urlencoded: fields,
      contentType: headerContentType || 'application/x-www-form-urlencoded',
    };
  }

  if (mode === 'graphql') {
    const graphql = isRecord(value.graphql) ? value.graphql : {};
    const rawVariables = scalarString(graphql.variables);
    return {
      body: '',
      bodyMode: 'graphql',
      graphql: { query: scalarString(graphql.query), variables: rawVariables },
      contentType: headerContentType || 'application/json',
    };
  }

  if (mode === 'formdata') {
    const fields = postmanEntries(value.formdata).map((field) => {
      const type = scalarString(field.type) === 'file' ? 'file' as const : 'text' as const;
      const rawSource = Array.isArray(field.src) ? field.src.map(scalarString).filter(Boolean).join(', ') : scalarString(field.src);
      return {
        key: scalarString(field.key),
        value: type === 'text' ? scalarString(field.value) : '',
        enabled: field.disabled !== true,
        type,
        ...(type === 'file' && rawSource ? { fileName: rawSource } : {}),
        ...(typeof field.contentType === 'string' ? { contentType: field.contentType } : {}),
      };
    });
    const fileFields = fields.filter((field) => field.type === 'file');
    if (fileFields.length > 0) warning(
      warnings,
      'postman-body-formdata-files',
      path,
      'Multipart file fields were preserved, but exported local file paths cannot be reopened by the browser. Re-select those files before sending.',
    );
    return {
      body: '',
      bodyMode: 'formdata',
      formData: fields,
      contentType: headerContentType,
    };
  }

  if (mode === 'file') {
    const source = isRecord(value.file) ? scalarString(value.file.src) : scalarString(value.src);
    warning(warnings, 'postman-body-file', path, source
      ? `Postman binary file body "${source}" was preserved as intent, but browser security requires re-selecting the file before sending.`
      : 'Postman binary file body requires selecting the file again in FlexDoc before sending.');
    return {
      body: '',
      contentType: headerContentType || 'application/octet-stream',
      bodyMode: 'binary',
      binary: { fileName: source || undefined, contentType: headerContentType || 'application/octet-stream' },
    };
  }

  warning(warnings, 'postman-body-unsupported', path, `Postman body mode "${mode}" is not supported; the request body was left empty.`);
  return { body: '', contentType: headerContentType || 'application/octet-stream', bodyMode: 'none' };
}

function importRequest(
  value: unknown,
  name: string,
  collectionId: string,
  folderId: string | undefined,
  scripts: ScriptBundle,
  timestamp: string,
  path: string,
  warnings: ApiClientImportWarning[],
): ApiClientSavedRequest | null {
  const request = typeof value === 'string' ? { method: 'GET', url: value } : value;
  if (!isRecord(request)) {
    warning(warnings, 'postman-request-invalid', path, 'Skipped an invalid Postman request entry.');
    return null;
  }
  const method = scalarString(request.method).trim().toUpperCase() || 'GET';
  const parsedUrl = parseUrl(request.url);
  const headers = parseHeaders(request.header);
  const body = parseBody(request.body, headers, `${path}.body`, warnings);
  const draft: HttpRequestDraft = {
    method,
    url: parsedUrl.url,
    query: parsedUrl.query,
    headers,
    body: body.body,
    contentType: body.contentType,
    bodyMode: body.bodyMode,
    urlencoded: body.urlencoded,
    formData: body.formData,
    binary: body.binary,
    graphql: body.graphql,
    auth: parsePostmanAuth(request.auth, { type: 'inherit' }, `${path}.auth`, warnings),
  };
  const importedScripts = savedScripts(scripts);
  return {
    id: createApiClientId('request'),
    collectionId,
    folderId,
    name: name.trim() || `${method} ${parsedUrl.url || 'request'}`,
    request: draft,
    ...(importedScripts ? { scripts: importedScripts } : {}),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function importItems(options: {
  items: unknown;
  collectionId: string;
  parentFolderId?: string;
  inheritedScripts: ScriptBundle;
  timestamp: string;
  path: string;
  folders: ApiClientFolder[];
  requests: ApiClientSavedRequest[];
  warnings: ApiClientImportWarning[];
}): void {
  if (!Array.isArray(options.items)) return;
  options.items.forEach((itemValue, index) => {
    const itemPath = `${options.path}[${index}]`;
    if (!isRecord(itemValue)) {
      warning(options.warnings, 'postman-item-invalid', itemPath, 'Skipped an invalid Postman item.');
      return;
    }
    const name = scalarString(itemValue.name) || 'Untitled';
    const localScripts = parseEvents(itemValue.event, `${itemPath}.event`, options.warnings);
    const inheritedScripts = combineScripts(options.inheritedScripts, localScripts);

    if (Array.isArray(itemValue.item)) {
      const folderId = createApiClientId('folder');
      options.folders.push({
        id: folderId,
        collectionId: options.collectionId,
        parentFolderId: options.parentFolderId,
        name,
        auth: parsePostmanAuth(itemValue.auth, { type: 'inherit' }, `${itemPath}.auth`, options.warnings),
        createdAt: options.timestamp,
        updatedAt: options.timestamp,
      });
      importItems({
        ...options,
        items: itemValue.item,
        parentFolderId: folderId,
        inheritedScripts,
        path: `${itemPath}.item`,
      });
      return;
    }

    const imported = importRequest(
      itemValue.request,
      name,
      options.collectionId,
      options.parentFolderId,
      inheritedScripts,
      options.timestamp,
      `${itemPath}.request`,
      options.warnings,
    );
    if (imported) options.requests.push(imported);
  });
}

export function importPostmanCollection(value: unknown): PostmanCollectionImportResult {
  if (!isRecord(value) || !isRecord(value.info) || !Array.isArray(value.item)) {
    throw new Error('This JSON is not a Postman collection. Expected info and item fields.');
  }
  const name = scalarString(value.info.name).trim();
  if (!name) throw new Error('Postman collection info.name is required.');

  const warnings: ApiClientImportWarning[] = [];
  const schema = scalarString(value.info.schema);
  if (schema && !schema.includes('/v2.1.0/')) {
    warning(warnings, 'postman-schema-version', 'info.schema', `Collection schema "${schema}" is not Postman v2.1; FlexDoc imported the compatible fields it recognized.`);
  }

  const timestamp = new Date().toISOString();
  const collectionId = createApiClientId('collection');
  const collection: ApiClientCollection = {
    id: collectionId,
    name,
    auth: parsePostmanAuth(value.auth, { type: 'none' }, 'auth', warnings),
    variables: parseVariables(value.variable, 'variable', warnings),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const folders: ApiClientFolder[] = [];
  const requests: ApiClientSavedRequest[] = [];
  importItems({
    items: value.item,
    collectionId,
    inheritedScripts: parseEvents(value.event, 'event', warnings),
    timestamp,
    path: 'item',
    folders,
    requests,
    warnings,
  });
  return { collection, folders, requests, warnings };
}

export function importPostmanEnvironment(value: unknown): PostmanEnvironmentImportResult {
  if (!isRecord(value) || !Array.isArray(value.values) || typeof value.name !== 'string') {
    throw new Error('This JSON is not a Postman environment. Expected name and values fields.');
  }
  const scope = scalarString(value._postman_variable_scope).toLowerCase();
  if (scope && scope !== 'environment') throw new Error(`Postman variable scope "${scope}" is not an environment.`);
  const warnings: ApiClientImportWarning[] = [];
  const timestamp = new Date().toISOString();
  return {
    environment: {
      id: createApiClientId('environment'),
      name: value.name.trim() || 'Imported environment',
      variables: parseVariables(value.values, 'values', warnings),
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    warnings,
  };
}

export function importPostmanDocument(value: unknown): PostmanDocumentImportResult {
  if (isRecord(value) && isRecord(value.info) && Array.isArray(value.item)) {
    return { kind: 'collection', result: importPostmanCollection(value) };
  }
  if (isRecord(value) && Array.isArray(value.values) && typeof value.name === 'string') {
    return { kind: 'environment', result: importPostmanEnvironment(value) };
  }
  throw new Error('Unsupported Postman JSON. Import a collection v2.1 JSON file or an exported environment JSON file.');
}

function hasPristineDefaultCollection(workspace: ApiClientWorkspaceState): boolean {
  if (workspace.collections.length !== 1 || workspace.folders.length !== 0 || workspace.requests.length !== 0) return false;
  const collection = workspace.collections[0];
  return collection.name === 'My Collection'
    && collection.auth.type === 'none'
    && collection.variables.length === 0;
}

export function mergePostmanCollectionImport(
  workspace: ApiClientWorkspaceState,
  imported: PostmanCollectionImportResult,
): ApiClientWorkspaceState {
  const collections = hasPristineDefaultCollection(workspace) ? [] : workspace.collections;
  return {
    ...workspace,
    collections: [...collections, imported.collection],
    folders: [...workspace.folders, ...imported.folders],
    requests: [...workspace.requests, ...imported.requests],
  };
}

export function mergePostmanEnvironmentImport(
  workspace: ApiClientWorkspaceState,
  imported: PostmanEnvironmentImportResult,
): ApiClientWorkspaceState {
  return {
    ...workspace,
    environments: [...workspace.environments, imported.environment],
    activeEnvironmentId: workspace.activeEnvironmentId || imported.environment.id,
  };
}
