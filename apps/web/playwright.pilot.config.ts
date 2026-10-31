import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './test/pilot',
  timeout: 90_000,
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  outputDir: process.env.PILOT_ARTIFACTS_DIR ?? '/tmp/meinager-pilot-playwright',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: process.env.PILOT_WEB_URL,
    trace: 'off',
    screenshot: 'only-on-failure',
    video: 'off',
  },
});
