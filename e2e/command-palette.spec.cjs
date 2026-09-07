const { test, expect } = require('@playwright/test');

test('keyboard command palette navigates operations and opens viewer settings', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'desktop command coverage');

  await page.goto('/e2e/index.html');
  await page.keyboard.press('Control+K');
  const palette = page.getByRole('dialog', { name: 'Command palette' });
  await expect(palette).toBeVisible();
  const search = palette.getByLabel('Search commands');
  await expect(search).toBeFocused();

  await search.fill('/pets/{id}');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#get-~2Fpets~2F~7Bid~7D$/);
  await expect(page.getByRole('heading', { name: 'Get a pet' })).toBeVisible();

  await page.keyboard.press('Control+K');
  await palette.getByLabel('Search commands').fill('viewer settings');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Viewer settings' })).toBeVisible();
});


test('command palette sends the visible Try It request', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'desktop command coverage');
  await page.route('https://api.example.test/**', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) }));
  await page.goto('/e2e/index.html#' + 'get-~2Fpets~2F~7Bid~7D');
  const tryIt = page.getByRole('button', { name: 'Try It', exact: true });
  if ((await tryIt.getAttribute('aria-expanded')) !== 'true') await tryIt.click();
  const session = page.locator('[data-try-it-session]');
  await expect(session).toBeVisible();
  await session.getByLabel('Request URL').fill('https://api.example.test/pets/42');
  await page.keyboard.press('Control+K');
  const palette = page.getByRole('dialog', { name: 'Command palette' });
  await palette.getByLabel('Search commands').fill('send current');
  await page.keyboard.press('Enter');
  await expect(page.getByText('200 OK', { exact: true })).toBeVisible();
});
