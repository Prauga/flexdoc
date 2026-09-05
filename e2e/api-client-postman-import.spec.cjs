const { test, expect } = require('@playwright/test');

async function openApiClient(page) {
  await page.goto('/e2e/index.html#get-pets-id');
  await page.getByLabel('path id').fill('42');
  await page.getByRole('button', { name: 'Open in API Client' }).click();
  const apiClient = page.locator('section[aria-labelledby="api-client-heading"]');
  await expect(apiClient).toBeVisible();
  return apiClient;
}

test('API Client imports Postman collections and environments into persisted workspace state', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'desktop workspace coverage');

  let apiClient = await openApiClient(page);
  const collection = {
    info: {
      name: 'Postman Pets',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    variable: [{ key: 'baseUrl', value: 'https://collection.example.test' }],
    item: [{
      name: 'Pets',
      item: [{
        name: 'Admin',
        item: [{
          name: 'Get pet',
          request: {
            method: 'GET',
            url: {
              raw: '{{baseUrl}}/pets/:petId?expand=owner',
              query: [{ key: 'expand', value: 'owner' }],
              variable: [{ key: 'petId', value: '42' }],
            },
          },
          event: [{
            listen: 'test',
            script: { exec: ["pm.test('status', () => pm.expect(pm.response.code).to.eql(200));"] },
          }],
        }],
      }],
    }],
  };
  const environment = {
    name: 'Local',
    _postman_variable_scope: 'environment',
    values: [{ key: 'baseUrl', value: 'https://environment.example.test', enabled: true }],
  };

  await apiClient.getByLabel('Import Postman JSON').setInputFiles([
    { name: 'pets.postman_collection.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(collection)) },
    { name: 'local.postman_environment.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(environment)) },
  ]);

  await expect(apiClient.getByText('Imported 1 collection and 1 environment.')).toBeVisible();
  await expect(apiClient.getByRole('button', { name: 'Postman Pets', exact: true })).toBeVisible();
  await expect(apiClient.getByRole('button', { name: 'Select folder Pets / Admin', exact: true })).toBeVisible();
  await expect(apiClient.getByRole('button', { name: 'Load saved request Get pet' })).toBeVisible();
  await expect(apiClient.getByLabel('Active environment')).toHaveText(/Local/);

  await apiClient.getByRole('button', { name: 'Load saved request Get pet' }).click();
  await expect(apiClient.getByLabel('Request URL')).toHaveValue('{{baseUrl}}/pets/{{petId}}');
  await expect(apiClient.getByLabel('Tests script')).toHaveValue(/flex\.test\('status'/);

  await page.reload();
  apiClient = await openApiClient(page);
  await expect(apiClient.getByRole('button', { name: 'Postman Pets', exact: true })).toBeVisible();
  await expect(apiClient.getByRole('button', { name: 'Load saved request Get pet' })).toBeVisible();
  await expect(apiClient.getByLabel('Active environment')).toHaveText(/Local/);
});
