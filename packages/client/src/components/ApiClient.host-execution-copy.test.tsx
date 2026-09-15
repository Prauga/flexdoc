import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ApiClient } from './ApiClient';

describe.each(['advanced', 'basic'] as const)('API Client %s density host copy', (density) => {
  test('shows positive copy when ordinary requests run through an available host with no advanced capabilities', () => {
    render(<ApiClient
      density={density}
      initialRequest={{ method: 'GET', url: 'https://api.example.test/pets' }}
      hostExecution={{ available: true, endpoint: '/docs/__flexdoc/execute', capabilities: [] }}
    />);

    expect(screen.getByRole('status', { name: 'Host execution status' })).toHaveTextContent('This request runs from your API server.');
    expect(screen.queryByText(/Host execution is disabled/i)).not.toBeInTheDocument();
  });
});