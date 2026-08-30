const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './e2e',
  testIgnore: 'cli-static.spec.cjs',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: { browserName: 'chromium', viewport: { width: 1440, height: 1000 } },
    },
    {
      name: 'chromium-mobile',
      use: { browserName: 'chromium', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    },
  ],
  webServer: {
    command: 'npm run dev -w packages/client -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173/e2e/index.html',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
