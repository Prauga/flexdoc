import { ApiClientWorkspace } from '@prauga/flexdoc-client';

export function App() {
  return (
    <main className="shell">
      <header className="hero">
        <div>
          <p className="eyebrow">FlexDoc</p>
          <h1>API Client</h1>
          <p>
            A standalone API development workspace powered by the same canonical request engine as FlexDoc Try It.
            Collections, folders and saved requests persist locally in this browser.
          </p>
        </div>
      </header>

      <ApiClientWorkspace
        persistenceKey="flexdoc-api-client-example"
        initialRequest={{
          method: 'GET',
          url: 'https://jsonplaceholder.typicode.com/posts/1',
          query: [],
          headers: [{ key: 'Accept', value: 'application/json', enabled: true }],
          auth: { type: 'none' },
        }}
      />
    </main>
  );
}
