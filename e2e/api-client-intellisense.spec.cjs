const { test, expect } = require('@playwright/test');

async function openApiClient(page) {
  await page.goto('/e2e/index.html#get-~2Fpets~2F~7Bid~7D');
  await page.getByRole('button', { name: 'Open in API Client' }).click();
  const apiClient = page.locator('[data-api-client-page="api-client"]');
  await expect(apiClient).toBeVisible();
  return apiClient;
}

async function optionTexts(apiClient) {
  return apiClient.getByRole('listbox').getByRole('option').evaluateAll((options) => options.map((option) => option.getAttribute('aria-label') || option.textContent || ''));
}

async function editorText(editor) {
  return editor.evaluate((element) => Array.from(element.querySelectorAll('.cm-line')).map((line) => line.textContent || '').join('\n'));
}

async function editorCaret(editor) {
  return editor.evaluate((element) => {
    const selection = window.getSelection();
    if (!selection || !selection.anchorNode || !element.contains(selection.anchorNode)) return -1;
    const range = document.createRange();
    range.selectNodeContents(element);
    range.setEnd(selection.anchorNode, selection.anchorOffset);
    return range.toString().length;
  });
}

test('API Client scripting IntelliSense works through real browser keyboard interactions', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'desktop IntelliSense coverage');

  const apiClient = await openApiClient(page);

  await apiClient.getByLabel('New environment name').fill('Autocomplete env');
  await apiClient.getByRole('button', { name: 'Add environment' }).click();
  await apiClient.getByRole('button', { name: 'Add environment variable' }).click();
  await apiClient.getByLabel('Environment variable 1 key').fill('baseUrl');
  await apiClient.getByLabel('Environment variable 1 value').fill('https://autocomplete.example.test');

  await apiClient.getByRole('tab', { name: 'Scripts' }).click();
  const preRequest = apiClient.getByLabel('Pre-request script');
  await preRequest.fill('flex.');
  const firstPopup = apiClient.getByTestId('Pre-request script-completion-popup');
  await expect(firstPopup).toBeVisible();
  const editorBox = await preRequest.boundingBox();
  const popupBox = await firstPopup.boundingBox();
  expect(editorBox && popupBox && popupBox.y < editorBox.y + editorBox.height).toBeTruthy();

  let labels = await optionTexts(apiClient);
  expect(labels.some((label) => label.startsWith('request'))).toBe(true);
  expect(labels.some((label) => label.startsWith('environment'))).toBe(true);
  expect(labels.some((label) => label.startsWith('response'))).toBe(false);
  expect(labels.some((label) => label.startsWith('test'))).toBe(false);

  await preRequest.press('Home');
  await expect.poll(() => editorCaret(preRequest)).toBe(0);
  await expect(apiClient.getByRole('listbox')).toBeVisible();
  await preRequest.press('End');
  await expect.poll(() => editorCaret(preRequest)).toBe(5);
  await expect(apiClient.getByRole('listbox')).toBeVisible();

  await preRequest.press('ArrowDown');
  await preRequest.press('ArrowDown');
  await preRequest.press('ArrowUp');
  await preRequest.press('Enter');
  await expect.poll(() => editorText(preRequest)).toBe('flex.environment');

  await preRequest.fill("flex.environment.get('ba");
  await expect(apiClient.getByRole('listbox')).toBeVisible();
  labels = await optionTexts(apiClient);
  expect(labels.some((label) => label.startsWith('baseUrl'))).toBe(true);
  await preRequest.press('Tab');
  await expect.poll(() => editorText(preRequest)).toBe("flex.environment.get('baseUrl");

  await preRequest.fill('');
  await preRequest.press('Control+Space');
  await expect(apiClient.getByRole('listbox')).toBeVisible();
  labels = await optionTexts(apiClient);
  expect(labels.some((label) => label.startsWith('flex'))).toBe(true);
  expect(labels.some((label) => label.startsWith('console'))).toBe(true);
  await preRequest.press('ArrowDown');
  await preRequest.press('Enter');
  await expect.poll(() => editorText(preRequest)).toBe('console');

  await preRequest.fill('flex.');
  await expect(apiClient.getByRole('listbox')).toBeVisible();
  await preRequest.press('Escape');
  await expect(apiClient.getByRole('listbox')).toHaveCount(0);
  await preRequest.press('Enter');
  await expect.poll(() => editorText(preRequest)).toBe('flex.\n');
  await preRequest.press('Tab');
  await expect.poll(() => editorText(preRequest)).toBe('flex.\n  ');
  await expect(apiClient.locator('.api-client-code-editor[data-editor="codemirror"]').first()).toBeVisible();

  await apiClient.getByRole('tab', { name: 'Tests' }).click();
  const tests = apiClient.getByLabel('Tests script');
  await tests.fill('flex.');
  await expect(apiClient.getByRole('listbox')).toBeVisible();
  labels = await optionTexts(apiClient);
  expect(labels.some((label) => label.startsWith('response'))).toBe(true);
  expect(labels.some((label) => label.startsWith('test'))).toBe(true);

  await tests.fill('flex.res');
  await tests.press('Tab');
  await expect.poll(() => editorText(tests)).toBe('flex.response');
  await tests.press('.');
  await expect(apiClient.getByRole('listbox')).toBeVisible();
  labels = await optionTexts(apiClient);
  expect(labels.some((label) => label.startsWith('code'))).toBe(true);
  expect(labels.some((label) => label.startsWith('json'))).toBe(true);

  await tests.fill('flex.expect(flex.response.code).to.');
  const completionList = apiClient.getByRole('listbox');
  await expect(completionList).toBeVisible();
  labels = await optionTexts(apiClient);
  expect(labels.some((label) => label.startsWith('equal'))).toBe(true);
  expect(labels.some((label) => label.startsWith('have'))).toBe(true);
  await expect(completionList.getByRole('option', { selected: true })).toContainText('equal(expected: unknown): void');
});