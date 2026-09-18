import type { HttpAuth } from './http-client';

/** Clone auth configuration while clearing credential material before browser persistence. */
export function sanitizeApiClientAuthCredentials(auth: HttpAuth | undefined): HttpAuth | undefined {
  if (!auth) return undefined;
  if (auth.type === 'bearer') return { ...auth, token: '' };
  if (auth.type === 'oauth2') return {
    ...auth,
    accessToken: '',
    ...(auth.clientSecret !== undefined ? { clientSecret: '' } : {}),
    ...(auth.password !== undefined ? { password: '' } : {}),
    ...(auth.refreshToken !== undefined ? { refreshToken: '' } : {}),
    scopes: auth.scopes ? [...auth.scopes] : undefined,
  };
  if (auth.type === 'basic' || auth.type === 'digest' || auth.type === 'ntlm') return { ...auth, password: '' };
  if (auth.type === 'apiKey') return { ...auth, value: '' };
  if (auth.type === 'hawk') return { ...auth, key: '' };
  if (auth.type === 'oauth1') return { ...auth, consumerSecret: '', ...(auth.token !== undefined ? { token: '' } : {}), ...(auth.tokenSecret !== undefined ? { tokenSecret: '' } : {}) };
  if (auth.type === 'awsv4') return { ...auth, secretKey: '', ...(auth.sessionToken !== undefined ? { sessionToken: '' } : {}) };
  return { ...auth };
}
