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
  await expect(page).toHaveURL(/#get-pets-id$/);
  await expect(page.getByRole('heading', { name: 'Get a pet' })).toBeVisible();
  await page.getByLabel('path id').fill('42');
  await page.getByRole('button', { name: 'Send request' }).click();
  await expect(page.getByText(/Response\s+200\s+OK/)).toBeVisible();
  await expect(page.locator('pre').filter({ hasText: 'Milo' })).toBeVisible();

  expect(localRequests.some((url) => url.endsWith('/docs/openapi.json'))).toBeTruthy();
  expect(localRequests.some((url) => /models\.yaml|common\.yaml/.test(url))).toBeFalsy();
});

test('CLI static export supports direct endpoint hashes under a base path', async ({ page }) => {
  await page.goto('#get-pets-id');
  await expect(page).toHaveURL(/\/docs\/#get-pets-id$/);
  await expect(page.getByRole('heading', { name: 'Get a pet' })).toBeVisible();
});
