const { test, expect } = require('@playwright/test');

async function openApiClient(page) {
  await page.goto('/e2e/index.html#get-~2Fpets~2F~7Bid~7D');
  await page.getByRole('button', { name: 'Open in API Client' }).click();
  const apiClient = page.locator('[data-api-client-page="api-client"]');
  await expect(apiClient).toBeVisible();
  return apiClient;
}

test('collection runner exposes order, runs expected HTTP errors, and groups run history', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'desktop runner coverage');

  await page.route('https://runner.example.test/**', async (route) => {
    const url = new URL(route.request().url());
    const missing = url.pathname.includes('expected-404');
    await route.fulfill({
      status: missing ? 404 : 200,
      contentType: 'application/json',
      body: JSON.stringify({ path: url.pathname, expected: missing }),
    });
  });

  let apiClient = await openApiClient(page);
  const collections = page.locator('section[aria-labelledby="api-client-collections-heading"]');

  await apiClient.getByLabel('Request URL').fill('https://runner.example.test/ok');
  await collections.getByLabel('Saved request name').fill('First request');
  await collections.getByRole('button', { name: 'Save request' }).click();

  await collections.getByRole('button', { name: 'My Collection', exact: true }).click();
  await apiClient.getByLabel('Request URL').fill('https://runner.example.test/expected-404');
  await collections.getByLabel('Saved request name').fill('Expected 404');
  await collections.getByRole('button', { name: 'Save request' }).click();

  await collections.getByRole('button', { name: 'Run collection My Collection' }).click();
  const runner = page.locator('section[aria-labelledby="api-client-runner-heading"]');
  await expect(runner).toBeVisible();
  const queueRows = runner.locator('[data-runner-request-id]');
  await expect(queueRows).toHaveCount(2);
  await expect(queueRows.nth(0)).toContainText('First request');
  await expect(queueRows.nth(1)).toContainText('Expected 404');

  await runner.getByRole('button', { name: 'Start run' }).click();
  await expect(runner.getByText('Complete', { exact: true })).toBeVisible();
  await expect(runner.getByText('2', { exact: true }).nth(1)).toBeVisible();
  await expect(queueRows.nth(1)).toContainText('Runner pass');
  await expect(queueRows.nth(1)).toContainText('HTTP 404');

  await runner.getByRole('button', { name: 'Open run history' }).click();
  let history = page.locator('section[aria-labelledby="api-client-history-page-heading"]');
  await expect(history).toBeVisible();
  await expect(history.getByText('2 / 2 history entries captured · 2 runner passed · 0 runner failed')).toBeVisible();
  await expect(history.getByText(/Runner pass · HTTP 404/)).toBeVisible();

  await page.reload();
  apiClient = await openApiClient(page);
  await page.getByRole('button', { name: 'Open full history · 2' }).click();
  history = page.locator('section[aria-labelledby="api-client-history-page-heading"]');
  await expect(history.getByRole('button', { name: 'Open collection run My Collection' })).toBeVisible();
  await history.getByRole('button', { name: 'Open collection run My Collection' }).click();
  await expect(history.getByText('2 / 2 history entries captured · 2 runner passed · 0 runner failed')).toBeVisible();
});


test('collection runner can stop an in-flight request without persisting a partial history row', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'desktop runner stop coverage');

  await page.route('https://slow-runner.example.test/**', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 2500));
    try {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    } catch {
      // The browser-side AbortController may cancel the request before fulfillment.
    }
  });

  const apiClient = await openApiClient(page);
  const collections = page.locator('section[aria-labelledby="api-client-collections-heading"]');

  await apiClient.getByLabel('Request URL').fill('https://slow-runner.example.test/one');
  await collections.getByLabel('Saved request name').fill('Slow first');
  await collections.getByRole('button', { name: 'Save request' }).click();

  await collections.getByRole('button', { name: 'My Collection', exact: true }).click();
  await apiClient.getByLabel('Request URL').fill('https://slow-runner.example.test/two');
  await collections.getByLabel('Saved request name').fill('Never reached');
  await collections.getByRole('button', { name: 'Save request' }).click();

  await collections.getByRole('button', { name: 'Run collection My Collection' }).click();
  const runner = page.locator('section[aria-labelledby="api-client-runner-heading"]');
  await runner.getByRole('button', { name: 'Start run' }).click();
  await expect(runner.getByRole('button', { name: 'Stop run' })).toBeVisible();
  await expect(runner.locator('[data-runner-request-id]').nth(0)).toContainText('Running');

  await runner.getByRole('button', { name: 'Stop run' }).click();
  await expect(runner.getByText('Stopped', { exact: true })).toBeVisible();
  await expect(runner.locator('[data-runner-request-id]').nth(0)).toContainText('Cancelled');
  await expect(runner.locator('[data-runner-request-id]').nth(1)).toContainText('Not run');

  await runner.getByRole('button', { name: 'Client' }).click();
  await expect(page.getByText('Sent requests appear here for quick replay.')).toBeVisible();
});


test('folder runner includes descendants, excludes collection-root requests, and preserves saved order', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'desktop folder runner coverage');

  const requestedPaths = [];
  await page.route('https://folder-runner.example.test/**', async (route) => {
    const url = new URL(route.request().url());
    requestedPaths.push(url.pathname);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ path: url.pathname }),
    });
  });

  const apiClient = await openApiClient(page);
  const collections = page.locator('section[aria-labelledby="api-client-collections-heading"]');

  await collections.getByLabel('New folder name').fill('Parent');
  await collections.getByRole('button', { name: 'Add folder' }).click();
  await collections.getByLabel('New folder name').fill('Child');
  await collections.getByRole('button', { name: 'Add folder' }).click();

  await collections.getByRole('button', { name: 'My Collection', exact: true }).click();
  await apiClient.getByLabel('Request URL').fill('https://folder-runner.example.test/root');
  await collections.getByLabel('Saved request name').fill('Root request');
  await collections.getByRole('button', { name: 'Save request' }).click();

  await collections.getByRole('button', { name: 'My Collection', exact: true }).click();
  await collections.getByRole('button', { name: 'Select folder Parent', exact: true }).click();
  await apiClient.getByLabel('Request URL').fill('https://folder-runner.example.test/parent');
  await collections.getByLabel('Saved request name').fill('Parent request');
  await collections.getByRole('button', { name: 'Save request' }).click();

  await collections.getByRole('button', { name: 'My Collection', exact: true }).click();
  await collections.getByRole('button', { name: 'Select folder Parent / Child' }).click();
  await apiClient.getByLabel('Request URL').fill('https://folder-runner.example.test/child');
  await collections.getByLabel('Saved request name').fill('Child request');
  await collections.getByRole('button', { name: 'Save request' }).click();

  await collections.getByRole('button', { name: 'Run folder Parent', exact: true }).click();
  const runner = page.locator('section[aria-labelledby="api-client-runner-heading"]');
  await expect(runner).toBeVisible();
  const queueRows = runner.locator('[data-runner-request-id]');
  await expect(queueRows).toHaveCount(2);
  await expect(queueRows.nth(0)).toContainText('Parent request');
  await expect(queueRows.nth(1)).toContainText('Child request');
  await expect(runner.getByText('Root request')).toHaveCount(0);

  await runner.getByRole('button', { name: 'Start run' }).click();
  await expect(runner.getByText('Complete', { exact: true })).toBeVisible();
  expect(requestedPaths).toEqual(['/parent', '/child']);
});