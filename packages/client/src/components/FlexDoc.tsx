import React, { useState } from 'react';
import { OpenAPISpec } from '../types/openapi';
import { Sidebar } from './Sidebar';
import { EndpointDetail } from './EndpointDetail';
import { Overview } from './Overview';
import '../index.css'; // Import the CSS directly
import { Footer } from './Footer';
import { themeVariant } from '../utils/theme';

export interface FlexDocProps {
  spec: OpenAPISpec;
  theme?: 'light' | 'dark';
  customStyles?: React.CSSProperties;
}

export const FlexDoc: React.FC<FlexDocProps> = ({
  spec,
  theme = 'light',
  customStyles = {},
}: FlexDocProps) => {
  const [selectedEndpoint, setSelectedEndpoint] = useState<{
    path: string;
    method: string;
  } | null>(null);

  const handleEndpointSelect = (path: string, method: string) => {
    setSelectedEndpoint({ path, method });
  };

  const footerClasses = themeVariant(
    theme,
    'border-t border-gray-200 bg-white text-gray-600',
    'border-t border-gray-700 bg-gray-800 text-gray-300'
  );

  return (
    <div className='flex flex-col min-h-screen'>
      <div className='flex-1'>
        <div
          className={`flex h-screen ${
            theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
          }`}
          style={customStyles}
        >
          <Sidebar
            spec={spec}
            onEndpointSelect={handleEndpointSelect}
            theme={theme}
            selectedEndpoint={selectedEndpoint || undefined}
          />

          <div className='flex-1 flex flex-col'>
            {selectedEndpoint ? (
              <EndpointDetail
                spec={spec}
                path={selectedEndpoint.path}
                method={selectedEndpoint.method}
                theme={theme}
              />
            ) : (
              <Overview
                spec={spec}
                onEndpointSelect={handleEndpointSelect}
                theme={theme}
              />
            )}
          </div>
        </div>
        <Footer footerClasses={footerClasses} />
      </div>
    </div>
  );
};

