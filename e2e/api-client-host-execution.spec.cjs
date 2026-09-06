const { test, expect } = require('@playwright/test');

async function openHostApiClient(page) {
  await page.goto('/e2e/index.html?hostExecution=1#get-pets-id');
  await page.getByLabel('path id').fill('42');
  await page.getByRole('button', { name: 'Open in API Client' }).click();
  const apiClient = page.locator('section[aria-labelledby="api-client-heading"]');
  await expect(apiClient).toBeVisible();
  return apiClient;
}

test('host-only auth executes through the API host and keeps the normal response pipeline', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'desktop host execution coverage');

  let targetHits = 0;
  let hostRequest;
  await page.route('https://api.example.test/**', async (route) => {
    targetHits += 1;
    await route.fulfill({ status: 599, body: 'browser target request should not happen' });
  });
  await page.route('**/e2e/__flexdoc/execute', async (route) => {
    hostRequest = {
      headers: route.request().headers(),
      envelope: route.request().postDataJSON(),
    };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 201,
        statusText: 'Created',
        headers: [['Content-Type', 'application/json'], ['X-Executed-By', 'flexdoc-host']],
        body: JSON.stringify({ ok: true, transport: 'api-host' }),
        responseTime: 19,
        cookies: [{ name: 'session', value: 'fixture', domain: 'api.example.test', path: '/', httpOnly: true }],
      }),
    });
  });

  const apiClient = await openHostApiClient(page);
  await apiClient.getByLabel('Authorization type', { exact: true }).selectOption('digest');
  await apiClient.getByLabel('Digest username').fill('alice');
  await apiClient.getByLabel('Digest password').fill('secret');
  await apiClient.getByLabel('Client certificate').selectOption('client-cert');
  await apiClient.getByLabel('Use API host cookie jar').check();
  await apiClient.getByLabel('Tests script').fill("flex.test('host response', () => flex.expect(flex.response?.code).to.equal(201));");

  await expect(apiClient.getByRole('status')).toContainText('FlexDoc will execute it from the API host');
  await apiClient.getByRole('button', { name: 'Send request' }).click();

  await expect.poll(() => hostRequest?.envelope?.request?.auth?.type).toBe('digest');
  expect(targetHits).toBe(0);
  expect(hostRequest.headers['x-flexdoc-execute']).toBe('1');
  expect(hostRequest.envelope.request.auth).toMatchObject({ type: 'digest', username: 'alice', password: 'secret' });
  expect(hostRequest.envelope.certificateId).toBe('client-cert');
  expect(hostRequest.envelope.cookieJar).toBe('session');

  await expect(apiClient.getByText('201 Created', { exact: true })).toBeVisible();
  await expect(apiClient.getByText(/api-host/)).toBeVisible();
  await expect(apiClient.getByText('PASS — host response')).toBeVisible();
});

test('host-only auth remains unavailable when the docs host exposes no executor', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'desktop host capability gating coverage');
  await page.goto('/e2e/index.html#get-pets-id');
  await page.getByLabel('path id').fill('42');
  await page.getByRole('button', { name: 'Open in API Client' }).click();
  const apiClient = page.locator('section[aria-labelledby="api-client-heading"]');
  const auth = apiClient.getByLabel('Authorization type', { exact: true });
  await expect(auth.locator('option[value="digest"]')).toHaveAttribute('disabled', '');
  await expect(auth.locator('option[value="oauth1"]')).toHaveAttribute('disabled', '');
  await expect(auth.locator('option[value="awsv4"]')).toHaveAttribute('disabled', '');
});
