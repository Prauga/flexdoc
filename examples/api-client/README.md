# FlexDoc API Client example

This is the dedicated standalone API Client demo. It renders `ApiClientWorkspace` without an OpenAPI document so you can exercise the API-development workflow directly.

It currently demonstrates arbitrary HTTP requests, query parameters, headers, common auth, request bodies, response inspection, collections, folders, saved requests, and IndexedDB-backed local persistence. New API Client roadmap features are added to this example as they land.

From the repository root:

```bash
npm install
npm run example:api-client
```

Then open the Vite URL printed in the terminal. To verify the example without starting a dev server, run `npm run build -w examples/api-client`.
