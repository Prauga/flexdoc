const { test, expect } = require('@playwright/test');

const API_CLIENT_SPEC_TITLE = 'FlexDoc Browser Fixture';

async function readApiClientWorkspace(page) {
  return page.evaluate(async (specTitle) => new Promise((resolve, reject) => {
    const workspaceKey = `flexdoc:${encodeURIComponent(window.location.host)}:${encodeURIComponent(specTitle)}`;
    const openRequest = indexedDB.open('flexdoc-api-client');
    openRequest.onerror = () => reject(openRequest.error);
    openRequest.onsuccess = () => {
      const database = openRequest.result;
      const transaction = database.transaction('workspaces', 'readonly');
      const request = transaction.objectStore('workspaces').get(workspaceKey);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        resolve(request.result || null);
        database.close();
      };
    };
  }), API_CLIENT_SPEC_TITLE);
}

test('API Client runs scripts, persists history, and replays requests', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'desktop scripting coverage');

  const requests = [];
  await page.route('https://script.example.test/**', async (route) => {
    requests.push({ url: route.request().url(), headers: route.request().headers() });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 77, name: 'Scripted Milo' }),
      headers: { 'x-script-response': 'yes' },
    });
  });

  await page.goto('/e2e/index.html#get-pets-id');
  await page.getByLabel('path id').fill('42');
  await page.getByRole('button', { name: 'Open in API Client' }).click();
  const apiClient = page.locator('section[aria-labelledby="api-client-heading"]');
  await expect(apiClient).toBeVisible();

  await apiClient.getByLabel('New environment name').fill('Script env');
  await apiClient.getByRole('button', { name: 'Add environment' }).click();
  await apiClient.getByRole('button', { name: 'Add environment variable' }).click();
  await apiClient.getByLabel('Environment variable 1 key').fill('baseUrl');
  await apiClient.getByLabel('Environment variable 1 value').fill('https://script.example.test');

  await apiClient.getByLabel('Request URL').fill('{{baseUrl}}/pets/{{petId}}');
  const preRequestScript = [
    "flex.collection.set('petId', '77');",
    "flex.request.headers.set('X-Script', 'run-77');",
    "flex.environment.set('lastRun', 'pre');",
    "console.log('prepared', flex.variables.get('petId'));",
  ].join('\n');
  const testScript = [
    "flex.test('status is 200', () => flex.expect(flex.response.code).to.equal(200));",
    "flex.test('body id is 77', () => flex.expect(flex.response.json()).to.have.property('id', 77));",
    "flex.test('collection pet id is 77', () => flex.expect(flex.collection.get('petId')).to.equal('77'));",
    "flex.collection.set('lastPetFromCollection', String(flex.response.json().id));",
    "flex.environment.set('lastPet', String(flex.response.json().id));",
    "console.log('tested', flex.response.code);",
  ].join('\n');

  await apiClient.getByLabel('Pre-request script').fill(preRequestScript);
  await apiClient.getByLabel('Tests script').fill(testScript);
  await apiClient.getByRole('button', { name: 'Send request' }).click();

  await expect(apiClient.getByText(/Response\s+200\s+OK/)).toBeVisible();
  await expect(apiClient.getByText('3/3 passed')).toBeVisible();
  await expect(apiClient.getByText('PASS — status is 200')).toBeVisible();
  await expect(apiClient.getByText('PASS — body id is 77')).toBeVisible();
  await expect(apiClient.getByText('PASS — collection pet id is 77')).toBeVisible();
  await expect(apiClient.locator('pre').filter({ hasText: 'prepared 77' })).toContainText('tested 200');

  expect(requests).toHaveLength(1);
  expect(requests[0].url).toBe('https://script.example.test/pets/77?locale=fr');
  expect(requests[0].headers['x-script']).toBe('run-77');

  const historyLoad = apiClient.getByRole('button', { name: 'Load history request GET https://script.example.test/pets/77?locale=fr' });
  await expect(historyLoad).toBeVisible();

  await apiClient.getByLabel('Saved request name').fill('Scripted pet');
  await apiClient.getByRole('button', { name: 'Save request' }).click();
  await expect(apiClient.getByRole('button', { name: 'Load saved request Scripted pet' })).toBeVisible();

  await expect.poll(async () => {
    const workspace = await readApiClientWorkspace(page);
    const saved = workspace?.requests?.find((request) => request.name === 'Scripted pet');
    const environment = workspace?.environments?.find((candidate) => candidate.id === workspace?.activeEnvironmentId);
    const values = Object.fromEntries((environment?.variables || []).map((variable) => [variable.key, variable.value]));
    const collection = workspace?.collections?.[0];
    const collectionValues = Object.fromEntries((collection?.variables || []).map((variable) => [variable.key, variable.value]));
    const history = workspace?.history?.[0];
    return {
      version: workspace?.version,
      preRequest: saved?.scripts?.preRequest,
      tests: saved?.scripts?.tests,
      lastRun: values.lastRun,
      lastPet: values.lastPet,
      collectionPetId: collectionValues.petId,
      collectionLastPet: collectionValues.lastPetFromCollection,
      historyCount: workspace?.history?.length,
      historyMethod: history?.executedMethod,
      historyUrl: history?.resolvedUrl,
      historyStatus: history?.status,
      historyRequestUrl: history?.request?.url,
    };
  }).toEqual({
    version: 6,
    preRequest: preRequestScript,
    tests: testScript,
    lastRun: 'pre',
    lastPet: '77',
    collectionPetId: '77',
    collectionLastPet: '77',
    historyCount: 1,
    historyMethod: 'GET',
    historyUrl: 'https://script.example.test/pets/77?locale=fr',
    historyStatus: 200,
    historyRequestUrl: '{{baseUrl}}/pets/{{petId}}',
  });

  await apiClient.getByLabel('Request URL').fill('https://changed.example.test/ignored');
  await apiClient.getByLabel('Pre-request script').fill('');
  await apiClient.getByLabel('Tests script').fill('');
  await historyLoad.click();
  await expect(apiClient.getByLabel('Request URL')).toHaveValue('{{baseUrl}}/pets/{{petId}}');
  await expect(apiClient.getByLabel('Pre-request script')).toHaveValue(preRequestScript);
  await expect(apiClient.getByLabel('Tests script')).toHaveValue(testScript);

  await apiClient.getByLabel('Pre-request script').fill('');
  await apiClient.getByLabel('Tests script').fill('');
  await apiClient.getByRole('button', { name: 'Load saved request Scripted pet' }).click();
  await expect(apiClient.getByLabel('Pre-request script')).toHaveValue(preRequestScript);
  await expect(apiClient.getByLabel('Tests script')).toHaveValue(testScript);

  await apiClient.getByRole('button', { name: 'Clear history' }).click();
  await expect(historyLoad).toHaveCount(0);
  await expect.poll(async () => (await readApiClientWorkspace(page))?.history?.length).toBe(0);
});
