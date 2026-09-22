# Express + FlexDoc 3.1

This is the primary backend-native FlexDoc 3.1 showcase. Express serves the shared OpenAPI 3.1 contract, while FlexDoc runs inside the same backend and exposes the completed documentation/API Client surface plus live Runtime Intelligence.

The example registers `GET /internal/health` without documenting it, and lists that operation in `runtimeIntelligence.acknowledgedUndocumented`. Contract validation stays green. The route remains in the runtime route list, which is how an intentionally private operation is kept out of the failure without pretending it is in the OpenAPI document.

The renderer also demonstrates the completed documentation/API Client surface: persisted viewer preferences, deep links, keyboard command palette, mobile navigation, JSON/YAML download, Basic/Advanced Try It, handoff to the sibling API Client page, environments, scripts, the CodeMirror-backed editor, response inspection, collection/history workflows, and code samples.

```bash
npm install
npm start
```

Open `http://localhost:3000/docs`.

The standalone FlexDoc dependency is pinned to `3.3.0`, the current published release, for reproducible installs. Repository CI replaces it with the backend package built from the current commit when validating source changes.
