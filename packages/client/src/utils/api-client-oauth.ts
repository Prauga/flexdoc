import type { HttpOAuth2Auth } from './http-client';

export interface OAuth2TokenResult {
  accessToken: string;
  refreshToken?: string;
  tokenType?: string;
  expiresIn?: number;
  scope?: string;
}

export interface OAuth2AuthorizationRequest {
  url: string;
  state: string;
  redirectUri: string;
  codeVerifier?: string;
}

export interface OAuth2ExecutionOptions {
  fetchImpl?: typeof fetch;
  windowObject?: Window;
  popupTimeoutMs?: number;
  pollIntervalMs?: number;
}

function requireValue(value: string | undefined, label: string): string {
  const normalized = value?.trim();
  if (!normalized) throw new Error(`${label} is required for this OAuth flow.`);
  return normalized;
}

function scopeValue(auth: HttpOAuth2Auth): string {
  return (auth.scopes || []).map((scope) => scope.trim()).filter(Boolean).join(' ');
}

function encodeBasicCredential(value: string): string {
  if (typeof TextEncoder === 'undefined') throw new Error('OAuth Basic client authentication requires UTF-8 encoding support.');
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const buffer = (globalThis as typeof globalThis & {
    Buffer?: { from(value: string, encoding: string): { toString(encoding: string): string } };
  }).Buffer;
  const encoded = typeof btoa === 'function'
    ? btoa(binary)
    : buffer?.from(binary, 'binary').toString('base64');
  if (!encoded) throw new Error('OAuth Basic client authentication requires Base64 support in this runtime.');
  return encoded;
}

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const buffer = (globalThis as typeof globalThis & {
    Buffer?: { from(value: string, encoding: string): { toString(encoding: string): string } };
  }).Buffer;
  const encoded = typeof btoa === 'function'
    ? btoa(binary)
    : buffer?.from(binary, 'binary').toString('base64');
  if (!encoded) throw new Error('OAuth PKCE requires Base64 support in this runtime.');
  return encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function randomUrlSafe(byteLength = 32): string {
  if (!globalThis.crypto?.getRandomValues) throw new Error('OAuth requires cryptographic random-number support.');
  const bytes = new Uint8Array(byteLength);
  globalThis.crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

async function pkceChallenge(verifier: string): Promise<string> {
  if (!globalThis.crypto?.subtle || typeof TextEncoder === 'undefined') {
    throw new Error('OAuth authorization-code flow requires Web Crypto PKCE support.');
  }
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64Url(new Uint8Array(digest));
}

export function buildOAuth2AuthorizationUrl(
  auth: HttpOAuth2Auth,
  state: string,
  redirectUri: string,
  codeChallenge?: string,
): string {
  const authorizationUrl = requireValue(auth.authorizationUrl, 'Authorization URL');
  const clientId = requireValue(auth.clientId, 'Client ID');
  const url = new URL(authorizationUrl);
  const grantType = auth.grantType || 'accessToken';
  url.searchParams.set('response_type', grantType === 'implicit' ? 'token' : 'code');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);
  const scopes = scopeValue(auth);
  if (scopes) url.searchParams.set('scope', scopes);
  if (codeChallenge) {
    url.searchParams.set('code_challenge', codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
  }
  return url.toString();
}

function defaultRedirectUri(windowObject: Window): string {
  const url = new URL(windowObject.location.href);
  url.search = '';
  url.hash = '';
  return url.toString();
}

export async function createOAuth2AuthorizationRequest(
  auth: HttpOAuth2Auth,
  windowObject?: Window,
): Promise<OAuth2AuthorizationRequest> {
  const targetWindow = windowObject ?? (typeof window === 'undefined' ? undefined : window);
  if (!targetWindow) throw new Error('Interactive OAuth requires a browser window.');
  const redirectUri = auth.redirectUri?.trim() || defaultRedirectUri(targetWindow);
  if (new URL(redirectUri).origin !== targetWindow.location.origin) {
    throw new Error('Interactive OAuth redirect URI must use the same origin as the FlexDoc page so the popup result can be read.');
  }
  const state = randomUrlSafe(24);
  if ((auth.grantType || 'accessToken') === 'implicit') {
    return { url: buildOAuth2AuthorizationUrl(auth, state, redirectUri), state, redirectUri };
  }
  const codeVerifier = randomUrlSafe(48);
  const challenge = await pkceChallenge(codeVerifier);
  return {
    url: buildOAuth2AuthorizationUrl(auth, state, redirectUri, challenge),
    state,
    redirectUri,
    codeVerifier,
  };
}

async function parseTokenResponse(response: Response): Promise<OAuth2TokenResult> {
  const text = await response.text();
  let payload: Record<string, unknown>;
  try {
    payload = text ? JSON.parse(text) as Record<string, unknown> : {};
  } catch {
    payload = Object.fromEntries(new URLSearchParams(text));
  }
  if (!response.ok) {
    const message = String(payload.error_description || payload.error || `OAuth token endpoint returned ${response.status}`);
    throw new Error(message);
  }
  const accessToken = typeof payload.access_token === 'string' ? payload.access_token : '';
  if (!accessToken) throw new Error('OAuth token endpoint did not return access_token.');
  const expiresRaw = payload.expires_in;
  const expiresIn = typeof expiresRaw === 'number'
    ? expiresRaw
    : typeof expiresRaw === 'string' && expiresRaw.trim() !== '' && Number.isFinite(Number(expiresRaw))
      ? Number(expiresRaw)
      : undefined;
  return {
    accessToken,
    refreshToken: typeof payload.refresh_token === 'string' ? payload.refresh_token : undefined,
    tokenType: typeof payload.token_type === 'string' ? payload.token_type : undefined,
    expiresIn,
    scope: typeof payload.scope === 'string' ? payload.scope : undefined,
  };
}

async function postToken(
  auth: HttpOAuth2Auth,
  body: URLSearchParams,
  fetchImpl: typeof fetch,
): Promise<OAuth2TokenResult> {
  const tokenUrl = requireValue(auth.tokenUrl, 'Token URL');
  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
    Accept: 'application/json',
  };
  const clientId = auth.clientId?.trim();
  if ((auth.clientAuthentication || 'body') === 'basic' && clientId) {
    headers.Authorization = `Basic ${encodeBasicCredential(`${clientId}:${auth.clientSecret || ''}`)}`;
  } else {
    if (clientId) body.set('client_id', clientId);
    if (auth.clientSecret) body.set('client_secret', auth.clientSecret);
  }
  const response = await fetchImpl(tokenUrl, {
    method: 'POST',
    headers,
    body: body.toString(),
  });
  return parseTokenResponse(response);
}

async function popupRedirect(
  request: OAuth2AuthorizationRequest,
  options: OAuth2ExecutionOptions,
): Promise<URL> {
  const targetWindow = options.windowObject ?? (typeof window === 'undefined' ? undefined : window);
  if (!targetWindow) throw new Error('Interactive OAuth requires a browser window.');
  const popup = targetWindow.open(request.url, 'flexdoc-oauth', 'popup,width=640,height=760');
  if (!popup) throw new Error('OAuth popup was blocked. Allow popups for this documentation origin and try again.');
  const redirect = new URL(request.redirectUri);
  const startedAt = Date.now();
  const timeout = options.popupTimeoutMs ?? 120000;
  const poll = options.pollIntervalMs ?? 200;
  while (Date.now() - startedAt < timeout) {
    if (popup.closed) throw new Error('OAuth popup was closed before authorization completed.');
    try {
      const candidate = new URL(popup.location.href);
      if (candidate.origin === redirect.origin && candidate.pathname === redirect.pathname) {
        popup.close();
        return candidate;
      }
    } catch {
      // The provider is cross-origin until it redirects back to the configured callback.
    }
    await new Promise((resolve) => setTimeout(resolve, poll));
  }
  popup.close();
  throw new Error('OAuth authorization timed out.');
}

export async function obtainOAuth2AccessToken(
  auth: HttpOAuth2Auth,
  options: OAuth2ExecutionOptions = {},
): Promise<OAuth2TokenResult> {
  const grantType = auth.grantType || 'accessToken';
  const fetchImpl = options.fetchImpl ?? fetch;
  if (grantType === 'accessToken') {
    const accessToken = requireValue(auth.accessToken, 'Access token');
    return { accessToken };
  }
  if (grantType === 'clientCredentials') {
    const body = new URLSearchParams({ grant_type: 'client_credentials' });
    const scopes = scopeValue(auth);
    if (scopes) body.set('scope', scopes);
    return postToken(auth, body, fetchImpl);
  }
  if (grantType === 'password') {
    const body = new URLSearchParams({
      grant_type: 'password',
      username: requireValue(auth.username, 'Username'),
      password: auth.password || '',
    });
    const scopes = scopeValue(auth);
    if (scopes) body.set('scope', scopes);
    return postToken(auth, body, fetchImpl);
  }

  const authorization = await createOAuth2AuthorizationRequest(auth, options.windowObject);
  const callback = await popupRedirect(authorization, options);
  const callbackState = callback.searchParams.get('state') || new URLSearchParams(callback.hash.replace(/^#/, '')).get('state');
  if (callbackState !== authorization.state) throw new Error('OAuth state mismatch; authorization response was rejected.');
  const errorParams = new URLSearchParams(callback.hash.replace(/^#/, ''));
  const oauthError = callback.searchParams.get('error') || errorParams.get('error');
  if (oauthError) {
    const description = callback.searchParams.get('error_description') || errorParams.get('error_description');
    throw new Error(description || oauthError);
  }

  if (grantType === 'implicit') {
    const accessToken = errorParams.get('access_token') || '';
    if (!accessToken) throw new Error('OAuth implicit response did not include access_token.');
    return {
      accessToken,
      tokenType: errorParams.get('token_type') || undefined,
      expiresIn: errorParams.get('expires_in') ? Number(errorParams.get('expires_in')) : undefined,
      scope: errorParams.get('scope') || undefined,
    };
  }

  const code = callback.searchParams.get('code');
  if (!code) throw new Error('OAuth authorization response did not include code.');
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: authorization.redirectUri,
  });
  if (authorization.codeVerifier) body.set('code_verifier', authorization.codeVerifier);
  return postToken(auth, body, fetchImpl);
}

export async function refreshOAuth2AccessToken(
  auth: HttpOAuth2Auth,
  options: OAuth2ExecutionOptions = {},
): Promise<OAuth2TokenResult> {
  const refreshToken = requireValue(auth.refreshToken, 'Refresh token');
  const body = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken });
  const scopes = scopeValue(auth);
  if (scopes) body.set('scope', scopes);
  return postToken(auth, body, options.fetchImpl ?? fetch);
}
