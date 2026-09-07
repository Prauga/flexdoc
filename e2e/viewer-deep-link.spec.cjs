const { test, expect } = require('@playwright/test');

test('Try It and API Client tabs are deep-linkable', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'desktop deep-link coverage');

  await page.goto('/e2e/index.html?tryIt=1&tab=headers&script=tests#get-~2Fpets~2F~7Bid~7D');
  await expect(page.getByRole('button', { name: 'Try It' })).toHaveAttribute('aria-expanded', 'true');

  await page.getByRole('button', { name: 'Open in API Client' }).click();
  const apiClient = page.locator('[data-api-client-page="api-client"]');
  await expect(apiClient.getByRole('tab', { name: 'Headers' })).toHaveAttribute('aria-selected', 'true');

  await apiClient.getByRole('tab', { name: 'Scripts' }).click();
  await expect(apiClient.getByRole('tab', { name: 'Scripts' })).toHaveAttribute('aria-selected', 'true');
  await apiClient.getByRole('tab', { name: 'Tests' }).click();
  await expect(apiClient.getByRole('tab', { name: 'Tests' })).toHaveAttribute('aria-selected', 'true');

  await page.reload();
  const reopenedClient = page.locator('[data-api-client-page="api-client"]');
  await expect(reopenedClient).toBeVisible();
  await expect(reopenedClient.getByRole('tab', { name: 'Scripts' })).toHaveAttribute('aria-selected', 'true');
  await expect(reopenedClient.getByRole('tab', { name: 'Tests' })).toHaveAttribute('aria-selected', 'true');
});
