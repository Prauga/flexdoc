# FlexDoc API Client example

This is the dedicated standalone API Client demo. It renders `ApiClientWorkspace` without an OpenAPI document so you can exercise the API-development workflow directly.

It demonstrates arbitrary HTTP requests, query parameters, headers, common auth, request bodies, response inspection, collections, folders, saved requests, named environments, `{{variable}}` substitution, pre-request scripts, response tests, captured script console output, and IndexedDB-backed local persistence. New API Client roadmap features are added to this example as they land.

From the repository root:

```bash
npm install
npm run example:api-client
```

Then open the Vite URL printed in the terminal. The initial request uses `{{baseUrl}}/posts/{{postId}}`; create an environment such as `Demo`, add `baseUrl=https://jsonplaceholder.typicode.com`, and send it. The pre-request script uses the `flex.*` scripting API to set the run-local `postId`, and the test script validates the JSONPlaceholder response. Saving the request keeps the raw template and both scripts rather than baking the selected environment value into the collection.

Request scripts are trusted local JavaScript and are not a security sandbox. Only run script content you trust.
