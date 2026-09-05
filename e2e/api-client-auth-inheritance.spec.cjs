const { test, expect } = require('@playwright/test');

test('API Client resolves collection and nested-folder auth inheritance', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'desktop auth workspace coverage');

  const requests = [];
  await page.route('https://auth.example.test/**', async (route) => {
    requests.push({ url: route.request().url(), headers: route.request().headers() });
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });

  await page.goto('/e2e/index.html#get-pets-id');
  await page.getByLabel('path id').fill('42');
  await page.getByRole('button', { name: 'Open in API Client' }).click();
  const apiClient = page.locator('section[aria-labelledby="api-client-heading"]');
  await expect(apiClient).toBeVisible();
  await apiClient.getByLabel('Request URL').fill('https://auth.example.test/pets');

  await apiClient.getByLabel('Collection authorization type').selectOption('bearer');
  await apiClient.getByLabel('Collection bearer token').fill('collection-token');
  await apiClient.getByLabel('Authorization type', { exact: true }).selectOption('inherit');
  await apiClient.getByRole('button', { name: 'Send request' }).click();
  await expect(apiClient.getByText(/Response\s+200\s+OK/)).toBeVisible();
  expect(requests[0].headers.authorization).toBe('Bearer collection-token');

  await apiClient.getByLabel('New folder name').fill('Pets');
  await apiClient.getByRole('button', { name: 'Add folder' }).click();
  await apiClient.getByLabel('Folder authorization type').selectOption('basic');
  await apiClient.getByLabel('Folder basic username').fill('folder-user');
  await apiClient.getByLabel('Folder basic password').fill('folder-pass');

  await apiClient.getByLabel('New folder name').fill('Admin');
  await apiClient.getByRole('button', { name: 'Add folder' }).click();
  await expect(apiClient.getByText('Folder authorization — Pets / Admin')).toBeVisible();
  await apiClient.getByRole('button', { name: 'Send request' }).click();
  expect(requests[1].headers.authorization).toBe(`Basic ${Buffer.from('folder-user:folder-pass').toString('base64')}`);

  await apiClient.getByLabel('Folder authorization type').selectOption('apiKey');
  await apiClient.getByLabel('Folder API key name').fill('X-Admin-Key');
  await apiClient.getByLabel('Folder API key value').fill('admin-secret');
  await apiClient.getByRole('button', { name: 'Send request' }).click();
  expect(requests[2].headers['x-admin-key']).toBe('admin-secret');

  await apiClient.getByLabel('Folder API key location').selectOption('query');
  await apiClient.getByRole('button', { name: 'Send request' }).click();
  expect(requests[3].url).toContain('X-Admin-Key=admin-secret');
  expect(requests[3].headers['x-admin-key']).toBeUndefined();

  await apiClient.getByLabel('Authorization type', { exact: true }).selectOption('none');
  await apiClient.getByRole('button', { name: 'Send request' }).click();
  expect(requests[4].headers.authorization).toBeUndefined();
  expect(requests[4].headers['x-admin-key']).toBeUndefined();
  expect(requests[4].url).not.toContain('X-Admin-Key=');
});
