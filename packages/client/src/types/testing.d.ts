// This file extends the Jest types with custom matchers from @testing-library/jest-dom

import '@testing-library/jest-dom';

declare global {
  namespace jest {
    interface Matchers<R, T = any> {
      toBeInTheDocument(): R;
      toHaveClass(className: string | string[]): R;
      toHaveTextContent(text: string | RegExp): R;
      toBeVisible(): R;
      toBeDisabled(): R;
      toBeEnabled(): R;
      toHaveAttribute(attr: string, value?: string | RegExp): R;
      toHaveStyle(css: string | Record<string, any>): R;
      toBeChecked(): R;
      toBeEmpty(): R;
      toBeEmptyDOMElement(): R;
      toBeInvalid(): R;
      toBeRequired(): R;
      toBeValid(): R;
      toContainElement(element: HTMLElement | null): R;
      toContainHTML(html: string): R;
      toHaveFocus(): R;
      toHaveFormValues(expectedValues: Record<string, any>): R;
      toHaveValue(value?: string | string[] | number | null): R;
    }
  }
}

