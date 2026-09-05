const { createHash } = require('node:crypto');
const { test, expect } = require('@playwright/test');

const overviewDigests = {
  'chromium-desktop': 'e5a005c79be6a8bffb5846ae5decf8300d230b8ea487009d47b276e2575a91aa',
  'chromium-mobile': '17b9b02d35c147b3252e3bf386a2994f09a2559ddb28d07c51309e4bdc27ebd7',
};

const API_CLIENT_SPEC_TITLE = 'FlexDoc Browser Fixture';

async function readApiClientWorkspace(page, key) {
  return page.evaluate(async ({ workspaceKey, specTitle }) => new Promise((resolve, reject) => {
    const resolvedKey = workspaceKey ?? `flexdoc:${encodeURIComponent(window.location.host)}:${encodeURIComponent(specTitle)}`;
    const openRequest = indexedDB.open('flexdoc-api-client');
    openRequest.onerror = () => reject(openRequest.error);
    openRequest.onsuccess = () => {
      const database = openRequest.result;
      const transaction = database.transaction('workspaces', 'readonly');
      const request = transaction.objectStore('workspaces').get(resolvedKey);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        resolve(request.result || null);
        database.close();
      };
    };
  }), { workspaceKey: key ?? null, specTitle: API_CLIENT_SPEC_TITLE });
}

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
  // The canonical request model serializes OpenAPI cookie parameters, but browser fetch
  // forbids application code from setting the Cookie header. Browser execution therefore
  // relies on the cookie jar/credentials policy rather than a synthetic Cookie header.
  expect(requests[0].headers.cookie).toBeUndefined();

  await page.getByRole('tab', { name: 'JavaScript' }).click();
  await expect(page.locator('pre').filter({ hasText: 'fetch(' })).toBeVisible();
  await expect(page.locator('pre').filter({ hasText: 'Bearer token-42' })).toBeVisible();
});

test('Try It hands live values and custom servers to the API Client', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'desktop API Client coverage');

  await page.goto('/e2e/index.html#get-pets-id');
  await expect(page.getByRole('heading', { name: 'Get a pet' })).toBeVisible();

  await page.getByLabel('path id').fill('42');
  await page.getByLabel('query locale').fill('de');
  await page.getByLabel('header X-Trace').fill('trace-42');
  await page.getByLabel('bearer credential').fill('handoff-token');
  await page.getByLabel('Custom server URL').fill('http://localhost:8080');
  await page.getByRole('button', { name: 'Open in API Client' }).click();

  await expect(page.getByRole('heading', { name: 'API Client' })).toBeVisible();
  await expect(page.getByLabel('Request URL')).toHaveValue('http://localhost:8080/pets/42');
  await expect(page.getByLabel('API Client custom server URL')).toHaveValue('http://localhost:8080');
  await expect(page.getByLabel('Query parameters 1 key')).toHaveValue('locale');
  await expect(page.getByLabel('Query parameters 1 value')).toHaveValue('de');
  await expect(page.getByLabel('Headers 1 key')).toHaveValue('X-Trace');
  await expect(page.getByLabel('Headers 1 value')).toHaveValue('trace-42');
  await expect(page.getByLabel(/^Headers \d+ key$/)).toHaveCount(1);
  await expect(page.getByLabel('Authorization type', { exact: true })).toHaveValue('bearer');
  await expect(page.getByLabel('Bearer token')).toHaveValue('handoff-token');

  await page.getByLabel('API Client server').selectOption('https://backup.example.test');
  await expect(page.getByLabel('Request URL')).toHaveValue('https://backup.example.test/pets/42');
  await expect(page.getByLabel('Query parameters 1 value')).toHaveValue('de');

  await page.getByLabel('New folder name').fill('Pets');
  await page.getByRole('button', { name: 'Add folder' }).click();
  await expect(page.getByRole('button', { name: 'Delete folder Pets' })).toBeVisible();
  await expect(page.getByLabel('Saved request folder')).toHaveValue(/folder-/);

  await page.getByLabel('Saved request name').fill('Get pet 42');
  await page.getByRole('button', { name: 'Save request' }).click();
  await expect(page.getByRole('button', { name: 'Load saved request Get pet 42' })).toBeVisible();

  await page.getByLabel('Request URL').fill('https://backup.example.test/owners');
  await expect(page.getByLabel('Request URL')).toHaveValue('https://backup.example.test/owners');
  await page.getByRole('button', { name: 'Load saved request Get pet 42' }).click();
  await expect(page.getByLabel('Request URL')).toHaveValue('https://backup.example.test/pets/42');

  await expect.poll(async () => {
    const workspace = await readApiClientWorkspace(page);
    return workspace?.requests?.some((request) => request.name === 'Get pet 42');
  }).toBe(true);

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Get a pet' })).toBeVisible();
  await page.getByLabel('path id').fill('42');
  await page.getByRole('button', { name: 'Open in API Client' }).click();
  await expect(page.getByRole('button', { name: 'Load saved request Get pet 42' })).toBeVisible();
});

test('API Client environments resolve templates while saved requests keep raw drafts', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'desktop environment coverage');

  const requests = [];
  await page.route('https://env.example.test/**', async (route) => {
    requests.push({ url: route.request().url(), headers: route.request().headers() });
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });

  await page.goto('/e2e/index.html#get-pets-id');
  await page.getByLabel('path id').fill('42');
  await page.getByRole('button', { name: 'Open in API Client' }).click();
  const apiClient = page.locator('section[aria-labelledby="api-client-heading"]');
  await expect(apiClient).toBeVisible();

  await apiClient.getByLabel('New environment name').fill('Local');
  await apiClient.getByRole('button', { name: 'Add environment' }).click();
  await expect(apiClient.getByLabel('Active environment')).toHaveText(/Local/);

  await apiClient.getByRole('button', { name: 'Add environment variable' }).click();
  await apiClient.getByLabel('Environment variable 1 key').fill('baseUrl');
  await apiClient.getByLabel('Environment variable 1 value').fill('https://env.example.test');
  await apiClient.getByRole('button', { name: 'Add environment variable' }).click();
  await apiClient.getByLabel('Environment variable 2 key').fill('petId');
  await apiClient.getByLabel('Environment variable 2 value').fill('99');

  await apiClient.getByLabel('Request URL').fill('{{baseUrl}}/pets/{{petId}}');
  await apiClient.getByLabel('Headers 1 value').fill('{{petId}}');
  await apiClient.getByRole('button', { name: 'Send request' }).click();
  await expect(apiClient.getByText(/Response\s+200\s+OK/)).toBeVisible();

  expect(requests).toHaveLength(1);
  expect(requests[0].url).toBe('https://env.example.test/pets/99?locale=fr');
  expect(requests[0].headers['x-trace']).toBe('99');

  await apiClient.getByLabel('Saved request name').fill('Templated pet');
  await apiClient.getByRole('button', { name: 'Save request' }).click();
  await expect(apiClient.getByRole('button', { name: 'Load saved request Templated pet' })).toBeVisible();

  await expect.poll(async () => {
    const workspace = await readApiClientWorkspace(page);
    const saved = workspace?.requests?.find((request) => request.name === 'Templated pet');
    return {
      version: workspace?.version,
      activeEnvironment: workspace?.environments?.find((environment) => environment.id === workspace?.activeEnvironmentId)?.name,
      url: saved?.request?.url,
      header: saved?.request?.headers?.[0]?.value,
    };
  }).toEqual({ version: 6, activeEnvironment: 'Local', url: '{{baseUrl}}/pets/{{petId}}', header: '{{petId}}' });

  await page.reload();
  await page.getByLabel('path id').fill('42');
  await page.getByRole('button', { name: 'Open in API Client' }).click();
  const reopenedClient = page.locator('section[aria-labelledby="api-client-heading"]');
  await expect(reopenedClient.getByLabel('Active environment')).toHaveText(/Local/);
  await reopenedClient.getByRole('button', { name: 'Load saved request Templated pet' }).click();
  await expect(reopenedClient.getByLabel('Request URL')).toHaveValue('{{baseUrl}}/pets/{{petId}}');
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

test('canonical overview visual remains stable', async ({ page }, testInfo) => {
  await page.goto('/e2e/index.html');
  await expect(page.getByText('FlexDoc Browser Fixture', { exact: true }).first()).toBeVisible();
  const screenshot = await page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide' });
  await testInfo.attach('overview.png', { body: screenshot, contentType: 'image/png' });
  const digest = createHash('sha256').update(screenshot).digest('hex');
  expect(digest).toBe(overviewDigests[testInfo.project.name]);
});