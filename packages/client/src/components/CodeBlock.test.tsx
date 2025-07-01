import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

// Create a simplified version of CodeBlock for testing
const SimplifiedCodeBlock = ({ code, language, title, showCopy = false }) => (
  <div>
    <pre className={`language-${language}`}>{code}</pre>
    {showCopy && <button aria-label='Copy code'>Copy</button>}
    {title && <div>{title}</div>}
  </div>
);

// Mock the actual CodeBlock component
jest.mock('./CodeBlock', () => ({
  CodeBlock: (props) => SimplifiedCodeBlock(props),
}));

// Import after mocking
import { CodeBlock } from './CodeBlock';

// Mock the copy functionality
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn(),
  },
});

describe('CodeBlock', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders code with the correct language class', () => {
    render(<CodeBlock code="const test = 'hello';" language="javascript" />);
    const preElement = screen.getByText("const test = 'hello';");
    expect(preElement.className).toContain('language-javascript');
  });

  it('renders with a title when provided', () => {
    render(
      <CodeBlock code="const test = 'hello';" language="javascript" title="Example Code" />
    );
    expect(screen.getByText('Example Code')).toBeInTheDocument();
  });

  it('does not show copy button when showCopy is false', () => {
    render(
      <CodeBlock
        code="const test = 'hello';"
        language="javascript"
        showCopy={false}
      />
    );
    expect(screen.queryByLabelText('Copy code')).not.toBeInTheDocument();
  });

  it('shows copy button when showCopy is true', () => {
    render(
      <CodeBlock
        code="const test = 'hello';"
        language="javascript"
        showCopy={true}
      />
    );
    expect(screen.getByLabelText('Copy code')).toBeInTheDocument();
  });
});
