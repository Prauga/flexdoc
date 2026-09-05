import type { HttpOAuth2Auth } from './http-client';
import { buildOAuth2AuthorizationUrl, obtainOAuth2AccessToken, refreshOAuth2AccessToken } from './api-client-oauth';

function fakeOAuthWindow(callback: (authorizationUrl: URL) => string): Window {
  const target = {
    location: { href: 'https://docs.example.test/client', origin: 'https://docs.example.test' },
    open: (rawUrl: string | URL) => {
      const popup = {
        closed: false,
        location: { href: callback(new URL(String(rawUrl))) },
        close() { popup.closed = true; },
      };
      return popup as unknown as Window;
    },
  };
  return target as unknown as Window;
}

describe('API Client OAuth grant helpers', () => {
  test('builds authorization-code URLs with PKCE and requested scopes', () => {
    const auth: HttpOAuth2Auth = {
      type: 'oauth2',
      accessToken: '',
      grantType: 'authorizationCode',
      authorizationUrl: 'https://identity.example.test/authorize?audience=api',
      clientId: 'client-123',
      scopes: ['pets.read', 'pets.write'],
    };
    const url = new URL(buildOAuth2AuthorizationUrl(auth, 'state-1', 'https://docs.example.test/oauth', 'challenge-1'));
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('client_id')).toBe('client-123');
    expect(url.searchParams.get('redirect_uri')).toBe('https://docs.example.test/oauth');
    expect(url.searchParams.get('scope')).toBe('pets.read pets.write');
    expect(url.searchParams.get('state')).toBe('state-1');
    expect(url.searchParams.get('code_challenge')).toBe('challenge-1');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('audience')).toBe('api');
  });

  test('exchanges client credentials in the request body by default and keeps refresh tokens', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), init });
      return new Response(JSON.stringify({ access_token: 'issued-token', refresh_token: 'refresh-1', expires_in: 3600 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;
    const auth: HttpOAuth2Auth = {
      type: 'oauth2',
      accessToken: '',
      grantType: 'clientCredentials',
      tokenUrl: 'https://identity.example.test/token',
      clientId: 'client-123',
      clientSecret: 'secret-456',
      scopes: ['pets.read'],
    };
    const result = await obtainOAuth2AccessToken(auth, { fetchImpl });
    expect(result).toMatchObject({ accessToken: 'issued-token', refreshToken: 'refresh-1', expiresIn: 3600 });
    expect(calls[0].url).toBe('https://identity.example.test/token');
    const body = new URLSearchParams(String(calls[0].init?.body));
    expect(body.get('grant_type')).toBe('client_credentials');
    expect(body.get('client_id')).toBe('client-123');
    expect(body.get('client_secret')).toBe('secret-456');
    expect(body.get('scope')).toBe('pets.read');
    expect(new Headers(calls[0].init?.headers).get('Authorization')).toBeNull();
  });

  test('can authenticate the token request with HTTP Basic instead of body credentials', async () => {
    let init: RequestInit | undefined;
    const fetchImpl = (async (_input: RequestInfo | URL, next?: RequestInit) => {
      init = next;
      return new Response(JSON.stringify({ access_token: 'issued-token' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;
    const auth: HttpOAuth2Auth = {
      type: 'oauth2',
      accessToken: '',
      grantType: 'clientCredentials',
      tokenUrl: 'https://identity.example.test/token',
      clientId: 'client-123',
      clientSecret: 'secret-456',
      clientAuthentication: 'basic',
    };
    await obtainOAuth2AccessToken(auth, { fetchImpl });
    const body = new URLSearchParams(String(init?.body));
    expect(body.get('client_id')).toBeNull();
    expect(body.get('client_secret')).toBeNull();
    expect(new Headers(init?.headers).get('Authorization')).toBe('Basic Y2xpZW50LTEyMzpzZWNyZXQtNDU2');
  });

  test('completes an authorization-code popup and exchanges the code with PKCE', async () => {
    let tokenRequest: RequestInit | undefined;
    const fetchImpl = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      tokenRequest = init;
      return new Response(JSON.stringify({ access_token: 'code-token', refresh_token: 'refresh-code' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;
    const windowObject = fakeOAuthWindow((authorizationUrl) => {
      expect(authorizationUrl.searchParams.get('response_type')).toBe('code');
      expect(authorizationUrl.searchParams.get('code_challenge_method')).toBe('S256');
      const state = authorizationUrl.searchParams.get('state') || '';
      return `https://docs.example.test/oauth/callback?code=code-123&state=${encodeURIComponent(state)}`;
    });
    const auth: HttpOAuth2Auth = {
      type: 'oauth2',
      accessToken: '',
      grantType: 'authorizationCode',
      authorizationUrl: 'https://identity.example.test/authorize',
      tokenUrl: 'https://identity.example.test/token',
      clientId: 'client-123',
      clientSecret: 'secret-456',
      clientAuthentication: 'basic',
      redirectUri: 'https://docs.example.test/oauth/callback',
      scopes: ['pets.read'],
    };
    const result = await obtainOAuth2AccessToken(auth, { fetchImpl, windowObject, pollIntervalMs: 0 });
    expect(result).toMatchObject({ accessToken: 'code-token', refreshToken: 'refresh-code' });
    const body = new URLSearchParams(String(tokenRequest?.body));
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('code')).toBe('code-123');
    expect(body.get('redirect_uri')).toBe('https://docs.example.test/oauth/callback');
    expect(body.get('code_verifier')).toBeTruthy();
    expect(body.get('client_id')).toBeNull();
    expect(new Headers(tokenRequest?.headers).get('Authorization')).toBe('Basic Y2xpZW50LTEyMzpzZWNyZXQtNDU2');
  });

  test('completes an implicit popup response without calling the token endpoint', async () => {
    let fetchCalled = false;
    const fetchImpl = (async () => {
      fetchCalled = true;
      throw new Error('token endpoint should not be called');
    }) as typeof fetch;
    const windowObject = fakeOAuthWindow((authorizationUrl) => {
      expect(authorizationUrl.searchParams.get('response_type')).toBe('token');
      const state = authorizationUrl.searchParams.get('state') || '';
      return `https://docs.example.test/oauth/callback#access_token=implicit-token&token_type=Bearer&expires_in=120&scope=pets.read&state=${encodeURIComponent(state)}`;
    });
    const auth: HttpOAuth2Auth = {
      type: 'oauth2',
      accessToken: '',
      grantType: 'implicit',
      authorizationUrl: 'https://identity.example.test/authorize',
      clientId: 'client-123',
      redirectUri: 'https://docs.example.test/oauth/callback',
      scopes: ['pets.read'],
    };
    const result = await obtainOAuth2AccessToken(auth, { fetchImpl, windowObject, pollIntervalMs: 0 });
    expect(result).toEqual({ accessToken: 'implicit-token', tokenType: 'Bearer', expiresIn: 120, scope: 'pets.read' });
    expect(fetchCalled).toBe(false);
  });

  test('refreshes an issued OAuth token', async () => {
    let body = '';
    const fetchImpl = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      body = String(init?.body || '');
      return new Response(JSON.stringify({ access_token: 'refreshed-token' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;
    const auth: HttpOAuth2Auth = {
      type: 'oauth2',
      accessToken: 'old-token',
      grantType: 'authorizationCode',
      tokenUrl: 'https://identity.example.test/token',
      clientId: 'client-123',
      refreshToken: 'refresh-1',
    };
    const result = await refreshOAuth2AccessToken(auth, { fetchImpl });
    expect(result.accessToken).toBe('refreshed-token');
    const params = new URLSearchParams(body);
    expect(params.get('grant_type')).toBe('refresh_token');
    expect(params.get('refresh_token')).toBe('refresh-1');
  });
});
