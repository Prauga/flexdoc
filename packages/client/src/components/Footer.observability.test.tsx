import React from 'react';
import { render, screen } from '@testing-library/react';
import { Footer } from './Footer';

test('keeps renderer build identity visible even with custom footer content', () => {
  render(<Footer
    footerClasses='test-footer'
    footer={{ copyright: 'Acme API', link: [{ text: 'Support', url: 'https://example.test/support' }] }}
  />);

  expect(screen.getByText('Acme API')).toBeInTheDocument();
  expect(screen.getByLabelText('FlexDoc build information')).toHaveTextContent('vdev');
  expect(screen.getByLabelText('FlexDoc build information')).toHaveTextContent('contract 1');
});
