const { createHash } = require('node:crypto');
const { test, expect } = require('@playwright/test');

const overviewDigests = {
  'chromium-desktop': '6b2fe53997d03d94fb707a3256b433135b4fa730b2ff7a0abc76cfcaf2ac1c42',
  'chromium-mobile': 'bfe7d59ef6debe2fe2812d325421f120bdd29bf22e0ee867cfaf08c2cfa91bbd',
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
  await page.goto('/e2e/index.html#get-~2Fpets~2F~7Bid~7D');
  await expect(page.getByRole('heading', { name: 'Get a pet' })).toBeVisible();
  await expect(page.getByText('/pets/{id}', { exact: true }).last()).toBeVisible();
  await expect(page).toHaveURL(/#get-~2Fpets~2F~7Bid~7D$/);
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
  await expect(page).toHaveURL(/#get-~2Fpets~2F~7Bid~7D$/);
  await expect(page.getByRole('heading', { name: 'Get a pet' })).toBeVisible();

  const tryIt = page.locator('[data-try-it-session]');
  await tryIt.getByLabel('Request URL').fill('https://api.example.test/pets/42');
  await tryIt.getByLabel('Query parameters 1 value').fill('de');
  await tryIt.getByRole('button', { name: 'Add' }).click();
  await tryIt.getByLabel('Query parameters 2 key').fill('tags');
  await tryIt.getByLabel('Query parameters 2 value').fill('one');
  await tryIt.getByRole('button', { name: 'Add' }).click();
  await tryIt.getByLabel('Query parameters 3 key').fill('tags');
  await tryIt.getByLabel('Query parameters 3 value').fill('two');
  await tryIt.getByRole('button', { name: 'Add' }).click();
  await tryIt.getByLabel('Query parameters 4 key').fill('filter[role]');
  await tryIt.getByLabel('Query parameters 4 value').fill('admin');
  await tryIt.getByRole('tab', { name: 'Headers' }).click();
  await tryIt.getByLabel('Headers 1 value').fill('trace-42');
  await tryIt.getByRole('tab', { name: 'Authorization' }).click();
  await tryIt.getByLabel('Authorization type', { exact: true }).selectOption('bearer');
  await tryIt.getByLabel('Bearer token').fill('token-42');

  await tryIt.getByRole('button', { name: 'Send request' }).click();
  await expect(page.getByText('200 OK', { exact: true })).toBeVisible();
  await expect(page.locator('pre').filter({ hasText: 'Milo' })).toBeVisible();

  expect(requests).toHaveLength(1);
  expect(requests[0].url).toBe('https://api.example.test/pets/42?locale=de&tags=one&tags=two&filter%5Brole%5D=admin');
  expect(requests[0].headers.authorization).toBe('Bearer token-42');
  expect(requests[0].headers['x-trace']).toBe('trace-42');

  await page.getByRole('tab', { name: 'JavaScript' }).click();
  await expect(page.locator('pre').filter({ hasText: 'fetch(' })).toBeVisible();
  await expect(page.locator('pre').filter({ hasText: 'Bearer token-42' })).toBeVisible();
});


test('Try It routes cookie requests through the API host and reuses the shared response viewer', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'desktop host Try It coverage');

  let targetHits = 0;
  let hostHits = 0;
  let envelope;
  await page.route('https://api.example.test/**', async (route) => {
    targetHits += 1;
    await route.fulfill({ status: 599, body: 'browser target request should not happen' });
  });
  await page.route('**/e2e/__flexdoc/execute', async (route) => {
    hostHits += 1;
    envelope = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 200,
        statusText: 'OK',
        headers: [['Content-Type', 'application/json'], ['Set-Cookie', 'session=hosted; Path=/']],
        body: JSON.stringify({ id: '42', transport: 'api-host-try-it' }),
        responseTime: 17,
        cookies: [{ name: 'session', value: 'hosted', domain: 'api.example.test', path: '/' }],
      }),
    });
  });

  await page.goto('/e2e/index.html?hostExecution=1#get-~2Fpets~2F~7Bid~7D');
  const tryIt = page.locator('[data-try-it-session]');
  await tryIt.getByLabel('Request URL').fill('https://api.example.test/pets/42');
  await tryIt.getByRole('tab', { name: 'Headers' }).click();
  await tryIt.getByRole('button', { name: 'Add' }).click();
  await tryIt.getByLabel('Headers 2 key').fill('Cookie');
  await tryIt.getByLabel('Headers 2 value').fill('session=session-42');
  await tryIt.getByRole('tab', { name: 'Authorization' }).click();
  await tryIt.getByLabel('Authorization type', { exact: true }).selectOption('bearer');
  await tryIt.getByLabel('Bearer token').fill('token-42');

  await expect(tryIt.getByRole('status')).toContainText('The browser cannot send this request. FlexDoc will execute it from the API host.');
  await tryIt.getByRole('button', { name: 'Send request' }).click();

  await expect.poll(() => hostHits).toBe(1);
  expect(targetHits).toBe(0);
  expect(envelope.request.url).toContain('/pets/42');
  await expect(page.getByText('200 OK', { exact: true })).toBeVisible();
  const responseViewer = tryIt.locator('section[aria-labelledby="api-client-response-heading"]');
  await expect(responseViewer).toBeVisible();
  await expect(responseViewer.locator('pre').filter({ hasText: 'api-host-try-it' })).toBeVisible();
});

test('Try It hands live values and custom servers to the API Client', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'desktop API Client coverage');

  await page.goto('/e2e/index.html#get-~2Fpets~2F~7Bid~7D');
  await expect(page.getByRole('heading', { name: 'Get a pet' })).toBeVisible();

  const tryIt = page.locator('[data-try-it-session]');
  await tryIt.getByLabel('Request URL').fill('https://api.example.test/pets/42');
  await tryIt.getByLabel('Query parameters 1 value').fill('de');
  await tryIt.getByRole('tab', { name: 'Headers' }).click();
  await tryIt.getByLabel('Headers 1 value').fill('trace-42');
  await tryIt.getByRole('tab', { name: 'Authorization' }).click();
  await tryIt.getByLabel('Authorization type', { exact: true }).selectOption('bearer');
  await tryIt.getByLabel('Bearer token').fill('handoff-token');
  await tryIt.getByLabel('API Client custom server URL').fill('http://localhost:8080');
  await tryIt.getByRole('button', { name: 'Open in API Client' }).click();

  const apiClientPage = page.locator('[data-api-client-page="api-client"]');
  await expect(apiClientPage).toBeVisible();
  await expect(apiClientPage.getByLabel('Request URL')).toHaveValue('http://localhost:8080/pets/42');
  await expect(apiClientPage.getByLabel('API Client custom server URL')).toHaveValue('http://localhost:8080');
  await apiClientPage.getByRole('tab', { name: 'Params' }).click();
  await expect(apiClientPage.getByLabel('Query parameters 1 key')).toHaveValue('locale');
  await expect(apiClientPage.getByLabel('Query parameters 1 value')).toHaveValue('de');
  await apiClientPage.getByRole('tab', { name: 'Headers' }).click();
  await expect(apiClientPage.getByLabel('Headers 1 key')).toHaveValue('X-Trace');
  await expect(apiClientPage.getByLabel('Headers 1 value')).toHaveValue('trace-42');
  await expect(apiClientPage.getByLabel(/^Headers \d+ key$/)).toHaveCount(1);
  await apiClientPage.getByRole('tab', { name: 'Authorization' }).click();
  await expect(apiClientPage.getByLabel('Authorization type', { exact: true })).toHaveValue('bearer');
  await expect(apiClientPage.getByLabel('Bearer token')).toHaveValue('handoff-token');

  await apiClientPage.getByLabel('API Client server').selectOption('https://backup.example.test');
  await expect(apiClientPage.getByLabel('Request URL')).toHaveValue('https://backup.example.test/pets/42');
  await apiClientPage.getByRole('tab', { name: 'Params' }).click();
  await expect(apiClientPage.getByLabel('Query parameters 1 value')).toHaveValue('de');

  await apiClientPage.getByLabel('New folder name').fill('Pets');
  await apiClientPage.getByRole('button', { name: 'Add folder' }).click();
  await expect(apiClientPage.getByRole('button', { name: 'Delete folder Pets' })).toBeVisible();
  await expect(apiClientPage.getByLabel('Saved request folder')).toHaveValue(/folder-/);

  await apiClientPage.getByLabel('Saved request name').fill('Get pet 42');
  await apiClientPage.getByRole('button', { name: 'Save request' }).click();
  await expect(apiClientPage.getByRole('button', { name: 'Load saved request Get pet 42' })).toBeVisible();

  await apiClientPage.getByLabel('Request URL').fill('https://backup.example.test/owners');
  await expect(apiClientPage.getByLabel('Request URL')).toHaveValue('https://backup.example.test/owners');
  await apiClientPage.getByRole('button', { name: 'Load saved request Get pet 42' }).click();
  await expect(apiClientPage.getByLabel('Request URL')).toHaveValue('https://backup.example.test/pets/42');

  await expect.poll(async () => {
    const workspace = await readApiClientWorkspace(page);
    return workspace?.requests?.some((request) => request.name === 'Get pet 42');
  }).toBe(true);

  await page.reload();
  const reopenedPage = page.locator('[data-api-client-page="api-client"]');
  await expect(reopenedPage).toBeVisible();
  await expect(reopenedPage.getByRole('button', { name: 'Load saved request Get pet 42' })).toBeVisible();
});

test('API Client environments resolve templates while saved requests keep raw drafts', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'desktop environment coverage');

  const requests = [];
  await page.route('https://env.example.test/**', async (route) => {
    requests.push({ url: route.request().url(), headers: route.request().headers() });
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });

  await page.goto('/e2e/index.html#get-~2Fpets~2F~7Bid~7D');
  await page.getByRole('button', { name: 'Open in API Client' }).click();
  const apiClient = page.locator('[data-api-client-page="api-client"]');
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
  await apiClient.getByRole('tab', { name: 'Headers' }).click();
  await apiClient.getByLabel('Headers 1 value').fill('{{petId}}');
  await apiClient.getByRole('button', { name: 'Send request' }).click();
  await expect(apiClient.getByText('200 OK', { exact: true })).toBeVisible();

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
  const reopenedClient = page.locator('[data-api-client-page="api-client"]');
  await expect(reopenedClient).toBeVisible();
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
  await expect(page).toHaveURL(/#get-~2Fpets~2F~7Bid~7D$/);
});

test('canonical overview visual remains stable', async ({ page }, testInfo) => {
  await page.goto('/e2e/index.html');
  await expect(page.getByText('FlexDoc Browser Fixture', { exact: true }).first()).toBeVisible();
  const screenshot = await page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide' });
  await testInfo.attach('overview.png', { body: screenshot, contentType: 'image/png' });
  const digest = createHash('sha256').update(screenshot).digest('hex');
  expect(digest).toBe(overviewDigests[testInfo.project.name]);
});
