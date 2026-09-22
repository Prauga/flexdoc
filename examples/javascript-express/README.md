# Express + FlexDoc 3.1

This is the primary backend-native FlexDoc 3.1 showcase. Express serves the shared OpenAPI 3.1 contract, while FlexDoc runs inside the same backend and exposes the completed documentation/API Client surface plus live Runtime Intelligence.

`GET /internal/health` is registered and listed in `runtimeIntelligence.acknowledgedUndocumented`. It stays a runtime-only route, the finding is informational, and it does not fail validation. `POST /internal/reindex` is also registered and is not acknowledged, so contract validation fails. Open **Runtime**, then that finding, to see the registered route beside the missing contract and send it from the API Client.

The renderer also demonstrates the completed documentation/API Client surface: persisted viewer preferences, deep links, keyboard command palette, mobile navigation, JSON/YAML download, Basic/Advanced Try It, handoff to the sibling API Client page, environments, scripts, the CodeMirror-backed editor, response inspection, collection/history workflows, and code samples.

```bash
npm install
npm start
```

Open `http://localhost:3000/docs`.

The standalone FlexDoc dependency is pinned to `3.3.0`, the current published release, for reproducible installs. Repository CI replaces it with the backend package built from the current commit when validating source changes.
