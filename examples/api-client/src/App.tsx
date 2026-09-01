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
            Collections, folders, saved requests and named environments persist locally in this browser.
          </p>
          <p>
            Create an environment with <code>baseUrl</code> set to <code>https://jsonplaceholder.typicode.com</code>,
            then send the templated request below.
          </p>
        </div>
      </header>

      <ApiClientWorkspace
        persistenceKey="flexdoc-api-client-example"
        initialRequest={{
          method: 'GET',
          url: '{{baseUrl}}/posts/1',
          query: [],
          headers: [{ key: 'Accept', value: 'application/json', enabled: true }],
          auth: { type: 'none' },
        }}
      />
    </main>
  );
}
