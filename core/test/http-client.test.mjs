import assert from 'node:assert/strict';
import test from 'node:test';
import { buildHttpRequest, requestDraftFromBuiltRequest, resolveHttpRequestDraftVariables } from '../dist/index.js';

test('builds arbitrary HTTP requests with duplicate query params and headers', () => {
  const request = buildHttpRequest({
    method: 'post',
    url: 'https://api.example.test/search?existing=1#frag',
    query: [
      { key: 'tag', value: 'one' },
      { key: 'tag', value: 'two' },
      { key: 'skip', value: 'x', enabled: false },
    ],
    headers: [
      { key: 'X-Trace', value: 'abc' },
      { key: 'X-Trace', value: 'def' },
      { key: 'Content-Type', value: 'application/json' },
    ],
    body: '{"ok":true}',
    contentType: 'text/plain',
  });

  assert.equal(request.method, 'POST');
  assert.equal(request.url, 'https://api.example.test/search?existing=1&tag=one&tag=two#frag');
  assert.deepEqual(request.headerEntries, [
    ['X-Trace', 'abc'],
    ['X-Trace', 'def'],
    ['Content-Type', 'application/json'],
  ]);
  assert.deepEqual(request.init.headers, request.headerEntries);
  assert.equal(request.headers['X-Trace'], 'def');
  assert.equal(request.headers['Content-Type'], 'application/json');
  assert.equal(request.bodyKind, 'json');
  assert.equal(request.body, '{"ok":true}');
});

test('applies common auth without coupling to OpenAPI', () => {
  const bearer = buildHttpRequest({ method: 'GET', url: 'https://api.example.test/pets', auth: { type: 'bearer', token: 'secret' } });
  assert.equal(bearer.headers.Authorization, 'Bearer secret');

  const apiKey = buildHttpRequest({
    method: 'GET',
    url: 'https://api.example.test/pets',
    auth: { type: 'apiKey', key: 'api_key', value: '123', in: 'query' },
  });
  assert.equal(apiKey.url, 'https://api.example.test/pets?api_key=123');
});

test('uses a real Base64 fallback for Basic auth when btoa is unavailable', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'btoa');
  Object.defineProperty(globalThis, 'btoa', { value: undefined, configurable: true });
  try {
    const request = buildHttpRequest({
      method: 'GET',
      url: 'https://api.example.test/pets',
      auth: { type: 'basic', username: 'alice', password: 'sëcret' },
    });
    assert.equal(request.headers.Authorization, `Basic ${Buffer.from('alice:sëcret', 'utf8').toString('base64')}`);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'btoa', descriptor);
    else delete globalThis.btoa;
  }
});

test('resolves environment variables across the canonical HTTP draft', () => {
  const draft = {
    method: '{{method}}',
    url: '{{ baseUrl }}/pets/{{petId}}',
    query: [{ key: '{{queryKey}}', value: '{{petId}}' }],
    headers: [{ key: 'X-{{headerName}}', value: '{{traceId}}' }],
    body: '{"name":"{{petName}}"}',
    contentType: '{{contentType}}',
    auth: { type: 'bearer', token: '{{token}}' },
  };
  const variables = {
    method: 'PATCH',
    baseUrl: 'https://api.example.test',
    petId: '42',
    queryKey: 'id',
    headerName: 'Trace',
    traceId: 'trace-42',
    petName: 'Mochi',
    contentType: 'application/json',
    token: 'secret',
  };

  const resolved = resolveHttpRequestDraftVariables(draft, variables);
  assert.equal(resolved.url, 'https://api.example.test/pets/42');
  assert.equal(resolved.auth.token, 'secret');
  assert.equal(draft.url, '{{ baseUrl }}/pets/{{petId}}');

  const request = buildHttpRequest(draft, { variables });
  assert.equal(request.method, 'PATCH');
  assert.equal(request.url, 'https://api.example.test/pets/42?id=42');
  assert.deepEqual(request.headerEntries, [
    ['X-Trace', 'trace-42'],
    ['Authorization', 'Bearer secret'],
    ['Content-Type', 'application/json'],
  ]);
  assert.equal(request.body, '{"name":"Mochi"}');
});

test('preserves explicit empty substitutions for method and URL', () => {
  const resolved = resolveHttpRequestDraftVariables(
    { method: '{{method}}', url: '{{url}}' },
    { method: '', url: '' },
  );
  assert.equal(resolved.method, '');
  assert.equal(resolved.url, '');
});

test('leaves unresolved environment placeholders intact', () => {
  const request = buildHttpRequest({ method: 'GET', url: '{{baseUrl}}/pets/{{petId}}' }, { variables: { baseUrl: 'https://api.example.test' } });
  assert.equal(request.url, 'https://api.example.test/pets/{{petId}}');
});

test('round-trips a built request into an editable draft without losing duplicate headers', () => {
  const built = buildHttpRequest({
    method: 'PATCH',
    url: 'https://api.example.test/pets/42',
    headers: [
      { key: 'X-Trace', value: 'one' },
      { key: 'X-Trace', value: 'two' },
      { key: 'Content-Type', value: 'application/json' },
    ],
    body: '{"name":"Mochi"}',
  });
  const draft = requestDraftFromBuiltRequest(built);
  assert.equal(draft.method, 'PATCH');
  assert.equal(draft.url, built.url);
  assert.equal(draft.contentType, 'application/json');
  assert.deepEqual(draft.headers, [
    { key: 'X-Trace', value: 'one' },
    { key: 'X-Trace', value: 'two' },
    { key: 'Content-Type', value: 'application/json' },
  ]);
});

test('round-trips ordered duplicate query parameters without duplicating them on rebuild', () => {
  const built = buildHttpRequest({
    method: 'GET',
    url: 'https://api.example.test/pets#results',
    query: [
      { key: 'limit', value: '10' },
      { key: 'limit', value: '20' },
      { key: 'search', value: 'red fox' },
      { key: 'empty', value: '' },
    ],
  });

  const draft = requestDraftFromBuiltRequest(built);
  assert.equal(draft.url, 'https://api.example.test/pets#results');
  assert.deepEqual(draft.query, [
    { key: 'limit', value: '10' },
    { key: 'limit', value: '20' },
    { key: 'search', value: 'red fox' },
    { key: 'empty', value: '' },
  ]);

  const rebuilt = buildHttpRequest(draft);
  assert.equal(rebuilt.url, built.url);
});


test('buildHttpRequest treats unresolved inherited auth as no auth', () => {
  const request = buildHttpRequest({
    method: 'GET',
    url: 'https://api.example.test/pets',
    auth: { type: 'inherit' },
  });
  assert.equal(request.headers.Authorization, undefined);
  assert.equal(request.url, 'https://api.example.test/pets');
});
