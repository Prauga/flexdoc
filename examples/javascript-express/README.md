# Express + FlexDoc

This example serves the shared OpenAPI 3.1 feature showcase with Express and `@prauga/flexdoc-backend`. The API includes representative JSON, form, upload, parameter, authentication-metadata, multi-server, Try It, custom-server, API Client handoff, and code-sample flows.

```bash
npm install
npm start
```

Open `http://localhost:3000/docs`.

The FlexDoc dependency is pinned to `2.3.0`. During this release PR, CI installs the backend package from the same commit and boots `/docs`; after `2.3.0` is published, the manifest is directly runnable as written.
