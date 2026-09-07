import { ApiClientWorkspace } from '@prauga/flexdoc-client';

export function App() {
  return (
    <main className="shell">
      <header className="hero">
        <div>
          <p className="eyebrow">FlexDoc 3.0</p>
          <h1>API Client workspace</h1>
          <p>
            This standalone example exercises the canonical API-development surface without an OpenAPI document: arbitrary requests,
            collections and folders, runner/history workflows, named environments, variable resolution, auth, structured bodies,
            response search and headers, copy-as-cURL, persisted UI state, and keyboard-first request editing.
          </p>
          <p>
            Scripts use the CodeMirror-backed editor with FlexDoc diagnostics, formatting and <code>flex.*</code> IntelliSense. Create an
            environment with <code>baseUrl</code> set to <code>https://jsonplaceholder.typicode.com</code>, then send the templated request
            below. The variable preview resolves <code>baseUrl</code> and the pre-request script supplies <code>postId</code> before the tests
            validate the response.
          </p>
          <p>
            Use <kbd>Ctrl/Cmd+Enter</kbd> to send and <kbd>Shift+Alt+F</kbd> to format a script. Collapse state, the active request/script tabs,
            environment choice and workspace history survive reloads in this browser.
          </p>
        </div>
      </header>

      <ApiClientWorkspace
        persistenceKey="flexdoc-api-client-3-example"
        initialRequest={{
          method: 'GET',
          url: '{{baseUrl}}/posts/{{postId}}',
          query: [],
          headers: [{ key: 'Accept', value: 'application/json', enabled: true }],
          auth: { type: 'none' },
        }}
        initialScripts={{
          preRequest: "flex.variables.set('postId', '1');\nconsole.log('requesting post', flex.variables.get('postId'));",
          tests: "flex.test('status is 200', () => flex.expect(flex.response.code).to.equal(200));\nflex.test('post id is 1', () => flex.expect(flex.response.json()).to.have.property('id', 1));",
        }}
      />
    </main>
  );
}
