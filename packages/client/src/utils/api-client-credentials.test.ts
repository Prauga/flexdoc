import { sanitizeApiClientAuthCredentials } from './api-client-credentials';
import type { HttpAuth } from './http-client';

const cases: Array<[string, HttpAuth, Record<string, unknown>]> = [
  ['bearer', { type: 'bearer', token: 'secret' }, { token: '' }],
  ['oauth2', { type: 'oauth2', accessToken: 'access', clientId: 'client', clientSecret: 'secret', password: 'password', refreshToken: 'refresh', scopes: ['read'] }, { accessToken: '', clientId: 'client', clientSecret: '', password: '', refreshToken: '', scopes: ['read'] }],
  ['basic', { type: 'basic', username: 'alice', password: 'secret' }, { username: 'alice', password: '' }],
  ['apiKey', { type: 'apiKey', key: 'X-Key', value: 'secret', in: 'header' }, { key: 'X-Key', value: '', in: 'header' }],
  ['digest', { type: 'digest', username: 'alice', password: 'secret' }, { username: 'alice', password: '' }],
  ['hawk', { type: 'hawk', id: 'client', key: 'secret', algorithm: 'sha256' }, { id: 'client', key: '', algorithm: 'sha256' }],
  ['ntlm', { type: 'ntlm', username: 'alice', password: 'secret', domain: 'EXAMPLE' }, { username: 'alice', password: '', domain: 'EXAMPLE' }],
  ['oauth1', { type: 'oauth1', consumerKey: 'consumer', consumerSecret: 'secret', token: 'token', tokenSecret: 'token-secret', realm: 'realm' }, { consumerKey: 'consumer', consumerSecret: '', token: '', tokenSecret: '', realm: 'realm' }],
  ['awsv4', { type: 'awsv4', accessKey: 'AKIAEXAMPLE', secretKey: 'secret', sessionToken: 'session', region: 'us-east-1', service: 'execute-api' }, { accessKey: 'AKIAEXAMPLE', secretKey: '', sessionToken: '', region: 'us-east-1', service: 'execute-api' }],
];

describe('API Client credential sanitization', () => {
  it.each(cases)('clears %s credential material without dropping configuration', (_name, auth, expected) => {
    expect(sanitizeApiClientAuthCredentials(auth)).toMatchObject(expected);
  });

  it('preserves none and inherit semantics', () => {
    expect(sanitizeApiClientAuthCredentials({ type: 'none' })).toEqual({ type: 'none' });
    expect(sanitizeApiClientAuthCredentials({ type: 'inherit' })).toEqual({ type: 'inherit' });
  });
});
