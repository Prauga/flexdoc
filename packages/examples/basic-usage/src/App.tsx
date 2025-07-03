import { FlexDoc, sampleSpec } from '@bluejeans/flexdoc-client';
import React, { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

function App() {
  const [darkMode, setDarkMode] = useState(() => {
    // Check for saved theme preference or use system preference
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme) return savedTheme === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  // Apply dark mode class to document element
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  return (
    <div className='min-h-screen bg-white dark:bg-gray-900 transition-colors duration-200'>
      <div className='container mx-auto p-6'>
        <div className='flex justify-end mb-4'>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className='p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-200'
            aria-label={
              darkMode ? 'Switch to light mode' : 'Switch to dark mode'
            }
          >
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>

        <main>
          <FlexDoc spec={sampleSpec} theme={darkMode ? 'dark' : 'light'} />
        </main>

        <footer className='mt-8 pt-4 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400'>
          <p>FlexDoc Basic Example - Using the FlexDoc component directly</p>
        </footer>
      </div>
    </div>
  );
}

export default App;

