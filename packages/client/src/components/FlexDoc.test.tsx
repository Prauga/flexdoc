import { fireEvent, render, screen } from '@testing-library/react';
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

describe('FlexDoc', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/');
    document.body.style.overflow = '';
  });

  it('renders navigation and overview initially', () => {
    render(<FlexDoc spec={mockSpec} />);
    expect(screen.getAllByTestId('sidebar-mock').length).toBeGreaterThan(0);
    expect(screen.getByTestId('overview-mock')).toBeInTheDocument();
  });

  it('restores an endpoint from a shareable hash', () => {
    window.history.replaceState({}, '', '/#get-pets');
    render(<FlexDoc spec={mockSpec} />);
    expect(screen.getByTestId('endpoint-detail-mock')).toBeInTheDocument();
    expect(screen.queryByTestId('overview-mock')).not.toBeInTheDocument();
  });

  it('supports dark mode and custom styles', () => {
    render(<FlexDoc spec={mockSpec} theme='dark' customStyles={{ maxWidth: '1200px' }} />);
    expect(screen.getByText('Test API')).toBeInTheDocument();
  });

  it('opens and closes the mobile navigation drawer', () => {
    render(<FlexDoc spec={mockSpec} />);
    fireEvent.click(screen.getByLabelText('Open API navigation'));
    expect(screen.getByRole('dialog', { name: 'API navigation' })).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Close API navigation'));
    expect(screen.queryByRole('dialog', { name: 'API navigation' })).not.toBeInTheDocument();
  });

  it('closes the mobile drawer with Escape', () => {
    render(<FlexDoc spec={mockSpec} />);
    fireEvent.click(screen.getByLabelText('Open API navigation'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'API navigation' })).not.toBeInTheDocument();
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
