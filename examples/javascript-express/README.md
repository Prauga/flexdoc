# Express + FlexDoc 3.0

This is the primary backend-native FlexDoc 3.0 showcase. Express serves the shared OpenAPI 3.1 contract, while FlexDoc runs inside the same backend and exposes the completed documentation/API Client surface plus live Runtime Intelligence.

The example intentionally registers `GET /internal/health` without documenting it. Open **Runtime** in FlexDoc to see a genuine implemented-but-undocumented route alongside the matched OpenAPI operations. That is the kind of backend knowledge a spec-only renderer cannot provide.

The renderer also demonstrates the 3.0 completion gate: persisted viewer preferences, deep links, keyboard command palette, mobile navigation, JSON/YAML download, Basic/Advanced Try It, handoff to the sibling API Client page, environments, scripts, the CodeMirror-backed editor, response inspection, collection/history workflows, and code samples.

```bash
npm install
npm start
```

Open `http://localhost:3000/docs`.

The FlexDoc dependency remains pinned to `3.1.0`, the last published release, during 3.0 release preparation. Repository CI replaces it with the backend package built from the current commit; the post-publish lock-refresh change will advance the registry pin.
