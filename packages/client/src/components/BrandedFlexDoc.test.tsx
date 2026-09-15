import React from 'react';
import { render, screen } from '@testing-library/react';
import { FlexDoc } from './BrandedFlexDoc';

jest.mock('./FlexDoc', () => ({
  FlexDoc: ({ options }: { options?: { logo?: string | { url?: string } } }) => <div data-testid='renderer-logo'>{typeof options?.logo === 'string' ? options.logo : options?.logo?.url}</div>,
}));

const spec = { openapi: '3.1.0', info: { title: 'Test API', version: '1.0.0' }, paths: {} } as never;

test('uses remote FlexDoc branding only when the host did not provide a logo', () => {
  const { rerender } = render(<FlexDoc spec={spec} />);
  expect(screen.getByTestId('renderer-logo')).toHaveTextContent('raw.githubusercontent.com/Prauga/flexdoc-website/main/public/brand/flexdoc/favicon.svg');

  rerender(<FlexDoc spec={spec} options={{ logo: 'https://example.test/custom.svg' }} />);
  expect(screen.getByTestId('renderer-logo')).toHaveTextContent('https://example.test/custom.svg');
});
