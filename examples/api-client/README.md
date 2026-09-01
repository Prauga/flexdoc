# FlexDoc API Client example

This is the dedicated standalone API Client demo. It renders `ApiClientWorkspace` without an OpenAPI document so you can exercise the API-development workflow directly.

It demonstrates arbitrary HTTP requests, query parameters, headers, common auth, request bodies, response inspection, collections, folders, saved requests, named environments, `{{variable}}` substitution, and IndexedDB-backed local persistence. New API Client roadmap features are added to this example as they land.

From the repository root:

```bash
npm install
npm run example:api-client
```

Then open the Vite URL printed in the terminal. The initial request uses `{{baseUrl}}/posts/1`; create an environment such as `Demo`, add `baseUrl=https://jsonplaceholder.typicode.com`, and send it. Saving the request keeps the template rather than baking the selected environment value into the collection.
