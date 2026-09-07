import React from 'react';
import ReactDOM from 'react-dom/client';
import { FlexDoc } from '../src/components/FlexDoc';
import { openapi30Spec } from '../src/fixtures/openapi/compatibility';

const spec = JSON.parse(JSON.stringify(openapi30Spec));
spec.info.title = 'FlexDoc Browser Fixture';
spec.servers = [
  { url: 'https://api.example.test', description: 'Primary test server' },
  { url: 'https://backup.example.test', description: 'Backup test server' },
];
spec.paths['/pets/{id}'].get.summary = 'Get a pet';
spec.paths['/payload'].post.summary = 'Create a payload';
const query = new URLSearchParams(window.location.search);
const hostExecution = query.get('hostExecution') === '1' ? {
  available: true,
  endpoint: '/e2e/__flexdoc/execute',
  cookiesEndpoint: '/e2e/__flexdoc/cookies',
  capabilities: ['cookies', 'clientCertificates', 'digest', 'hawk', 'oauth1', 'awsv4'] as const,
  clientCertificates: [{ id: 'client-cert', name: 'Fixture client certificate' }],
} : undefined;
const runtimeIntelligence = query.get('runtime') === '1' ? {
  available: true,
  endpoint: '/e2e/__flexdoc/runtime',
  framework: 'express',
} : undefined;
const theme = query.get('theme') === 'dark' ? 'dark' : 'light';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <FlexDoc
      spec={spec}
      theme={theme}
      options={{
        hideDownloadButton: true,
        hideTopbar: query.get('hideTopbar') === '1',
        expand: 'all',
        runtimeIntelligence,
        tryIt: { enabled: true, ...(hostExecution ? { hostExecution } : {}) },
        codeSamples: { enabled: true, languages: ['curl', 'javascript', 'python', 'go', 'java'] },
      }}
    />
  </React.StrictMode>,
);
