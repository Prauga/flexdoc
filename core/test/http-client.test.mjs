import assert from 'node:assert/strict';
import test from 'node:test';
import { buildHttpRequest, requestDraftFromBuiltRequest } from '../dist/index.js';

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
      { key: 'Content-Type', value: 'application/json' },
    ],
    body: '{"ok":true}',
    contentType: 'text/plain',
  });

  assert.equal(request.method, 'POST');
  assert.equal(request.url, 'https://api.example.test/search?existing=1&tag=one&tag=two#frag');
  assert.equal(request.headers['X-Trace'], 'abc');
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

test('round-trips a built request into an editable draft', () => {
  const built = buildHttpRequest({
    method: 'PATCH',
    url: 'https://api.example.test/pets/42',
    headers: [{ key: 'Content-Type', value: 'application/json' }],
    body: '{"name":"Mochi"}',
  });
  const draft = requestDraftFromBuiltRequest(built);
  assert.equal(draft.method, 'PATCH');
  assert.equal(draft.url, built.url);
  assert.equal(draft.contentType, 'application/json');
  assert.deepEqual(draft.headers, [{ key: 'Content-Type', value: 'application/json' }]);
});
