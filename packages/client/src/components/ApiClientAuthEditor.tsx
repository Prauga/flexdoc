import React from 'react';
import type { HttpAuth } from '../utils/http-client';

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
  if (type === 'basic') return { type: 'basic', username: '', password: '' };
  if (type === 'apiKey') return { type: 'apiKey', key: '', value: '', in: 'header' };
  return { type: 'none' };
}

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
      <option value='basic'>Basic auth</option>
      <option value='apiKey'>API key</option>
    </select>
    {auth.type === 'bearer' && <input aria-label={`${label} bearer token`} type='password' autoComplete='off' className={fieldClass} value={auth.token} onChange={(event) => onChange({ type: 'bearer', token: event.target.value })} />}
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
