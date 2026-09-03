const { test, expect } = require('@playwright/test');

async function openApiClient(page) {
  await page.goto('/e2e/index.html#get-pets-id');
  await page.getByLabel('path id').fill('42');
  await page.getByRole('button', { name: 'Open in API Client' }).click();
  const apiClient = page.locator('section[aria-labelledby="api-client-heading"]');
  await expect(apiClient).toBeVisible();
  return apiClient;
}

test('API Client persists nested folders and request placement across reloads', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'desktop workspace coverage');

  let apiClient = await openApiClient(page);

  await apiClient.getByLabel('New folder name').fill('Pets');
  await apiClient.getByRole('button', { name: 'Add folder' }).click();
  await expect(apiClient.getByRole('button', { name: 'Select folder Pets', exact: true })).toBeVisible();

  await apiClient.getByLabel('New folder name').fill('Admin');
  await apiClient.getByRole('button', { name: 'Add folder' }).click();
  await expect(apiClient.getByRole('button', { name: 'Select folder Pets / Admin', exact: true })).toBeVisible();
  await expect(apiClient.getByText('New folders are created inside Pets / Admin.')).toBeVisible();

  await apiClient.getByLabel('Saved request name').fill('Nested pets request');
  await apiClient.getByRole('button', { name: 'Save request' }).click();
  await expect(apiClient.getByRole('button', { name: 'Load saved request Nested pets request' })).toBeVisible();
  await expect(apiClient.getByLabel('Saved request folder').locator('option:checked')).toHaveText('— Admin');

  await page.reload();
  apiClient = await openApiClient(page);

  await expect(apiClient.getByRole('button', { name: 'Select folder Pets', exact: true })).toBeVisible();
  await expect(apiClient.getByRole('button', { name: 'Select folder Pets / Admin', exact: true })).toBeVisible();
  await expect(apiClient.getByRole('button', { name: 'Load saved request Nested pets request' })).toBeVisible();

  await apiClient.getByRole('button', { name: 'Load saved request Nested pets request' }).click();
  const folderSelect = apiClient.getByLabel('Saved request folder');
  await expect(folderSelect.locator('option:checked')).toHaveText('— Admin');
});
