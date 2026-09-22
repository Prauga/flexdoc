# Try the disagreement loop with Express

This is the evaluation path. Express registers two routes the OpenAPI document does not describe.

| Route | What FlexDoc records | Validation |
| --- | --- | --- |
| `GET /internal/health` | Runtime-only, acknowledged | Passes. The finding stays informational. |
| `POST /internal/reindex` | Runtime-only, not acknowledged | Fails. The finding names the method and path. |

Open **Runtime**, then `POST /internal/reindex`. The page shows that OpenAPI does not declare the operation beside the route Express registered. **Open in API Client** sends that method and path.

```bash
npm install
npm start
```

Open `http://localhost:3000/docs/example-login` first. That sets the demo cookie for `/docs`. Then open `http://localhost:3000/docs`.

```bash
npx @prauga/flexdoc-cli validate \
  http://localhost:3000/docs/__flexdoc/runtime \
  --header 'Cookie: flexdoc-example-session=demo'
```

The command prints the acknowledged health route and exits `1` on `POST /internal/reindex`.

The same page also includes the documentation and API Client surface: Try It, code samples, environments, and scripts. The standalone dependency is pinned to published `@prauga/flexdoc-backend` `3.5.0`. Repository CI replaces it with the backend package built from the current commit.
