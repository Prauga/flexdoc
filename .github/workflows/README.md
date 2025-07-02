# FlexDoc GitHub Workflows

This directory contains GitHub Actions workflows for automating various tasks in the FlexDoc repository.

## npm-publish.yml

This workflow publishes the FlexDoc backend package to the public npm registry.

### Triggers

The workflow can be triggered in two ways:

1. **Automatically on Release**: When a new GitHub Release is created, the workflow will automatically publish the package to the public npm registry with the version from the release tag.

2. **Manually**: You can trigger the workflow manually from the GitHub Actions tab, specifying:
   - **Version**: The version increment type:
     - `patch`: Increments the patch version (e.g., 1.0.0 → 1.0.1)
     - `minor`: Increments the minor version (e.g., 1.0.0 → 1.1.0)
     - `major`: Increments the major version (e.g., 1.0.0 → 2.0.0)
     - Or specify a specific version (e.g., `1.2.3`)

### What it does

1. Checks out the repository
2. Sets up Node.js with the npm registry configuration
3. Installs dependencies
4. Builds the packages
5. Updates the package.json (changes package name for npm registry)
6. Updates the version based on the trigger type
7. Publishes the backend package to the npm registry

### Requirements

- For publishing to the npm registry:
  - You need to add an `NPM_TOKEN` secret to your repository
  - You can create this token at https://www.npmjs.com/settings/[your-username]/tokens

### Installing the published package

Users can install the package with a simple command:

```bash
npm install @bluejeans/flexdoc-backend
```
