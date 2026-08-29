import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FlexDoc } from './FlexDoc';
import { OpenAPISpec } from '../types/openapi';

jest.mock('./Sidebar', () => ({ Sidebar: () => <div data-testid='sidebar-mock'>Sidebar Mock</div> }));
jest.mock('./EndpointDetail', () => ({ EndpointDetail: () => <div data-testid='endpoint-detail-mock'>EndpointDetail Mock</div> }));
jest.mock('./Overview', () => ({ Overview: () => <div data-testid='overview-mock'>Overview Mock</div> }));

const mockSpec: OpenAPISpec = {
  openapi: '3.1.0',
  info: { title: 'Test API', version: '1.0.0' },
  servers: [{ url: 'https://api.example.com' }],
  paths: {
    '/pets': { get: { summary: 'List all pets', responses: { '200': { description: 'A list of pets' } } } },
    '/users': { post: { summary: 'Create user', responses: { '201': { description: 'User created' } } } },
  },
};

function setHash(hash = '') {
  window.history.replaceState({}, '', `/${hash ? `#${hash}` : ''}`);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

describe('FlexDoc', () => {
  beforeEach(() => {
    setHash();
    document.body.style.overflow = '';
  });

  it('renders navigation and overview initially', async () => {
    render(<FlexDoc spec={mockSpec} />);
    expect(screen.getAllByTestId('sidebar-mock').length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.getByTestId('overview-mock')).toBeInTheDocument());
  });

  it('restores an endpoint from a shareable hash', async () => {
    setHash('get-pets');
    render(<FlexDoc spec={mockSpec} />);
    await waitFor(() => expect(screen.getByTestId('endpoint-detail-mock')).toBeInTheDocument());
    expect(screen.queryByTestId('overview-mock')).not.toBeInTheDocument();
  });

  it('supports dark mode and custom styles', () => {
    render(<FlexDoc spec={mockSpec} theme='dark' customStyles={{ maxWidth: '1200px' }} />);
    expect(screen.getByText('Test API')).toBeInTheDocument();
  });

  it('opens and closes the mobile navigation drawer', async () => {
    render(<FlexDoc spec={mockSpec} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open API navigation' }));
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'API navigation' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Close API navigation' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'API navigation' })).not.toBeInTheDocument());
  });

  it('closes the mobile drawer with Escape', async () => {
    render(<FlexDoc spec={mockSpec} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open API navigation' }));
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'API navigation' })).toBeInTheDocument());
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'API navigation' })).not.toBeInTheDocument());
  });

  it('honors topbar, hostname and download options', () => {
    const { rerender } = render(<FlexDoc spec={mockSpec} options={{ hideHostname: true, hideDownloadButton: true }} />);
    expect(screen.queryByText('https://api.example.com')).not.toBeInTheDocument();
    expect(screen.queryByText('Download spec')).not.toBeInTheDocument();
    rerender(<FlexDoc spec={mockSpec} options={{ hideTopbar: true }} />);
    expect(screen.queryByLabelText('Open API navigation')).not.toBeInTheDocument();
  });

  it('renders a configured logo and footer', () => {
    render(<FlexDoc spec={mockSpec} options={{ logo: { url: '/logo.svg', alt: 'Acme docs' }, footer: { copyright: '© Acme', link: [{ text: 'Support', url: 'https://example.com' }] } }} />);
    expect(screen.getByAltText('Acme docs')).toBeInTheDocument();
    expect(screen.getByText('© Acme')).toBeInTheDocument();
    expect(screen.getByText('Support')).toBeInTheDocument();
  });
});
