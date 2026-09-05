const { test, expect } = require('@playwright/test');

test('API Client acquires and refreshes OAuth client-credentials tokens', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'desktop OAuth workspace coverage');

  const tokenBodies = [];
  let tokenCall = 0;
  await page.route('https://identity.example.test/token', async (route) => {
    tokenBodies.push(route.request().postData() || '');
    tokenCall += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(tokenCall === 1
        ? { access_token: 'issued-token', refresh_token: 'refresh-token', expires_in: 3600 }
        : { access_token: 'refreshed-token' }),
    });
  });

  const apiRequests = [];
  await page.route('https://oauth-api.example.test/**', async (route) => {
    apiRequests.push(route.request().headers());
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });

  await page.goto('/e2e/index.html#get-pets-id');
  await page.getByLabel('path id').fill('42');
  await page.getByRole('button', { name: 'Open in API Client' }).click();
  const apiClient = page.locator('section[aria-labelledby="api-client-heading"]');
  await apiClient.getByLabel('Request URL').fill('https://oauth-api.example.test/pets');
  await apiClient.getByLabel('Authorization type', { exact: true }).selectOption('oauth2');
  await apiClient.getByLabel('OAuth grant type').selectOption('clientCredentials');
  await apiClient.getByLabel('OAuth token URL').fill('https://identity.example.test/token');
  await apiClient.getByLabel('OAuth client ID').fill('client-id');
  await apiClient.getByLabel('OAuth client secret').fill('client-secret');
  await apiClient.getByLabel('OAuth scopes').fill('pets.read pets.write');

  await apiClient.getByRole('button', { name: 'Get access token' }).click();
  await expect(apiClient.getByRole('status')).toContainText('Access token acquired');
  await expect(apiClient.getByLabel('OAuth access token')).toHaveValue('issued-token');
  let params = new URLSearchParams(tokenBodies[0]);
  expect(params.get('grant_type')).toBe('client_credentials');
  expect(params.get('client_id')).toBe('client-id');
  expect(params.get('client_secret')).toBe('client-secret');
  expect(params.get('scope')).toBe('pets.read pets.write');

  await apiClient.getByRole('button', { name: 'Send request' }).click();
  await expect(apiClient.getByText(/Response\s+200\s+OK/)).toBeVisible();
  expect(apiRequests[0].authorization).toBe('Bearer issued-token');

  await apiClient.getByRole('button', { name: 'Refresh access token' }).click();
  await expect(apiClient.getByRole('status')).toContainText('Access token refreshed');
  await expect(apiClient.getByLabel('OAuth access token')).toHaveValue('refreshed-token');
  params = new URLSearchParams(tokenBodies[1]);
  expect(params.get('grant_type')).toBe('refresh_token');
  expect(params.get('refresh_token')).toBe('refresh-token');

  await apiClient.getByRole('button', { name: 'Send request' }).click();
  expect(apiRequests[1].authorization).toBe('Bearer refreshed-token');
});
