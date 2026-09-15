import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ApiClientAuthEditor } from './ApiClientAuthEditor';

test('distinguishes an available basic API host from an unsupported advanced authorization capability', () => {
  render(<ApiClientAuthEditor
    auth={{ type: 'digest', username: 'u', password: 'p' }}
    label='Request'
    hostExecution={{ available: true, endpoint: '/docs/__flexdoc/execute', capabilities: [] }}
    onChange={() => {}}
    theme='light'
  />);

  expect(screen.getByRole('alert')).toHaveTextContent('Requests run from your API server, but this authorization mode is not supported.');
  expect(screen.queryByText(/Host execution is disabled/i)).not.toBeInTheDocument();
});

test('describes a genuinely unavailable API host without conflating it with missing capabilities', () => {
  render(<ApiClientAuthEditor
    auth={{ type: 'digest', username: 'u', password: 'p' }}
    label='Request'
    hostExecution={{ available: false, endpoint: '/docs/__flexdoc/execute', capabilities: [] }}
    onChange={() => {}}
    theme='light'
  />);

  expect(screen.getByRole('alert')).toHaveTextContent('API-host execution is unavailable on this documentation server.');
});