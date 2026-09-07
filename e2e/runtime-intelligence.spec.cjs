const { test, expect } = require('@playwright/test');

const runtimeSnapshot = {
  framework: 'express',
  frameworkVersion: '5.1.0',
  runtime: { name: 'node', version: 'v22.22.3', platform: 'linux', arch: 'x64' },
  serverOrigin: 'https://docs.example.test',
  server: { localPort: 8443 },
  environment: { name: 'production' },
  discoveryComplete: false,
  routes: [{ method: 'GET', path: '/pets/{id}' }, { method: 'POST', path: '/internal/reindex' }],
  runtimeOnly: [{ method: 'POST', path: '/internal/reindex' }],
  documentedOnly: [],
  summary: { documented: 1, runtime: 2, matched: 1, runtimeOnly: 1, documentedOnly: 0 },
};

test('runtime panel remains accessible with a hidden topbar and behaves as a modal dialog', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'desktop runtime panel coverage');

  await page.route('**/e2e/__flexdoc/runtime', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(runtimeSnapshot) });
  });
  await page.goto('/e2e/index.html?runtime=1&hideTopbar=1&theme=dark');

  const trigger = page.getByRole('button', { name: 'Open runtime intelligence' });
  await expect(trigger).toBeVisible();
  await trigger.click();

  const dialog = page.getByRole('dialog', { name: 'Runtime intelligence' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('1 / 1')).toBeVisible();
  await expect(dialog.getByText('/internal/reindex')).toBeVisible();
  await expect(dialog.getByText(/Route discovery is partial/)).toHaveClass(/bg-amber-950\/50/);
  await expect(dialog.getByLabel('Close runtime intelligence panel')).toBeFocused();
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe('hidden');

  await page.keyboard.press('Tab');
  await expect(dialog.getByLabel('Close runtime intelligence panel')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe('');
});

test('malformed runtime snapshots become a contained dark-mode panel error', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'desktop runtime validation coverage');

  await page.route('**/e2e/__flexdoc/runtime', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ framework: 'express' }) });
  });
  await page.goto('/e2e/index.html?runtime=1&theme=dark');
  await page.getByRole('button', { name: 'Open runtime intelligence' }).click();

  const dialog = page.getByRole('dialog', { name: 'Runtime intelligence' });
  const alert = dialog.getByRole('alert');
  await expect(alert).toContainText('Runtime intelligence returned an invalid snapshot.');
  await expect(alert).toHaveClass(/bg-red-950\/50/);
  await expect(page.getByText('FlexDoc Browser Fixture', { exact: true }).first()).toBeVisible();
});
