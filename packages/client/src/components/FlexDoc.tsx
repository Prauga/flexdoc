import React, { useState } from 'react';
import { OpenAPISpec } from '../types/openapi';
import { Sidebar } from './Sidebar';
import { EndpointDetail } from './EndpointDetail';
import { Overview } from './Overview';

interface FlexDocProps {
  spec: OpenAPISpec;
  theme?: 'light' | 'dark';
  customStyles?: React.CSSProperties;
}

export const FlexDoc: React.FC<FlexDocProps> = ({
  spec,
  theme = 'light',
  customStyles,
}) => {
  const [selectedEndpoint, setSelectedEndpoint] = useState<{
    path: string;
    method: string;
  } | null>(null);

  const handleEndpointSelect = (path: string, method: string) => {
    setSelectedEndpoint({ path, method });
  };

  return (
    <div
      className={`flex h-screen ${
        theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
      }`}
      style={customStyles}
    >
      <Sidebar
        spec={spec}
        onEndpointSelect={handleEndpointSelect}
        selectedEndpoint={selectedEndpoint || undefined}
      />

      <div className='flex-1 flex flex-col'>
        {selectedEndpoint ? (
          <EndpointDetail
            spec={spec}
            path={selectedEndpoint.path}
            method={selectedEndpoint.method}
          />
        ) : (
          <Overview spec={spec} onEndpointSelect={handleEndpointSelect} />
        )}
      </div>
    </div>
  );
};
