import React from 'react';
import { render, screen } from '@testing-library/react';
import { Footer } from './Footer';

test('does not show an unknown development build stamp', () => {
  render(<Footer footerClasses='test-footer' footer={{ copyright: 'Acme API' }} />);
  expect(screen.getByText('Acme API')).toBeInTheDocument();
  expect(screen.queryByLabelText('FlexDoc build')).not.toBeInTheDocument();
});

test('allows integrators to disable build identity', () => {
  render(<Footer footerClasses='test-footer' footer={{ copyright: 'Acme API', showBuildInfo: false }} />);
  expect(screen.queryByLabelText('FlexDoc build')).not.toBeInTheDocument();
});
