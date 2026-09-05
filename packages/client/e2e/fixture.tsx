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

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <FlexDoc
      spec={spec}
      options={{
        hideDownloadButton: true,
        hideTopbar: query.get('hideTopbar') === '1',
        expand: 'all',
        tryIt: { enabled: true },
        codeSamples: { enabled: true, languages: ['curl', 'javascript', 'python', 'go', 'java'] },
      }}
    />
  </React.StrictMode>,
);
