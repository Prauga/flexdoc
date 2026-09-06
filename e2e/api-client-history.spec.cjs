const { test, expect } = require('@playwright/test');

async function openApiClient(page) {
  await page.goto('/e2e/index.html#get-pets-id');
  await page.getByLabel('path id').fill('42');
  await page.getByRole('button', { name: 'Open in API Client' }).click();
  const apiClient = page.locator('section[aria-labelledby="api-client-heading"]');
  await expect(apiClient).toBeVisible();
  return apiClient;
}

test('API Client full history filters, inspects responses, and reopens requests', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'desktop history coverage');

  await page.route('https://history.example.test/**', async (route) => {
    const url = new URL(route.request().url());
    const failed = url.pathname.includes('/bad');
    await route.fulfill({
      status: failed ? 500 : 200,
      contentType: 'application/json',
      headers: { 'x-history': failed ? 'bad' : 'good' },
      body: JSON.stringify({ kind: failed ? 'bad' : 'good' }),
    });
  });

  let apiClient = await openApiClient(page);
  await apiClient.getByLabel('Request URL').fill('https://history.example.test/good');
  await apiClient.getByRole('button', { name: 'Send request' }).click();
  await expect(apiClient.getByText(/Response\s+200\s+OK/)).toBeVisible();

  await apiClient.getByLabel('HTTP method').selectOption('POST');
  await apiClient.getByLabel('Request URL').fill('https://history.example.test/bad');
  await apiClient.getByRole('button', { name: 'Send request' }).click();
  await expect(apiClient.getByText(/Response\s+500/)).toBeVisible();

  await page.getByRole('button', { name: 'Open full history · 2' }).click();
  const history = page.locator('section[aria-labelledby="api-client-history-page-heading"]');
  await expect(history).toBeVisible();
  await expect(history.getByText('Request history')).toBeVisible();

  const search = history.getByLabel('Search history');
  await search.fill('bad');
  await expect(search).toHaveValue('bad');
  await expect(history.getByText(/history\.example\.test\/bad/).first()).toBeVisible();
  await expect(history.getByText(/history\.example\.test\/good/)).toHaveCount(0);
  await expect(history.getByText('{"kind":"bad"}')).toBeVisible();

  await search.fill('');
  const outcome = history.getByLabel('History outcome filter');
  await outcome.selectOption('failed');
  await expect(outcome).toHaveValue('failed');
  await expect(history.getByText(/history\.example\.test\/bad/).first()).toBeVisible();
  await expect(history.getByText(/history\.example\.test\/good/)).toHaveCount(0);

  await outcome.selectOption('all');
  const method = history.getByLabel('History method filter');
  await method.selectOption('GET');
  await expect(method).toHaveValue('GET');
  await expect(history.getByText(/history\.example\.test\/good/).first()).toBeVisible();
  await expect(history.getByText(/history\.example\.test\/bad/)).toHaveCount(0);

  await method.selectOption('all');
  await search.fill('bad');
  await history.getByRole('button', { name: /Open in client/i }).click();
  apiClient = page.locator('section[aria-labelledby="api-client-heading"]');
  await expect(apiClient).toBeVisible();
  await expect(apiClient.getByLabel('HTTP method')).toHaveValue('POST');
  await expect(apiClient.getByLabel('Request URL')).toHaveValue('https://history.example.test/bad');

  await page.reload();
  apiClient = await openApiClient(page);
  await page.getByRole('button', { name: 'Open full history · 2' }).click();
  const reopenedHistory = page.locator('section[aria-labelledby="api-client-history-page-heading"]');
  await expect(reopenedHistory.getByText('{"kind":"bad"}')).toBeVisible();
});
