import React, { useState } from 'react';
import type { HttpAuth, HttpOAuth2Auth, HttpOAuth2GrantType } from '../utils/http-client';
import { obtainOAuth2AccessToken, refreshOAuth2AccessToken } from '../utils/api-client-oauth';

interface Props {
  auth: HttpAuth;
  label: string;
  allowInherit?: boolean;
  onChange: (auth: HttpAuth) => void;
  theme: 'light' | 'dark';
}

function authForType(type: HttpAuth['type']): HttpAuth {
  if (type === 'inherit') return { type: 'inherit' };
  if (type === 'bearer') return { type: 'bearer', token: '' };
  if (type === 'oauth2') return { type: 'oauth2', accessToken: '', grantType: 'accessToken', scopes: [] };
  if (type === 'basic') return { type: 'basic', username: '', password: '' };
  if (type === 'apiKey') return { type: 'apiKey', key: '', value: '', in: 'header' };
  return { type: 'none' };
}

function scopesFromInput(value: string): string[] {
  return value.split(/\s+/).map((scope) => scope.trim()).filter(Boolean);
}

export const OAuthEditor: React.FC<{
  auth: HttpOAuth2Auth;
  fieldClass: string;
  label: string;
  onChange: (auth: HttpOAuth2Auth) => void;
}> = ({ auth, fieldClass, label, onChange }) => {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const grantType = auth.grantType || 'accessToken';
  const popupGrant = grantType === 'authorizationCode' || grantType === 'implicit';
  const tokenGrant = grantType === 'authorizationCode' || grantType === 'clientCredentials' || grantType === 'password';
  const clientGrant = grantType !== 'accessToken';

  const acquire = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const result = await obtainOAuth2AccessToken(auth);
      onChange({
        ...auth,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken ?? auth.refreshToken,
      });
      setMessage(result.expiresIn ? `Access token acquired; expires in ${result.expiresIn}s.` : 'Access token acquired.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'OAuth authorization failed.');
    } finally {
      setBusy(false);
    }
  };

  const refresh = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const result = await refreshOAuth2AccessToken(auth);
      onChange({
        ...auth,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken ?? auth.refreshToken,
      });
      setMessage('Access token refreshed.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'OAuth token refresh failed.');
    } finally {
      setBusy(false);
    }
  };

  return <div className='space-y-2'>
    <select
      aria-label={label ? `${label} OAuth grant type` : 'OAuth grant type'}
      className={fieldClass}
      value={grantType}
      onChange={(event) => onChange({ ...auth, grantType: event.target.value as HttpOAuth2GrantType })}
    >
      <option value='accessToken'>Manual access token</option>
      <option value='authorizationCode'>Authorization Code + PKCE</option>
      <option value='clientCredentials'>Client Credentials</option>
      <option value='password'>Password grant (legacy)</option>
      <option value='implicit'>Implicit grant (legacy)</option>
    </select>

    {popupGrant && <input aria-label={label ? `${label} OAuth authorization URL` : 'OAuth authorization URL'} className={fieldClass} placeholder='Authorization URL' value={auth.authorizationUrl || ''} onChange={(event) => onChange({ ...auth, authorizationUrl: event.target.value })} />}
    {tokenGrant && <input aria-label={label ? `${label} OAuth token URL` : 'OAuth token URL'} className={fieldClass} placeholder='Token URL' value={auth.tokenUrl || ''} onChange={(event) => onChange({ ...auth, tokenUrl: event.target.value })} />}
    {clientGrant && <input aria-label={label ? `${label} OAuth client ID` : 'OAuth client ID'} className={fieldClass} placeholder='Client ID' value={auth.clientId || ''} onChange={(event) => onChange({ ...auth, clientId: event.target.value })} />}
    {(grantType === 'authorizationCode' || grantType === 'clientCredentials' || grantType === 'password') && <input aria-label={label ? `${label} OAuth client secret` : 'OAuth client secret'} type='password' autoComplete='off' className={fieldClass} placeholder={grantType === 'authorizationCode' ? 'Client secret (optional for PKCE/public clients)' : 'Client secret (optional)'} value={auth.clientSecret || ''} onChange={(event) => onChange({ ...auth, clientSecret: event.target.value })} />}
    {tokenGrant && <select aria-label={label ? `${label} OAuth client authentication` : 'OAuth client authentication'} className={fieldClass} value={auth.clientAuthentication || 'body'} onChange={(event) => onChange({ ...auth, clientAuthentication: event.target.value as 'body' | 'basic' })}>
      <option value='body'>Send client credentials in body</option>
      <option value='basic'>Send as Basic Auth header</option>
    </select>}
    {popupGrant && <input aria-label={label ? `${label} OAuth redirect URI` : 'OAuth redirect URI'} className={fieldClass} placeholder='Redirect URI (defaults to this page)' value={auth.redirectUri || ''} onChange={(event) => onChange({ ...auth, redirectUri: event.target.value })} />}
    {clientGrant && <input aria-label={label ? `${label} OAuth scopes` : 'OAuth scopes'} className={fieldClass} placeholder='Scopes separated by spaces' value={(auth.scopes || []).join(' ')} onChange={(event) => onChange({ ...auth, scopes: scopesFromInput(event.target.value) })} />}
    {grantType === 'password' && <div className='grid grid-cols-2 gap-2'>
      <input aria-label={label ? `${label} OAuth username` : 'OAuth username'} className={fieldClass} placeholder='Resource owner username' value={auth.username || ''} onChange={(event) => onChange({ ...auth, username: event.target.value })} />
      <input aria-label={label ? `${label} OAuth password` : 'OAuth password'} type='password' autoComplete='off' className={fieldClass} placeholder='Resource owner password' value={auth.password || ''} onChange={(event) => onChange({ ...auth, password: event.target.value })} />
    </div>}

    <input aria-label={label ? `${label} OAuth access token` : 'OAuth access token'} type='password' autoComplete='off' className={fieldClass} placeholder='Access token' value={auth.accessToken} onChange={(event) => onChange({ ...auth, accessToken: event.target.value })} />
    {grantType !== 'accessToken' && <div className='flex flex-wrap gap-2'>
      <button type='button' disabled={busy} onClick={acquire} className='rounded-md border px-2.5 py-1.5 text-xs font-medium disabled:opacity-60'>{busy ? 'Authorizing…' : 'Get access token'}</button>
      {auth.refreshToken && auth.tokenUrl && <button type='button' disabled={busy} onClick={refresh} className='rounded-md border px-2.5 py-1.5 text-xs font-medium disabled:opacity-60'>Refresh access token</button>}
    </div>}
    {grantType !== 'accessToken' && <p className='text-[11px] opacity-70'>Authorization Code uses PKCE. Popup callbacks must return to this page origin; token endpoints must allow browser CORS. Client secrets entered here are browser-visible and should only be used when the OAuth provider permits it.</p>}
    {message && <p role='status' className='text-xs'>{message}</p>}
  </div>;
};

export const ApiClientAuthEditor: React.FC<Props> = ({ auth, label, allowInherit = false, onChange, theme }) => {
  const inputClass = theme === 'dark' ? 'bg-gray-900 border-gray-700 text-gray-100' : 'bg-white border-gray-300 text-gray-900';
  const fieldClass = `w-full rounded-md border px-2 py-1.5 text-xs ${inputClass}`;

  return <div className='space-y-2'>
    <select
      aria-label={`${label} authorization type`}
      className={fieldClass}
      value={auth.type === 'inherit' && !allowInherit ? 'none' : auth.type}
      onChange={(event) => onChange(authForType(event.target.value as HttpAuth['type']))}
    >
      {allowInherit && <option value='inherit'>Inherit from parent</option>}
      <option value='none'>No auth</option>
      <option value='bearer'>Bearer token</option>
      <option value='oauth2'>OAuth 2.0</option>
      <option value='basic'>Basic auth</option>
      <option value='apiKey'>API key</option>
    </select>
    {auth.type === 'bearer' && <input aria-label={`${label} bearer token`} type='password' autoComplete='off' className={fieldClass} value={auth.token} onChange={(event) => onChange({ type: 'bearer', token: event.target.value })}/>}
    {auth.type === 'oauth2' && <OAuthEditor auth={auth} fieldClass={fieldClass} label={label} onChange={onChange} />}
    {auth.type === 'basic' && <div className='grid grid-cols-2 gap-2'>
      <input aria-label={`${label} basic username`} className={fieldClass} placeholder='Username' value={auth.username} onChange={(event) => onChange({ ...auth, username: event.target.value })} />
      <input aria-label={`${label} basic password`} type='password' autoComplete='off' className={fieldClass} placeholder='Password' value={auth.password} onChange={(event) => onChange({ ...auth, password: event.target.value })} />
    </div>}
    {auth.type === 'apiKey' && <div className='space-y-2'>
      <input aria-label={`${label} API key name`} className={fieldClass} placeholder='Key name' value={auth.key} onChange={(event) => onChange({ ...auth, key: event.target.value })} />
      <input aria-label={`${label} API key value`} type='password' autoComplete='off' className={fieldClass} placeholder='Value' value={auth.value} onChange={(event) => onChange({ ...auth, value: event.target.value })} />
      <select aria-label={`${label} API key location`} className={fieldClass} value={auth.in} onChange={(event) => onChange({ ...auth, in: event.target.value as 'header' | 'query' })}>
        <option value='header'>Header</option>
        <option value='query'>Query</option>
      </select>
    </div>}
  </div>;
};
