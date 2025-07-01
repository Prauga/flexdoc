import React, { useEffect } from 'react';
import Prism from 'prismjs';
import 'prismjs/themes/prism-tomorrow.css';
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
}

export const CodeBlock: React.FC<CodeBlockProps> = ({
  code,
  language,
  title,
  showCopy = true,
}) => {
  const [copied, setCopied] = React.useState(false);

  useEffect(() => {
    Prism.highlightAll();
  }, [code]);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <div className='bg-gray-900 rounded-lg overflow-hidden border border-gray-700'>
      {(title || showCopy) && (
        <div className='flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700'>
          {title && (
            <span className='text-sm font-medium text-gray-300'>{title}</span>
          )}
          {showCopy && (
            <button
              onClick={copyToClipboard}
              className='flex items-center gap-1 text-xs text-gray-400 hover:text-gray-200 transition-colors'
            >
              {copied ? (
                <>
                  <Check className='w-3 h-3' />
                  Copied
                </>
              ) : (
                <>
                  <Copy className='w-3 h-3' />
                  Copy
                </>
              )}
            </button>
          )}
        </div>
      )}
      <div className='p-4 overflow-x-auto'>
        <pre className='text-sm'>
          <code className={`language-${language}`}>{code}</code>
        </pre>
      </div>
    </div>
  );
};
