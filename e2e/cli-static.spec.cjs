const { test, expect } = require('@playwright/test');

test('CLI static export renders, deep-links, and executes Try It', async ({ page }) => {
  const localRequests = [];
  page.on('request', (request) => {
    if (request.url().startsWith('http://127.0.0.1:4175/')) localRequests.push(request.url());
  });

  await page.route('https://api.example.test/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: '42', name: 'Milo' }),
    });
  });

  await page.goto('');
  await expect(page.getByText('CLI Fixture API', { exact: true }).first()).toBeVisible();
  const sidebar = page.getByRole('complementary');
  await expect(sidebar.getByText('/pets/{id}', { exact: true })).toBeVisible();

  await sidebar.locator('button').filter({ hasText: '/pets/{id}' }).click();
  await expect(page).toHaveURL(/#get-~2Fpets~2F~7Bid~7D$/);
  await expect(page.getByRole('heading', { name: 'Get a pet' })).toBeVisible();
  const tryItButton = page.getByRole('button', { name: 'Try It', exact: true });
  await expect(tryItButton).toHaveAttribute('aria-expanded', 'false');
  await tryItButton.click();
  await expect(tryItButton).toHaveAttribute('aria-expanded', 'true');

  const tryIt = page.locator('[data-try-it-session]');
  await tryIt.getByLabel('Request URL').fill('https://api.example.test/pets/42');
  await tryIt.getByRole('button', { name: 'Send request' }).click();
  await expect(page.getByText('200 OK', { exact: true })).toBeVisible();
  await expect(page.locator('pre').filter({ hasText: 'Milo' })).toBeVisible();

  expect(localRequests.some((url) => url.endsWith('/docs/openapi.json'))).toBeTruthy();
  expect(localRequests.some((url) => /models\.yaml|common\.yaml/.test(url))).toBeFalsy();
});

test('CLI static export supports direct endpoint hashes under a base path', async ({ page }) => {
  await page.goto('#get-~2Fpets~2F~7Bid~7D');
  await expect(page).toHaveURL(/\/docs\/#get-~2Fpets~2F~7Bid~7D$/);
  await expect(page.getByRole('heading', { name: 'Get a pet' })).toBeVisible();
});
