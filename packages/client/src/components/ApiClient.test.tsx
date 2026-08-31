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

    render(<ApiClient initialRequest={{ method: 'POST', url: 'https://api.example.test/pets' }} />);
    fireEvent.change(screen.getByLabelText('Request body'), { target: { value: '{"name":"Mochi"}' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send request' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith('https://api.example.test/pets', expect.objectContaining({
      method: 'POST',
      body: '{"name":"Mochi"}',
      credentials: 'same-origin',
    }));
    expect(await screen.findByText(/201 Created/)).toBeInTheDocument();
  });

  it('supports query parameters and bearer authorization', async () => {
    fetchMock.mockResolvedValue({ status: 200, statusText: 'OK', headers: new Headers(), text: async () => '' });
    render(<ApiClient initialRequest={{ url: 'https://api.example.test/pets' }} />);

    fireEvent.change(screen.getByLabelText('Query parameters 1 key'), { target: { value: 'limit' } });
    fireEvent.change(screen.getByLabelText('Query parameters 1 value'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('Authorization type'), { target: { value: 'bearer' } });
    fireEvent.change(screen.getByLabelText('Bearer token'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send request' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.example.test/pets?limit=10');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer secret');
  });

  it('reports the current canonical built request to consumers', async () => {
    const onRequestChange = jest.fn();
    render(<ApiClient initialRequest={{ method: 'GET', url: 'https://api.example.test/pets' }} onRequestChange={onRequestChange} />);
    await waitFor(() => expect(onRequestChange).toHaveBeenCalled());
    expect(onRequestChange.mock.calls.at(-1)?.[0]).toEqual(expect.objectContaining({ method: 'GET', url: 'https://api.example.test/pets' }));
  });
});
