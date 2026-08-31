import React, { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ApiClient } from './ApiClient';

const fetchMock = jest.fn();

describe('ApiClient', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    Object.defineProperty(globalThis, 'fetch', { value: fetchMock, configurable: true, writable: true });
  });

  it('builds and sends an arbitrary request', async () => {
    fetchMock.mockResolvedValue({
      status: 201,
      statusText: 'Created',
      headers: new Headers({ 'content-type': 'application/json' }),
      text: async () => '{"id":42}',
    });

    render(<ApiClient initialRequest={{
      method: 'POST',
      url: 'https://api.example.test/pets',
      body: '{"name":"Mochi"}',
      contentType: 'application/json',
    }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Send request' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0];
    expect(init).toEqual(expect.objectContaining({
      method: 'POST',
      body: '{"name":"Mochi"}',
      credentials: 'same-origin',
    }));
    expect(init.headers).toEqual([['Content-Type', 'application/json']]);
  });

  it('preserves duplicate headers when executing requests', async () => {
    fetchMock.mockResolvedValue({ status: 200, statusText: 'OK', headers: new Headers(), text: async () => '' });
    render(<ApiClient initialRequest={{
      method: 'GET',
      url: 'https://api.example.test/pets',
      headers: [
        { key: 'X-Trace', value: 'one' },
        { key: 'X-Trace', value: 'two' },
      ],
    }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Send request' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers).toEqual([['X-Trace', 'one'], ['X-Trace', 'two']]);
  });

  it('supports query parameters and bearer authorization', async () => {
    fetchMock.mockResolvedValue({ status: 200, statusText: 'OK', headers: new Headers(), text: async () => '' });
    render(<ApiClient initialRequest={{
      method: 'GET',
      url: 'https://api.example.test/pets',
      query: [{ key: 'limit', value: '10' }],
      auth: { type: 'bearer', token: 'secret' },
    }} />);

    expect(screen.getByLabelText('Query parameters 1 key')).toHaveValue('limit');
    expect(screen.getByLabelText('Query parameters 1 value')).toHaveValue('10');
    fireEvent.click(screen.getByRole('button', { name: 'Send request' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.example.test/pets?limit=10');
    expect(init.headers).toContainEqual(['Authorization', 'Bearer secret']);
  });

  it('reports the current canonical built request to consumers', async () => {
    const onRequestChange = jest.fn();
    render(<ApiClient initialRequest={{ method: 'GET', url: 'https://api.example.test/pets' }} onRequestChange={onRequestChange} />);
    await waitFor(() => expect(onRequestChange).toHaveBeenCalled());
    expect(onRequestChange.mock.calls.at(-1)?.[0]).toEqual(expect.objectContaining({ method: 'GET', url: 'https://api.example.test/pets' }));
  });

  it('does not loop when an inline request-change callback updates parent state', async () => {
    let renders = 0;
    const Parent = () => {
      const [, setLatest] = useState<unknown>(null);
      renders += 1;
      return <ApiClient
        initialRequest={{ method: 'GET', url: 'https://api.example.test/pets' }}
        onRequestChange={(request) => setLatest(request)}
      />;
    };

    render(<Parent />);
    await waitFor(() => expect(renders).toBeGreaterThan(1));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(renders).toBeLessThan(5);
  });
});
