import React, { useState } from 'react';
import type { FlexDocHostExecutionPublicOptions } from '../types/options';
import type { HttpAuth, HttpHostExecutionCapability, HttpOAuth2Auth, HttpOAuth2GrantType } from '../utils/http-client';
import { obtainOAuth2AccessToken, refreshOAuth2AccessToken } from '../utils/api-client-oauth';

interface Props {
  auth: HttpAuth;
  label: string;
  allowInherit?: boolean;
  hostExecution?: FlexDocHostExecutionPublicOptions;
  onChange: (auth: HttpAuth) => void;
  theme: 'light' | 'dark';
}

function authForType(type: HttpAuth['type']): HttpAuth {
  if (type === 'inherit') return { type: 'inherit' };
  if (type === 'bearer') return { type: 'bearer', token: '' };
  if (type === 'oauth2') return { type: 'oauth2', accessToken: '', grantType: 'accessToken', scopes: [] };
  if (type === 'basic') return { type: 'basic', username: '', password: '' };
  if (type === 'apiKey') return { type: 'apiKey', key: '', value: '', in: 'header' };
  if (type === 'digest') return { type: 'digest', username: '', password: '' };
  if (type === 'hawk') return { type: 'hawk', id: '', key: '', algorithm: 'sha256' };
  if (type === 'ntlm') return { type: 'ntlm', username: '', password: '' };
  if (type === 'oauth1') return { type: 'oauth1', consumerKey: '', consumerSecret: '', signatureMethod: 'HMAC-SHA1' };
  if (type === 'awsv4') return { type: 'awsv4', accessKey: '', secretKey: '', region: '', service: '' };
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
    setBusy(true); setMessage(null);
    try {
      const result = await obtainOAuth2AccessToken(auth);
      onChange({ ...auth, accessToken: result.accessToken, refreshToken: result.refreshToken ?? auth.refreshToken });
      setMessage(result.expiresIn ? `Access token acquired; expires in ${result.expiresIn}s.` : 'Access token acquired.');
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'OAuth authorization failed.'); }
    finally { setBusy(false); }
  };
  const refresh = async () => {
    setBusy(true); setMessage(null);
    try {
      const result = await refreshOAuth2AccessToken(auth);
      onChange({ ...auth, accessToken: result.accessToken, refreshToken: result.refreshToken ?? auth.refreshToken });
      setMessage('Access token refreshed.');
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'OAuth token refresh failed.'); }
    finally { setBusy(false); }
  };

  return <div className='space-y-2'>
    <select aria-label={label ? `${label} OAuth grant type` : 'OAuth grant type'} className={fieldClass} value={grantType} onChange={(event) => onChange({ ...auth, grantType: event.target.value as HttpOAuth2GrantType })}>
      <option value='accessToken'>Manual access token</option><option value='authorizationCode'>Authorization Code + PKCE</option><option value='clientCredentials'>Client Credentials</option><option value='password'>Password grant (legacy)</option><option value='implicit'>Implicit grant (legacy)</option>
    </select>
    {popupGrant && <input aria-label={label ? `${label} OAuth authorization URL` : 'OAuth authorization URL'} className={fieldClass} placeholder='Authorization URL' value={auth.authorizationUrl || ''} onChange={(event) => onChange({ ...auth, authorizationUrl: event.target.value })} />}
    {tokenGrant && <input aria-label={label ? `${label} OAuth token URL` : 'OAuth token URL'} className={fieldClass} placeholder='Token URL' value={auth.tokenUrl || ''} onChange={(event) => onChange({ ...auth, tokenUrl: event.target.value })} />}
    {clientGrant && <input aria-label={label ? `${label} OAuth client ID` : 'OAuth client ID'} className={fieldClass} placeholder='Client ID' value={auth.clientId || ''} onChange={(event) => onChange({ ...auth, clientId: event.target.value })} />}
    {(grantType === 'authorizationCode' || grantType === 'clientCredentials' || grantType === 'password') && <input aria-label={label ? `${label} OAuth client secret` : 'OAuth client secret'} type='password' autoComplete='off' className={fieldClass} placeholder={grantType === 'authorizationCode' ? 'Client secret (optional for PKCE/public clients)' : 'Client secret (optional)'} value={auth.clientSecret || ''} onChange={(event) => onChange({ ...auth, clientSecret: event.target.value })} />}
    {tokenGrant && <select aria-label={label ? `${label} OAuth client authentication` : 'OAuth client authentication'} className={fieldClass} value={auth.clientAuthentication || 'body'} onChange={(event) => onChange({ ...auth, clientAuthentication: event.target.value as 'body' | 'basic' })}><option value='body'>Send client credentials in body</option><option value='basic'>Send as Basic Auth header</option></select>}
    {popupGrant && <input aria-label={label ? `${label} OAuth redirect URI` : 'OAuth redirect URI'} className={fieldClass} placeholder='Redirect URI (defaults to this page)' value={auth.redirectUri || ''} onChange={(event) => onChange({ ...auth, redirectUri: event.target.value })} />}
    {clientGrant && <input aria-label={label ? `${label} OAuth scopes` : 'OAuth scopes'} className={fieldClass} placeholder='Scopes separated by spaces' value={(auth.scopes || []).join(' ')} onChange={(event) => onChange({ ...auth, scopes: scopesFromInput(event.target.value) })} />}
    {grantType === 'password' && <div className='grid grid-cols-2 gap-2'><input aria-label={label ? `${label} OAuth username` : 'OAuth username'} className={fieldClass} placeholder='Resource owner username' value={auth.username || ''} onChange={(event) => onChange({ ...auth, username: event.target.value })} /><input aria-label={label ? `${label} OAuth password` : 'OAuth password'} type='password' autoComplete='off' className={fieldClass} placeholder='Resource owner password' value={auth.password || ''} onChange={(event) => onChange({ ...auth, password: event.target.value })} /></div>}
    <input aria-label={label ? `${label} OAuth access token` : 'OAuth access token'} type='password' autoComplete='off' className={fieldClass} placeholder='Access token' value={auth.accessToken} onChange={(event) => onChange({ ...auth, accessToken: event.target.value })} />
    {grantType !== 'accessToken' && <div className='flex flex-wrap gap-2'><button type='button' disabled={busy} onClick={acquire} className='rounded-md border px-2.5 py-1.5 text-xs font-medium disabled:opacity-60'>{busy ? 'Authorizing…' : 'Get access token'}</button>{auth.refreshToken && auth.tokenUrl && <button type='button' disabled={busy} onClick={refresh} className='rounded-md border px-2.5 py-1.5 text-xs font-medium disabled:opacity-60'>Refresh access token</button>}</div>}
    {grantType !== 'accessToken' && <p className='text-[11px] opacity-70'>Authorization Code uses PKCE. Popup callbacks must return to this page origin; token endpoints must allow browser CORS. Client secrets entered here are browser-visible and should only be used when the OAuth provider permits it.</p>}
    {message && <p role='status' className='text-xs'>{message}</p>}
  </div>;
};

export const ApiClientAuthEditor: React.FC<Props> = ({ auth, label, allowInherit = false, hostExecution, onChange, theme }) => {
  const inputClass = theme === 'dark' ? 'bg-gray-900 border-gray-700 text-gray-100' : 'bg-white border-gray-300 text-gray-900';
  const fieldClass = `w-full rounded-md border px-2 py-1.5 text-xs ${inputClass}`;
  const capabilities = new Set(hostExecution?.capabilities || []);
  const supports = (capability: HttpHostExecutionCapability) => hostExecution?.available === true && capabilities.has(capability);
  const hostType = auth.type === 'digest' ? 'digest' : auth.type === 'hawk' ? 'hawk' : auth.type === 'ntlm' ? 'ntlm' : auth.type === 'oauth1' ? 'oauth1' : auth.type === 'awsv4' ? 'awsv4' : auth.type === 'apiKey' && auth.in === 'cookie' ? 'cookies' : undefined;

  return <div className='space-y-2'>
    <select aria-label={`${label} authorization type`} className={fieldClass} value={auth.type === 'inherit' && !allowInherit ? 'none' : auth.type} onChange={(event) => onChange(authForType(event.target.value as HttpAuth['type']))}>
      {allowInherit && <option value='inherit'>Inherit from parent</option>}
      <option value='none'>No auth</option><option value='bearer'>Bearer token</option><option value='oauth2'>OAuth 2.0</option><option value='basic'>Basic auth</option><option value='apiKey'>API key</option>
      <option value='digest' disabled={!supports('digest')}>Digest (API host)</option><option value='hawk' disabled={!supports('hawk')}>Hawk (API host)</option><option value='ntlm' disabled={!supports('ntlm')}>NTLM / Negotiate (API host)</option><option value='oauth1' disabled={!supports('oauth1')}>OAuth 1.0 (API host)</option><option value='awsv4' disabled={!supports('awsv4')}>AWS Signature v4 (API host)</option>
    </select>
    {auth.type === 'bearer' && <input aria-label={`${label} bearer token`} type='password' autoComplete='off' className={fieldClass} value={auth.token} onChange={(event) => onChange({ ...auth, token: event.target.value })} />}
    {auth.type === 'oauth2' && <OAuthEditor auth={auth} fieldClass={fieldClass} label={label} onChange={onChange} />}
    {(auth.type === 'basic' || auth.type === 'digest') && <div className='grid grid-cols-2 gap-2'><input aria-label={`${label} ${auth.type} username`} className={fieldClass} placeholder='Username' value={auth.username} onChange={(event) => onChange({ ...auth, username: event.target.value })} /><input aria-label={`${label} ${auth.type} password`} type='password' autoComplete='off' className={fieldClass} placeholder='Password' value={auth.password} onChange={(event) => onChange({ ...auth, password: event.target.value })} /></div>}
    {auth.type === 'apiKey' && <div className='space-y-2'><input aria-label={`${label} API key name`} className={fieldClass} placeholder='Key name' value={auth.key} onChange={(event) => onChange({ ...auth, key: event.target.value })} /><input aria-label={`${label} API key value`} type='password' autoComplete='off' className={fieldClass} placeholder='Value' value={auth.value} onChange={(event) => onChange({ ...auth, value: event.target.value })} /><select aria-label={`${label} API key location`} className={fieldClass} value={auth.in} onChange={(event) => onChange({ ...auth, in: event.target.value as 'header' | 'query' | 'cookie' })}><option value='header'>Header</option><option value='query'>Query</option><option value='cookie' disabled={!supports('cookies')}>Cookie (API host)</option></select></div>}
    {auth.type === 'hawk' && <div className='grid gap-2'><input aria-label={`${label} Hawk id`} className={fieldClass} placeholder='ID' value={auth.id} onChange={(event) => onChange({ ...auth, id: event.target.value })} /><input aria-label={`${label} Hawk key`} type='password' autoComplete='off' className={fieldClass} placeholder='Key' value={auth.key} onChange={(event) => onChange({ ...auth, key: event.target.value })} /><select aria-label={`${label} Hawk algorithm`} className={fieldClass} value={auth.algorithm || 'sha256'} onChange={(event) => onChange({ ...auth, algorithm: event.target.value as 'sha1' | 'sha256' })}><option value='sha256'>SHA-256</option><option value='sha1'>SHA-1</option></select><input aria-label={`${label} Hawk ext`} className={fieldClass} placeholder='ext (optional)' value={auth.ext || ''} onChange={(event) => onChange({ ...auth, ext: event.target.value })} /></div>}
    {auth.type === 'ntlm' && <div className='grid gap-2'><input aria-label={`${label} NTLM username`} className={fieldClass} placeholder='Username' value={auth.username} onChange={(event) => onChange({ ...auth, username: event.target.value })} /><input aria-label={`${label} NTLM password`} type='password' autoComplete='off' className={fieldClass} placeholder='Password' value={auth.password} onChange={(event) => onChange({ ...auth, password: event.target.value })} /><input aria-label={`${label} NTLM domain`} className={fieldClass} placeholder='Domain (optional)' value={auth.domain || ''} onChange={(event) => onChange({ ...auth, domain: event.target.value })} /><input aria-label={`${label} NTLM workstation`} className={fieldClass} placeholder='Workstation (optional)' value={auth.workstation || ''} onChange={(event) => onChange({ ...auth, workstation: event.target.value })} /></div>}
    {auth.type === 'oauth1' && <div className='grid gap-2'><input aria-label={`${label} OAuth1 consumer key`} className={fieldClass} placeholder='Consumer key' value={auth.consumerKey} onChange={(event) => onChange({ ...auth, consumerKey: event.target.value })} /><input aria-label={`${label} OAuth1 consumer secret`} type='password' autoComplete='off' className={fieldClass} placeholder='Consumer secret' value={auth.consumerSecret} onChange={(event) => onChange({ ...auth, consumerSecret: event.target.value })} /><input aria-label={`${label} OAuth1 token`} className={fieldClass} placeholder='Token (optional)' value={auth.token || ''} onChange={(event) => onChange({ ...auth, token: event.target.value })} /><input aria-label={`${label} OAuth1 token secret`} type='password' autoComplete='off' className={fieldClass} placeholder='Token secret (optional)' value={auth.tokenSecret || ''} onChange={(event) => onChange({ ...auth, tokenSecret: event.target.value })} /><select aria-label={`${label} OAuth1 signature method`} className={fieldClass} value={auth.signatureMethod || 'HMAC-SHA1'} onChange={(event) => onChange({ ...auth, signatureMethod: event.target.value as 'HMAC-SHA1' | 'HMAC-SHA256' | 'PLAINTEXT' })}><option>HMAC-SHA1</option><option>HMAC-SHA256</option><option>PLAINTEXT</option></select><input aria-label={`${label} OAuth1 realm`} className={fieldClass} placeholder='Realm (optional)' value={auth.realm || ''} onChange={(event) => onChange({ ...auth, realm: event.target.value })} /></div>}
    {auth.type === 'awsv4' && <div className='grid gap-2'><input aria-label={`${label} AWS access key`} className={fieldClass} placeholder='Access key' value={auth.accessKey} onChange={(event) => onChange({ ...auth, accessKey: event.target.value })} /><input aria-label={`${label} AWS secret key`} type='password' autoComplete='off' className={fieldClass} placeholder='Secret key' value={auth.secretKey} onChange={(event) => onChange({ ...auth, secretKey: event.target.value })} /><input aria-label={`${label} AWS session token`} type='password' autoComplete='off' className={fieldClass} placeholder='Session token (optional)' value={auth.sessionToken || ''} onChange={(event) => onChange({ ...auth, sessionToken: event.target.value })} /><input aria-label={`${label} AWS region`} className={fieldClass} placeholder='Region' value={auth.region} onChange={(event) => onChange({ ...auth, region: event.target.value })} /><input aria-label={`${label} AWS service`} className={fieldClass} placeholder='Service' value={auth.service} onChange={(event) => onChange({ ...auth, service: event.target.value })} /></div>}
    {hostType && <p role={supports(hostType) ? 'status' : 'alert'} className='text-[11px] opacity-75'>{supports(hostType) ? 'This authorization mode is executed by the FlexDoc API host.' : 'Host execution is disabled or this documentation host does not support the selected authorization mode.'}</p>}
  </div>;
};
