import { FlexDoc, sampleSpec } from '@prauga/flexdoc-client';

function App() {
  return (
    <FlexDoc
      spec={sampleSpec}
      theme='dark'
      options={{
        title: 'FlexDoc 3.0 Interactive Showcase',
        description: 'The complete framework-neutral renderer surface: deep links, persisted viewer preferences, keyboard navigation, Try It, API Client handoff, code samples, downloads, themes, mobile navigation and accessibility.',
        version: '3.0.0',
        locale: 'en',
        expand: 'interactive',
        showExtensions: true,
        showCommonExtensions: true,
        requiredPropsFirst: true,
        sortPropsAlphabetically: true,
        showRequestHeaders: true,
        tryIt: {
          enabled: true,
          credentials: 'same-origin',
          apiClientPersistenceKey: 'flexdoc-interactive-3-showcase',
        },
        codeSamples: {
          enabled: true,
          languages: ['curl', 'javascript', 'python', 'go', 'java'],
        },
        footer: {
          copyright: 'Prauga FlexDoc 3.0 showcase',
          link: [{ text: 'Repository', url: 'https://github.com/Prauga/flexdoc', icon: 'github' }],
        },
      }}
    />
  );
}

export default App;
