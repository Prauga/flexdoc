import assert from 'node:assert/strict';
import test from 'node:test';
import {
  HOST_EXECUTION_TARGET_POLICY_INVARIANTS,
  createHostExecutionTargetPolicy,
  isHostExecutionOriginAllowed,
  normalizeHostExecutionAllowedOrigins,
  normalizeHostExecutionOrigin,
} from '../dist/index.js';

test('normalizes exact HTTP(S) origins and rejects non-HTTP targets', () => {
  assert.equal(normalizeHostExecutionOrigin('HTTPS://API.EXAMPLE.TEST:443/v1?x=1#fragment'), 'https://api.example.test');
  assert.equal(normalizeHostExecutionOrigin('http://api.example.test:80/path'), 'http://api.example.test');
  assert.equal(normalizeHostExecutionOrigin('http://api.example.test:8080/path'), 'http://api.example.test:8080');
  assert.equal(normalizeHostExecutionOrigin('ftp://api.example.test/resource'), undefined);
  assert.equal(normalizeHostExecutionOrigin('not a URL'), undefined);
});

test('deduplicates configured origins without widening them to hostnames', () => {
  assert.deepEqual(
    normalizeHostExecutionAllowedOrigins([
      'https://api.example.test/v1',
      'https://api.example.test:443/v2',
      'https://api.example.test:8443/v1',
      'ftp://api.example.test',
    ]),
    ['https://api.example.test', 'https://api.example.test:8443'],
  );
});

test('exposes the backend-native security invariants as a portable core policy', () => {
  const policy = createHostExecutionTargetPolicy({ allowedOrigins: ['https://api.example.test/v1'] });

  assert.deepEqual(policy.allowedOrigins, ['https://api.example.test']);
  assert.deepEqual(policy.allowedProtocols, ['http:', 'https:']);
  assert.equal(policy.redirectPolicy, 'same-origin-only');
  assert.equal(policy.embeddedCredentialsPolicy, 'deny');
  assert.equal(policy.resolvedAddressPolicy, 'deny-link-local-and-cloud-metadata');
  assert.equal(HOST_EXECUTION_TARGET_POLICY_INVARIANTS.redirectPolicy, policy.redirectPolicy);

  assert.equal(isHostExecutionOriginAllowed('https://api.example.test/orders', policy), true);
  assert.equal(isHostExecutionOriginAllowed('https://api.example.test:8443/orders', policy), false);
  assert.equal(isHostExecutionOriginAllowed('http://api.example.test/orders', policy), false);
  assert.equal(isHostExecutionOriginAllowed('ftp://api.example.test/orders', policy), false);
});
