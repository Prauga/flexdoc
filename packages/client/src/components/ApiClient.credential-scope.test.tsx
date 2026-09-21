// The repo-wide react manual mock returns inert state setters.
jest.unmock('react');

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { useState } from 'react';
import { ApiClient } from './ApiClient';
import { API_HOST_COOKIE_JAR_CLEAR_WARNING } from '../utils/api-client-credential-scope';
import type { ApiClientCredentialStorage } from '../utils/api-client-credentials';
import type { FlexDocHostExecutionPublicOptions } from '../types/options';
import type { HttpRequestDraft } from '../utils/http-client';

const fetchMock = jest.fn();

const secretRequest: Partial<HttpRequestDraft> = {
  method: 'POST',
  url: 'https://internal.example.test/admin',
  headers: [{ key: 'Authorization', value: 'Bearer secret-token' }],
  body: '{"password":"hunter2"}',
  hostExecution: { cookieJar: 'session' },
};

const scopeChanges: ApiClientCredentialStorage[] = [];

function Harness({ hostExecution }: { hostExecution?: FlexDocHostExecutionPublicOptions }) {
  const [storage, setStorage] = useState<ApiClientCredentialStorage>('remember');
  return (
    <ApiClient
      initialRequest={secretRequest}
      initialRequestTab='authorization'
      credentialStorage={storage}
      onCredentialStorageChange={(next) => { scopeChanges.push(next); setStorage(next); }}
      hostExecution={hostExecution}
    />
  );
}

function changeScope(value: ApiClientCredentialStorage) {
  return userEvent.selectOptions(screen.getByLabelText('Credential storage'), value);
}

describe('API Client credential-scope cookie jar eviction', () => {
  beforeEach(() => {
    scopeChanges.length = 0;
    fetchMock.mockReset();
    Object.defineProperty(globalThis, 'fetch', { value: fetchMock, configurable: true, writable: true });
  });

  it('sends one marker-only clear and drops the jar selection when the host advertises cookies', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => '{"cookies":[{"name":"sid"}]}' });
    render(<Harness hostExecution={{ available: true, endpoint: '/docs/__flexdoc/execute', cookiesEndpoint: '/docs/__flexdoc/cookies', capabilities: ['cookies'] }} />);

    expect(screen.getByLabelText('Use API host cookie jar')).toBeChecked();
    await changeScope('never');
    expect(scopeChanges).toEqual(['never']);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith('/docs/__flexdoc/cookies', {
      method: 'DELETE',
      credentials: 'same-origin',
      headers: { 'X-FlexDoc-Execute': '1' },
    });
    const init = fetchMock.mock.calls[0][1];
    expect(init.body).toBeUndefined();
    expect(JSON.stringify(init)).not.toMatch(/secret-token|hunter2|internal\.example/);
    expect(screen.getByLabelText('Credential storage')).toHaveValue('never');
    expect(screen.getByLabelText('Use API host cookie jar')).not.toBeChecked();
    expect(screen.queryByRole('status', { name: 'API-host cookie jar' })).not.toBeInTheDocument();
  });

  it.each([
    ['no cookie capability', { available: true, endpoint: '/docs/__flexdoc/execute', cookiesEndpoint: '/docs/__flexdoc/cookies', capabilities: [] as const }],
    ['no cookie endpoint', { available: true, endpoint: '/docs/__flexdoc/execute', capabilities: ['cookies'] as const }],
  ])('does not clear when the host has %s', async (_label, hostExecution) => {
    render(<Harness hostExecution={hostExecution} />);
    await changeScope('session');
    await waitFor(() => expect(screen.getByLabelText('Credential storage')).toHaveValue('session'));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps the new scope and shows bounded guidance when the clear fails', async () => {
    fetchMock.mockRejectedValue(new Error('cookie=sid; secret-token'));
    render(<Harness hostExecution={{ available: true, endpoint: '/docs/__flexdoc/execute', cookiesEndpoint: '/docs/__flexdoc/cookies', capabilities: ['cookies'] }} />);

    await changeScope('session');

    const warning = await screen.findByRole('status', { name: 'API-host cookie jar' });
    expect(warning).toHaveTextContent(API_HOST_COOKIE_JAR_CLEAR_WARNING);
    expect(warning).not.toHaveTextContent('secret-token');
    expect(warning).not.toHaveTextContent('sid');
    expect(screen.getByLabelText('Credential storage')).toHaveValue('session');
    expect(screen.getByLabelText('Use API host cookie jar')).not.toBeChecked();
  });
});
