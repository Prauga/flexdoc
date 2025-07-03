import React, { useEffect } from 'react';
import Prism from 'prismjs';
import 'prismjs/themes/prism-tomorrow.css'; // Dark theme
import 'prismjs/themes/prism.css'; // Light theme
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-bash';
import { Copy, Check } from 'lucide-react';

interface CodeBlockProps {
  code: string;
  language: string;
  title?: string;
  showCopy?: boolean;
  theme?: 'light' | 'dark';
}

export const CodeBlock: React.FC<CodeBlockProps> = ({
  code,
  language,
  title,
  showCopy = true,
  theme = 'dark',
}) => {
  const [copied, setCopied] = React.useState(false);

  useEffect(() => {
    Prism.highlightAll();
  }, [code, theme]);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  // Theme-specific classes
  const containerClasses =
    theme === 'dark'
      ? 'bg-gray-900 border-gray-700'
      : 'bg-gray-50 border-gray-200';

  const headerClasses =
    theme === 'dark'
      ? 'bg-gray-800 border-gray-700 text-gray-300'
      : 'bg-gray-100 border-gray-200 text-gray-700';

  const buttonClasses =
    theme === 'dark'
      ? 'text-gray-400 hover:text-gray-200'
      : 'text-gray-500 hover:text-gray-900';

  return (
    <div className={`rounded-lg overflow-hidden border ${containerClasses}`}>
      {(title || showCopy) && (
        <div
          className={`flex items-center justify-between px-4 py-2 border-b ${headerClasses}`}
        >
          {title && (
            <span
              className={`text-sm font-medium ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}
            >
              {title}
            </span>
          )}
          {showCopy && (
            <button
              onClick={copyToClipboard}
              className={`flex items-center gap-1 text-xs transition-colors ${buttonClasses}`}
              aria-label='Copy code to clipboard'
            >
              {copied ? (
                <>
                  <Check className='w-3 h-3' />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className='w-3 h-3' />
                  <span>Copy</span>
                </>
              )}
            </button>
          )}
        </div>
      )}
      <div
        className={`p-4 overflow-x-auto ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}
      >
        <pre
          className={`text-sm ${theme === 'dark' ? 'text-gray-100' : 'text-gray-800'}`}
        >
          <code
            className={`language-${language} ${theme === 'dark' ? 'bg-transparent' : 'bg-transparent'}`}
          >
            {code}
          </code>
        </pre>
      </div>
    </div>
  );
};

