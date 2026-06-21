import { defineConfig, devices } from '@playwright/test';

/**
 * e2e config. The library's core behavior (marker placement, overlap avoidance, popup positioning,
 * blocking-layer click absorption, scroll following, scrim/cursor) needs a real layout engine, which
 * jsdom unit tests can't provide — so these run against the demo in a real browser.
 *
 * The demo is served by the existing scripts/serve.js on port 5500; webServer starts it automatically
 * (reused locally if already running). Run across Chromium, Firefox, and WebKit, since the behaviors
 * under test are layout-engine dependent and most likely to differ between rendering engines.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'html',
  use: {
    baseURL: 'http://localhost:5500',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  webServer: {
    command: 'node scripts/serve.js',
    url: 'http://localhost:5500/demo/',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
