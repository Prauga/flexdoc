import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FlexDocSettings } from './FlexDocSettings';

function renderSettings(manageTheme: boolean) {
  return render(<FlexDocSettings
    open
    theme='light'
    hostTheme='light'
    manageTheme={manageTheme}
    effectiveExpandedSections={['parameters']}
    onThemeChange={() => undefined}
    onExpandChange={() => undefined}
    onClose={() => undefined}
  />);
}

describe('FlexDocSettings', () => {
  it('keeps expansion preferences available when the host owns theme selection', () => {
    renderSettings(false);
    expect(screen.queryByRole('combobox', { name: 'Viewer theme' })).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Default expanded sections' })).toBeInTheDocument();
  });

  it('shows viewer theme controls when FlexDoc manages theme selection', () => {
    renderSettings(true);
    expect(screen.getByRole('combobox', { name: 'Viewer theme' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Default expanded sections' })).toBeInTheDocument();
  });
});
