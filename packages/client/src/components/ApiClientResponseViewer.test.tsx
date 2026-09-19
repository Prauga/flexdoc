import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ApiClientResponseViewer } from './ApiClientResponseViewer';

describe('ApiClientResponseViewer', () => {
  it('copies the provided cURL command', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis.navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<ApiClientResponseViewer
      response={{ status: 200, statusText: 'OK', headers: [['content-type', 'application/json']], body: '{}', responseTime: 12 }}
      curlCommand={'curl -X GET https://api.example.test/pets'}
    />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy request as cURL' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('curl -X GET https://api.example.test/pets'));
  });
  it('splits API-host overhead from target timing', () => {
    render(<ApiClientResponseViewer
      response={{
        status: 200,
        statusText: 'OK',
        headers: [],
        body: '{}',
        responseTime: 44,
        hostRoundTripTime: 731,
        transport: 'api-host',
      }}
    />);
    expect(screen.getByLabelText('Actual transport')).toHaveTextContent('API host');
    expect(screen.getByText('Host overhead 687 ms')).toBeInTheDocument();
    expect(screen.getByText('Target 44 ms')).toBeInTheDocument();
  });

});
