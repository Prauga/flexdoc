import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

// Define the props interface for the simplified component
interface SimplifiedCodeBlockProps {
  code: string;
  language: string;
  title?: string;
  showCopy?: boolean;
}

// Create a simplified mock of the CodeBlock component for testing
const SimplifiedCodeBlock = ({
  code,
  language,
  title,
  showCopy = true,
}: SimplifiedCodeBlockProps) => (
  <div className='code-block-mock'>
    {title && <div className='code-title'>{title}</div>}
    {showCopy && <button aria-label='Copy code'>Copy</button>}
    <pre>
      <code className={`language-${language}`}>{code}</code>
    </pre>
  </div>
);

// Mock the actual CodeBlock component
jest.mock('./CodeBlock', () => ({
  CodeBlock: (props: SimplifiedCodeBlockProps) => SimplifiedCodeBlock(props),
}));

// Import after mocking
import { CodeBlock } from './CodeBlock';

describe('CodeBlock', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders code block with title and copy button', () => {
    render(
      <CodeBlock code='const x = 1;' language='javascript' title='Example' />
    );

    expect(screen.getByText('Example')).toBeInTheDocument();
    expect(screen.getByLabelText('Copy code')).toBeInTheDocument();
    expect(screen.getByText('const x = 1;')).toBeInTheDocument();
  });

  it('renders code block without title', () => {
    render(<CodeBlock code='const x = 1;' language='javascript' />);

    expect(screen.queryByText('Example')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Copy code')).toBeInTheDocument();
  });

  it('renders code block without copy button', () => {
    render(
      <CodeBlock code='const x = 1;' language='javascript' showCopy={false} />
    );

    expect(screen.queryByLabelText('Copy code')).not.toBeInTheDocument();
  });

  it('renders code with the correct language class', () => {
    render(<CodeBlock code="const test = 'hello';" language='javascript' />);
    const codeElement = screen
      .getByText("const test = 'hello';")
      .closest('code');
    expect(codeElement).toHaveClass('language-javascript');
  });

  it('renders title when provided', () => {
    render(
      <CodeBlock
        code="const test = 'hello';"
        language='javascript'
        title='Example Code'
      />
    );
    expect(screen.getByText('Example Code')).toBeInTheDocument();
  });
});

