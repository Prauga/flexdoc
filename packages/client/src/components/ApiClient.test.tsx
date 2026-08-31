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

  it('does not fire request-change solely because callback identity changes', async () => {
    const first = jest.fn();
    const second = jest.fn();
    const view = render(<ApiClient initialRequest={{ method: 'GET', url: 'https://api.example.test/pets' }} onRequestChange={first} />);
    await waitFor(() => expect(first).toHaveBeenCalledTimes(1));

    view.rerender(<ApiClient initialRequest={{ method: 'GET', url: 'https://api.example.test/pets' }} onRequestChange={second} />);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(second).not.toHaveBeenCalled();
  });

  it('shows configured servers and an arbitrary custom server override', () => {
    render(<ApiClient
      initialRequest={{ method: 'GET', url: 'http://localhost:8080/pets/42' }}
      initialServerUrl='http://localhost:8080'
      serverOptions={[
        { url: 'https://api.example.test', description: 'Production' },
        { url: 'https://canary.example.test', description: 'Canary' },
      ]}
    />);

    expect(screen.getByLabelText('API Client server')).toHaveTextContent('Production');
    expect(screen.getByLabelText('API Client server')).toHaveTextContent('Canary');
    expect(screen.getByLabelText('API Client custom server URL')).toHaveValue('http://localhost:8080');
    expect(screen.getByLabelText('Request URL')).toHaveValue('http://localhost:8080/pets/42');
  });
});