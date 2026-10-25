import { defineConfig, devices } from '@playwright/test';

/**
 * E2E against the real local stack: Supabase (CLI), media worker (Docker) and the web app.
 * Camera/microphone come from Chromium's fake devices, the position from Playwright's
 * geolocation emulation (Belleville, Paris, ±20 m).
 */
export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    geolocation: { latitude: 48.8722, longitude: 2.3767, accuracy: 20 },
    permissions: ['camera', 'microphone', 'geolocation'],
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Pixel 7'],
        launchOptions: {
          args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
        },
      },
    },
  ],
  webServer: {
    command: process.env.CI
      ? 'pnpm --filter @nl/web build && pnpm --filter @nl/web start'
      : 'pnpm dev',
    url: 'http://localhost:3000/login',
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});
