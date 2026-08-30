const { test, expect } = require('@playwright/test');

test('deep links directly to an operation', async ({ page }) => {
  await page.goto('/e2e/index.html#get-pets-id');
  await expect(page.getByRole('heading', { name: 'Get a pet' })).toBeVisible();
  await expect(page.getByText('/pets/{id}', { exact: true }).last()).toBeVisible();
  await expect(page).toHaveURL(/#get-pets-id$/);
});

test('desktop search, Try It, response viewer, and code samples work together', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'desktop navigation coverage');

  const requests = [];
  await page.route('https://api.example.test/**', async (route) => {
    requests.push({ url: route.request().url(), headers: route.request().headers() });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: '42', name: 'Milo' }),
      headers: { 'x-flexdoc-test': 'browser-e2e' },
    });
  });

  await page.goto('/e2e/index.html');
  const search = page.getByPlaceholder('Search endpoints...');
  const sidebar = page.locator('aside').filter({ has: search }).first();
  await search.fill('payload');
  await expect(sidebar.getByText('/payload', { exact: true })).toBeVisible();
  await expect(sidebar.getByText('/pets/{id}', { exact: true })).toHaveCount(0);
  await search.clear();

  await sidebar.locator('button').filter({ hasText: '/pets/{id}' }).click();
  await expect(page).toHaveURL(/#get-pets-id$/);
  await expect(page.getByRole('heading', { name: 'Get a pet' })).toBeVisible();

  await page.getByLabel('path id').fill('42');
  await page.getByLabel('query locale').fill('de');
  await page.getByLabel('query tags').fill('["one","two"]');
  await page.getByLabel('query filter').fill('{"role":"admin"}');
  await page.getByLabel('header X-Trace').fill('trace-42');
  await page.getByLabel('cookie session').fill('session-42');
  await page.getByLabel('bearer credential').fill('token-42');

  await page.getByRole('button', { name: 'Send request' }).click();
  await expect(page.getByText(/Response\s+200\s+OK/)).toBeVisible();
  await expect(page.locator('pre').filter({ hasText: 'Milo' })).toBeVisible();

  expect(requests).toHaveLength(1);
  expect(requests[0].url).toBe('https://api.example.test/pets/42?locale=de&tags=one&tags=two&filter%5Brole%5D=admin');
  expect(requests[0].headers.authorization).toBe('Bearer token-42');
  expect(requests[0].headers['x-trace']).toBe('trace-42');
  expect(requests[0].headers.cookie).toContain('session=session-42');

  await page.getByRole('tab', { name: 'JavaScript' }).click();
  await expect(page.locator('pre').filter({ hasText: 'fetch(' })).toBeVisible();
  await expect(page.locator('pre').filter({ hasText: 'Bearer token-42' })).toBeVisible();
});

test('mobile navigation is accessible and closes after endpoint selection', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-mobile', 'mobile navigation coverage');

  await page.goto('/e2e/index.html');
  await page.getByRole('button', { name: 'Open API navigation' }).click();
  const dialog = page.getByRole('dialog', { name: 'API navigation' });
  await expect(dialog).toBeVisible();
  await dialog.getByPlaceholder('Search endpoints...').fill('pet');
  await dialog.locator('button').filter({ hasText: '/pets/{id}' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Get a pet' })).toBeVisible();
  await expect(page).toHaveURL(/#get-pets-id$/);
});

test('canonical overview visual remains stable', async ({ page }) => {
  await page.goto('/e2e/index.html');
  await expect(page.getByText('FlexDoc Browser Fixture', { exact: true }).first()).toBeVisible();
  await expect(page).toHaveScreenshot('overview.png', {
    fullPage: true,
    animations: 'disabled',
    caret: 'hide',
  });
});
