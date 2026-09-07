const { test, expect } = require('@playwright/test');

async function openApiClient(page) {
  await page.goto('/e2e/index.html#get-~2Fpets~2F~7Bid~7D');
  await page.getByRole('button', { name: 'Open in API Client' }).click();
  const apiClient = page.locator('[data-api-client-page="api-client"]');
  await expect(apiClient).toBeVisible();
  return apiClient;
}

async function editorText(editor) {
  return editor.evaluate((element) => element.innerText.replace(/\u200b/g, ''));
}

test('API Client provides structured request body modes and pretty/raw response views', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'desktop API Client parity coverage');
  const apiClient = await openApiClient(page);
  await apiClient.getByLabel('HTTP method').selectOption('POST');
  await apiClient.getByRole('tab', { name: 'Body' }).click();

  await apiClient.getByLabel('Request body type').selectOption('json');
  const requestBody = apiClient.getByRole('textbox', { name: 'Request body', exact: true });
  await requestBody.fill('{"name":"Mochi","age":4}');
  await expect(apiClient.getByText('Valid JSON')).toBeVisible();
  await apiClient.getByRole('button', { name: 'Beautify JSON' }).click();
  await expect.poll(() => editorText(requestBody)).toBe('{\n  "name": "Mochi",\n  "age": 4\n}');
  await expect(apiClient.getByLabel('Content type')).toHaveValue('application/json');

  await apiClient.getByLabel('Request body type').selectOption('urlencoded');
  await apiClient.getByLabel('Form field 1 key').fill('name');
  await apiClient.getByLabel('Form field 1 value').fill('red fox');

  await apiClient.getByLabel('Request body type').selectOption('formdata');
  await apiClient.getByLabel('Form data 1 key').fill('name');
  await apiClient.getByLabel('Form data 1 value').fill('Mochi');
  await expect(apiClient.getByText(/multipart boundary automatically/i)).toBeVisible();

  await apiClient.getByLabel('Request body type').selectOption('graphql');
  await apiClient.getByLabel('GraphQL query').fill('query { pet { id } }');
  await apiClient.getByLabel('GraphQL variables').fill('{"limit": 2}');
  await expect(apiClient.getByText(/Variables are serialized/i)).toBeVisible();

  await apiClient.getByLabel('Request body type').selectOption('binary');
  await apiClient.getByLabel('Binary file').setInputFiles({ name: 'payload.bin', mimeType: 'application/octet-stream', buffer: Buffer.from([0, 1, 2, 255]) });
  await expect(apiClient.getByText('payload.bin')).toBeVisible();
  await expect(apiClient.getByLabel('Content type')).toHaveValue('application/octet-stream');
});

test('response body can switch between pretty JSON and exact raw payload', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'desktop response viewer coverage');
  const apiClient = await openApiClient(page);
  await page.route('https://response.example.test/**', async (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: '{"pet":{"name":"Mochi","age":4}}',
  }));
  await apiClient.getByLabel('Request URL').fill('https://response.example.test/pets/42');
  await apiClient.getByRole('button', { name: 'Send request' }).click();
  await expect(apiClient.getByText('Body — Pretty')).toBeVisible();
  await expect(apiClient.getByRole('button', { name: 'Copy request as cURL' })).toBeVisible();
  await expect(apiClient.locator('code.language-json')).toContainText('"pet"');
  await apiClient.getByRole('button', { name: 'Raw', exact: true }).click();
  await expect(apiClient.getByText('Body — Raw')).toBeVisible();
  await expect(apiClient.getByTestId('api-client-response-raw-body').locator('code.language-text')).toContainText('{"pet":{"name":"Mochi","age":4}}');
});


test('binary body sends the selected file bytes without text conversion', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'desktop binary request coverage');
  const apiClient = await openApiClient(page);
  let captured;
  await page.route('https://binary.example.test/**', async (route) => {
    captured = {
      body: route.request().postDataBuffer(),
      contentType: route.request().headers()['content-type'],
    };
    await route.fulfill({ status: 204, body: '' });
  });
  await apiClient.getByLabel('HTTP method').selectOption('POST');
  await apiClient.getByRole('tab', { name: 'Body' }).click();
  await apiClient.getByLabel('Request URL').fill('https://binary.example.test/upload');
  await apiClient.getByLabel('Request body type').selectOption('binary');
  await apiClient.getByLabel('Binary file').setInputFiles({ name: 'payload.bin', mimeType: 'application/octet-stream', buffer: Buffer.from([0, 1, 2, 255]) });
  await apiClient.getByRole('button', { name: 'Send request' }).click();
  await expect.poll(() => captured?.body?.length).toBe(4);
  expect([...captured.body]).toEqual([0, 1, 2, 255]);
  expect(captured.contentType).toBe('application/octet-stream');
});


test('saved structured bodies reopen with their mode and file metadata intact', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'desktop structured-body persistence coverage');
  const apiClient = await openApiClient(page);
  await apiClient.getByLabel('HTTP method').selectOption('POST');
  await apiClient.getByRole('tab', { name: 'Body' }).click();
  await apiClient.getByLabel('Request body type').selectOption('binary');
  await apiClient.getByLabel('Binary file').setInputFiles({ name: 'saved-payload.bin', mimeType: 'application/octet-stream', buffer: Buffer.from([10, 20, 30]) });
  await apiClient.getByLabel('Saved request name').fill('Saved binary upload');
  await apiClient.getByRole('button', { name: 'Save request' }).click();
  const saved = apiClient.getByRole('button', { name: 'Load saved request Saved binary upload' });
  await expect(saved).toBeVisible();
  await saved.click();
  await expect(apiClient.getByLabel('Request body type')).toHaveValue('binary');
  await expect(apiClient.getByText('saved-payload.bin')).toBeVisible();
  await expect(apiClient.getByText(/re-select the file before a later send/i)).toBeVisible();
});