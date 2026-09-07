# FlexDoc 3.0 API Client example

This is the dedicated standalone 3.0 API Client showcase. It renders `ApiClientWorkspace` without an OpenAPI document so the API-development workflow can be exercised independently of the documentation viewer.

It demonstrates arbitrary HTTP requests, bulk query/header editing, common auth and structured bodies; named environments and `{{variable}}` resolution/peek; the CodeMirror-backed script editor with diagnostics, formatting and `flex.*` IntelliSense; response search, header inspection and copy-as-cURL; collections, nested folders, saved requests and collection runner; persisted history and replay; unsaved-request state; keyboard shortcuts; and IndexedDB-backed UI/workspace persistence.

From the repository root:

```bash
npm install
npm run example:api-client
```

Open the Vite URL printed in the terminal. The initial request uses `{{baseUrl}}/posts/{{postId}}`; create an environment such as `Demo`, add `baseUrl=https://jsonplaceholder.typicode.com`, and send it. The pre-request script supplies the run-local `postId`, and the test script validates the JSONPlaceholder response. Saving the request keeps the raw template and both scripts rather than baking the selected environment value into the collection.

This client-only example intentionally does **not** advertise Runtime Intelligence. Runtime route discovery exists only in framework examples where FlexDoc is installed inside a backend with a genuine route inventory.

Request scripts are trusted local JavaScript and are not a security sandbox. Only run script content you trust.
