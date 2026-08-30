const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './e2e',
  testMatch: 'cli-static.spec.cjs',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['line'], ['html', { open: 'never', outputFolder: 'playwright-cli-report' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4175/docs/',
    browserName: 'chromium',
    viewport: { width: 1440, height: 1000 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'FLEXDOC_CLIENT_DIR=packages/client node tools/flexdoc-cli/bin/flexdoc.js serve tools/flexdoc-cli/test/fixtures/openapi.yaml --host 127.0.0.1 --port 4175 --base-path /docs/',
    url: 'http://127.0.0.1:4175/docs/',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
