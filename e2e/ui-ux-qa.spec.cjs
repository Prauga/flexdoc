const { test, expect } = require('@playwright/test');

async function expectNoPageOverflow(page, scope) {
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(dimensions.scrollWidth, `${scope}: page-level horizontal overflow`).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

async function expectAccessibleControls(page, scope) {
  const failures = await page.locator('button, input, select, textarea, [contenteditable="true"]').evaluateAll((controls) => controls.flatMap((control) => {
    const style = window.getComputedStyle(control);
    const visible = style.display !== 'none' && style.visibility !== 'hidden' && control.getClientRects().length > 0;
    if (!visible) return [];
    const id = control.getAttribute('id');
    const label = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`)?.textContent : undefined;
    const wrappedLabel = control.closest('label')?.textContent;
    const name = control.getAttribute('aria-label') || control.getAttribute('title') || label || wrappedLabel || (control.tagName === 'BUTTON' ? control.textContent : '');
    return name?.trim() ? [] : [`${control.tagName.toLowerCase()}${control.getAttribute('type') ? `[type=${control.getAttribute('type')}]` : ''}`];
  }));
  expect(failures, `${scope}: visible controls without accessible names`).toEqual([]);
}

async function audit(page, scope) {
  await expectNoPageOverflow(page, scope);
  await expectAccessibleControls(page, scope);
}

async function openApiClient(page, theme) {
  await page.goto(`/e2e/index.html?theme=${theme}#get-~2Fpets~2F~7Bid~7D`);
  await page.getByRole('button', { name: 'Open in API Client' }).click();
  const apiClient = page.locator('[data-api-client-page="api-client"]');
  await expect(apiClient).toBeVisible();
  return apiClient;
}

async function editorText(editor) {
  return editor.evaluate((element) => element.innerText.replace(/\u200b/g, ''));
}

for (const theme of ['light', 'dark']) {
  test(`UI QA keeps docs and API Client within the viewport in ${theme} mode`, async ({ page }, testInfo) => {
    const mobile = testInfo.project.name === 'chromium-mobile';
    await page.goto(`/e2e/index.html?theme=${theme}`);
    await audit(page, `${theme}/${testInfo.project.name}/overview`);

    if (!mobile) {
      const collapseDocs = page.getByRole('button', { name: 'Collapse API navigation sidebar' });
      await expect(collapseDocs).toBeVisible();
      await collapseDocs.click();
      await expect(page.locator('[data-docs-sidebar]')).toHaveAttribute('data-collapsed', 'true');
      await audit(page, `${theme}/${testInfo.project.name}/docs-collapsed`);
      await page.getByRole('button', { name: 'Expand API navigation sidebar' }).click();
    }

    const apiClient = await openApiClient(page, theme);
    await audit(page, `${theme}/${testInfo.project.name}/api-client`);

    const veryLong = `https://api.example.test/${'very-long-segment-'.repeat(28)}`;
    await apiClient.getByLabel('Request URL').fill(veryLong);
    await apiClient.getByRole('tab', { name: 'Headers' }).click();
    await apiClient.getByLabel('Headers 1 key').fill('X-Long-Header');
    await apiClient.getByLabel('Headers 1 value').fill('value-'.repeat(90));
    await audit(page, `${theme}/${testInfo.project.name}/long-fields`);

    const workspaceSidebar = page.locator('[data-api-client-workspace-sidebar]');
    await expect(workspaceSidebar).toBeVisible();
    await page.getByRole('button', { name: 'Collapse API Client sidebar' }).click();
    await expect(workspaceSidebar).toHaveAttribute('data-collapsed', 'true');
    await audit(page, `${theme}/${testInfo.project.name}/workspace-collapsed`);
    await page.getByRole('button', { name: 'Expand API Client sidebar' }).click();

    await apiClient.getByRole('tab', { name: 'Scripts' }).click();
    const script = apiClient.getByLabel('Pre-request script');
    await script.fill(`console.log('${'wrapped-content-'.repeat(80)}');`);
    const editorDimensions = await script.evaluate((element) => {
      const scroller = element.closest('.cm-editor')?.querySelector('.cm-scroller') || element;
      return { scrollWidth: scroller.scrollWidth, clientWidth: scroller.clientWidth };
    });
    expect(editorDimensions.scrollWidth, 'script editor should soft-wrap instead of horizontal scrolling').toBeLessThanOrEqual(editorDimensions.clientWidth + 1);

    await script.fill("if (true) {\nconsole.log('formatted');\n}");
    await apiClient.getByRole('button', { name: 'Format current script' }).click();
    await expect.poll(() => editorText(script)).toBe("if (true) {\n  console.log('formatted');\n}");

    await script.fill("const broken = ;");
    await expect(apiClient.getByRole('alert')).toContainText(/Unexpected token|Unexpected identifier|syntax/i);

    await script.fill("console.log('first');");
    await script.press('End');
    await script.press('Enter');
    await script.type('flex.');
    await expect(apiClient.getByTestId('Pre-request script-completion-popup')).toBeVisible();
    await audit(page, `${theme}/${testInfo.project.name}/script-intellisense`);

    if (!mobile) {
      await page.setViewportSize({ width: 820, height: 1180 });
      await audit(page, `${theme}/tablet/api-client`);
    }
  });
}


test('viewer theme persists while the embedded API Client follows it', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'desktop persistence coverage');
  await openApiClient(page, 'light');
  await page.getByRole('button', { name: 'Open settings' }).click();
  const settings = page.getByRole('dialog', { name: 'Viewer settings' });
  await settings.getByLabel('Viewer theme').selectOption('dark');
  await expect(page.locator('.flexdoc-root')).toHaveAttribute('data-theme', 'dark');
  await settings.getByRole('button', { name: 'Close settings' }).click();

  const apiClient = await openApiClient(page, 'light');
  await expect(page.locator('.flexdoc-root')).toHaveAttribute('data-theme', 'dark');
  await expect(apiClient.locator('[data-api-client-editor]')).toBeVisible();
});

test('high contrast persists and covers the embedded API Client', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'desktop high-contrast coverage');
  await page.goto('/e2e/index.html?theme=light#get-~2Fpets~2F~7Bid~7D');
  await page.getByRole('button', { name: 'Open settings' }).click();
  const settings = page.getByRole('dialog', { name: 'Viewer settings' });
  await settings.getByLabel('Viewer theme').selectOption('high-contrast');
  await expect(page.locator('.flexdoc-root')).toHaveAttribute('data-theme', 'high-contrast');
  await settings.getByRole('button', { name: 'Close settings' }).click();
  await page.getByRole('button', { name: 'Open in API Client' }).click();
  const apiClient = page.locator('[data-api-client-page="api-client"]');
  await expect(apiClient).toBeVisible();
  await expect(page.locator('.flexdoc-root')).toHaveAttribute('data-theme', 'high-contrast');
  await expect(apiClient.locator('[data-api-client-editor]')).toBeVisible();
  await page.reload();
  await expect(page.locator('.flexdoc-root')).toHaveAttribute('data-theme', 'high-contrast');
});

test('reduced motion removes renderer width transitions', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'desktop reduced-motion coverage');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/e2e/index.html');
  const sidebar = page.locator('[data-docs-sidebar]');
  await expect(sidebar).toBeVisible();
  await expect.poll(() => sidebar.evaluate((element) => getComputedStyle(element).transitionDuration)).toBe('0s');
});

test('operation print action uses the reader layout', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'desktop print coverage');
  await page.goto('/e2e/index.html#get-~2Fpets~2F~7Bid~7D');
  await page.evaluate(() => {
    window.__flexdocPrintCalls = 0;
    window.print = () => { window.__flexdocPrintCalls += 1; };
  });
  await page.getByRole('button', { name: 'Print operation' }).click();
  await expect.poll(() => page.evaluate(() => window.__flexdocPrintCalls)).toBe(1);

  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.flexdoc-root > header')).toBeHidden();
  await expect(page.locator('[data-docs-sidebar]')).toBeHidden();
  const article = page.locator('article');
  await expect(article).toBeVisible();
  await expect.poll(() => article.evaluate((element) => getComputedStyle(element).overflow)).toBe('visible');
});


test('hidden topbar API Client keeps environment and unsaved state visible', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-mobile', 'mobile hidden-topbar chrome coverage');
  await page.goto('/e2e/index.html?hideTopbar=1#get-~2Fpets~2F~7Bid~7D');
  await page.getByRole('button', { name: 'Open in API Client' }).click();

  const status = page.locator('[data-flexdoc-floating-control="api-client-status"]');
  await expect(page.locator('[data-flexdoc-floating-control="api-client-back"]')).toBeVisible();
  await expect(status).toBeVisible();
  await expect(status.getByLabel('API Client environment')).toBeVisible();

  const apiClient = page.locator('[data-api-client-page="api-client"]');
  await apiClient.getByLabel('Request URL').fill('https://api.example.test/changed');
  await expect(status.getByText('Unsaved changes', { exact: true })).toBeVisible();
  await expectNoPageOverflow(page, 'hidden-topbar/mobile/api-client');
});
