const { test, expect } = require('@playwright/test');

test('API Client resolves collection variables and lets the active environment override them', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'desktop workspace coverage');

  const requests = [];
  await page.route(/https:\/\/(collection|environment)\.example\.test\/.*/, async (route) => {
    requests.push(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.goto('/e2e/index.html#get-pets-id');
  await page.getByLabel('path id').fill('42');
  await page.getByRole('button', { name: 'Open in API Client' }).click();
  const apiClient = page.locator('section[aria-labelledby="api-client-heading"]');
  await expect(apiClient).toBeVisible();

  await apiClient.getByRole('button', { name: 'Add collection variable' }).click();
  await apiClient.getByLabel('Collection variable 1 key').fill('baseUrl');
  await apiClient.getByLabel('Collection variable 1 value').fill('https://collection.example.test');
  await apiClient.getByLabel('Request URL').fill('{{baseUrl}}/pets');
  await apiClient.getByRole('button', { name: 'Send request' }).click();
  await expect(apiClient.getByText(/Response\s+200\s+OK/)).toBeVisible();
  expect(requests[0]).toBe('https://collection.example.test/pets?locale=fr');

  await apiClient.getByLabel('New environment name').fill('Override');
  await apiClient.getByRole('button', { name: 'Add environment' }).click();
  await apiClient.getByRole('button', { name: 'Add environment variable' }).click();
  await apiClient.getByLabel('Environment variable 1 key').fill('baseUrl');
  await apiClient.getByLabel('Environment variable 1 value').fill('https://environment.example.test');
  await apiClient.getByRole('button', { name: 'Send request' }).click();
  expect(requests[1]).toBe('https://environment.example.test/pets?locale=fr');

  await apiClient.getByLabel('Active environment').selectOption('');
  await apiClient.getByRole('button', { name: 'Send request' }).click();
  expect(requests[2]).toBe('https://collection.example.test/pets?locale=fr');
});
