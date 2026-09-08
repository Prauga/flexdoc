const fs = require('node:fs/promises');
const { test, expect } = require('@playwright/test');

async function openApiClient(page) {
  await page.goto('/e2e/index.html#get-~2Fpets~2F~7Bid~7D');
  await page.getByRole('button', { name: 'Open in API Client' }).click();
  const apiClient = page.locator('[data-api-client-page="api-client"]');
  await expect(apiClient).toBeVisible();
  return apiClient;
}

async function downloadArtifact(page, button) {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    button.click(),
  ]);
  const path = await download.path();
  if (!path) throw new Error('Runner artifact download did not produce a local file');
  return {
    filename: download.suggestedFilename(),
    artifact: JSON.parse(await fs.readFile(path, 'utf8')),
  };
}

test('workspace exports request, folder, and collection scopes for the headless Runner', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'desktop Runner export coverage');

  const apiClient = await openApiClient(page);
  const collections = page.locator('section[aria-labelledby="api-client-collections-heading"]');
  await expect(collections.getByText(/Runner exports can include saved authentication, collection variables, and the active environment/)).toBeVisible();

  await apiClient.getByLabel('New environment name').fill('CI');
  await apiClient.getByRole('button', { name: 'Add environment' }).click();
  await apiClient.getByRole('button', { name: 'Add environment variable' }).click();
  await apiClient.getByLabel('Environment variable 1 key').fill('baseUrl');
  await apiClient.getByLabel('Environment variable 1 value').fill('https://runner-export.example.test');

  await collections.getByLabel('New folder name').fill('Smoke');
  await collections.getByRole('button', { name: 'Add folder' }).click();

  await apiClient.getByLabel('Request URL').fill('{{baseUrl}}/pets/42');
  await collections.getByLabel('Saved request name').fill('Get pet');
  await collections.getByRole('button', { name: 'Save request' }).click();

  const requestDownload = await downloadArtifact(
    page,
    collections.getByRole('button', { name: 'Export saved request Get pet for Runner' }),
  );
  expect(requestDownload.filename).toBe('get-pet.flexdoc.json');
  expect(requestDownload.artifact.kind).toBe('flexdoc-runner');
  expect(requestDownload.artifact.version).toBe(1);
  expect(requestDownload.artifact.scope.type).toBe('request');
  expect(requestDownload.artifact.workspace.requests).toHaveLength(1);
  expect(requestDownload.artifact.workspace.requests[0].name).toBe('Get pet');
  expect(requestDownload.artifact.workspace.folders.map((folder) => folder.name)).toEqual(['Smoke']);
  expect(requestDownload.artifact.workspace.environments).toHaveLength(1);
  expect(requestDownload.artifact.workspace.environments[0].name).toBe('CI');
  expect(requestDownload.artifact.workspace.environments[0].variables[0]).toMatchObject({ key: 'baseUrl', value: 'https://runner-export.example.test' });
  expect(requestDownload.artifact.workspace.history).toEqual([]);

  const folderDownload = await downloadArtifact(
    page,
    collections.getByRole('button', { name: 'Export folder Smoke for Runner' }),
  );
  expect(folderDownload.filename).toBe('smoke.flexdoc.json');
  expect(folderDownload.artifact.scope.type).toBe('folder');
  expect(folderDownload.artifact.workspace.requests.map((request) => request.name)).toEqual(['Get pet']);

  const collectionDownload = await downloadArtifact(
    page,
    collections.getByRole('button', { name: 'Export collection My Collection for Runner' }),
  );
  expect(collectionDownload.filename).toBe('my-collection.flexdoc.json');
  expect(collectionDownload.artifact.scope.type).toBe('collection');
  expect(collectionDownload.artifact.workspace.requests.map((request) => request.name)).toEqual(['Get pet']);
  expect(collectionDownload.artifact.workspace.environments[0].name).toBe('CI');
});
