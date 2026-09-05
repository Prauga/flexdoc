const { test, expect } = require('@playwright/test');

test('viewer expansion settings override host defaults, persist, seed Custom from the viewer preset, and reset', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'desktop settings coverage');

  await page.goto('/e2e/index.html#get-pets-id');
  const parameters = page.getByRole('button', { name: 'Parameters', exact: true });
  const responses = page.getByRole('button', { name: 'Responses', exact: true });
  const tryIt = page.getByRole('button', { name: 'Try It', exact: true });
  const codeSamples = page.getByRole('button', { name: 'Code Examples', exact: true });
  await expect(parameters).toHaveAttribute('aria-expanded', 'true');
  await expect(responses).toHaveAttribute('aria-expanded', 'true');
  await expect(tryIt).toHaveAttribute('aria-expanded', 'true');
  await expect(codeSamples).toHaveAttribute('aria-expanded', 'true');

  const openSettings = page.getByRole('button', { name: 'Open settings' });
  await openSettings.click();
  let settings = page.getByRole('dialog', { name: 'Viewer settings' });
  let expansionMode = settings.getByRole('combobox', { name: 'Default expanded sections' });
  await expect(expansionMode).toBeFocused();
  await expansionMode.selectOption('minimal');
  await expect(parameters).toHaveAttribute('aria-expanded', 'false');
  await expect(responses).toHaveAttribute('aria-expanded', 'false');
  await expect(tryIt).toHaveAttribute('aria-expanded', 'false');
  await settings.getByRole('button', { name: 'Close settings', exact: true }).click();
  await expect(openSettings).toBeFocused();

  await page.reload();
  await expect(parameters).toHaveAttribute('aria-expanded', 'false');
  await page.getByRole('button', { name: 'Open settings' }).click();
  settings = page.getByRole('dialog', { name: 'Viewer settings' });
  expansionMode = settings.getByRole('combobox', { name: 'Default expanded sections' });
  await expansionMode.selectOption('documentation');
  await expect(parameters).toHaveAttribute('aria-expanded', 'true');
  await expect(responses).toHaveAttribute('aria-expanded', 'true');
  await expect(tryIt).toHaveAttribute('aria-expanded', 'false');
  await expect(codeSamples).toHaveAttribute('aria-expanded', 'false');

  await expansionMode.selectOption('custom');
  await expect(settings.getByLabel('Parameters')).toBeChecked();
  await expect(settings.getByLabel('Responses')).toBeChecked();
  await expect(settings.getByLabel('Try It')).not.toBeChecked();
  await expect(settings.getByLabel('Code examples')).not.toBeChecked();

  const closeSettings = settings.getByRole('button', { name: 'Close settings', exact: true });
  await closeSettings.focus();
  await page.keyboard.press('Shift+Tab');
  await expect(settings.getByRole('button', { name: 'Reset to documentation defaults' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(settings).toBeHidden();
  await expect(page.getByRole('button', { name: 'Open settings' })).toBeFocused();

  await page.getByRole('button', { name: 'Open settings' }).click();
  await page.getByRole('dialog', { name: 'Viewer settings' }).getByRole('button', { name: 'Reset to documentation defaults' }).click();
  await expect(parameters).toHaveAttribute('aria-expanded', 'true');
  await expect(responses).toHaveAttribute('aria-expanded', 'true');
  await expect(tryIt).toHaveAttribute('aria-expanded', 'true');
  await expect(codeSamples).toHaveAttribute('aria-expanded', 'true');
});

test('viewer settings remain reachable when the host hides the top bar', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'desktop embedded settings coverage');

  await page.goto('/e2e/index.html?hideTopbar=1#get-pets-id');
  await expect(page.locator('.flexdoc-root > header')).toHaveCount(0);
  const openSettings = page.getByRole('button', { name: 'Open settings' });
  await expect(openSettings).toBeVisible();
  await openSettings.click();
  const settings = page.getByRole('dialog', { name: 'Viewer settings' });
  await expect(settings).toBeVisible();
  await expect(settings.getByRole('combobox', { name: 'Default expanded sections' })).toBeFocused();
});
