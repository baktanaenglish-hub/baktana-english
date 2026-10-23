import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests (e2e/). Starts the API with an in-memory database and the
 * Vite dev server in front of it, then drives the app in Chromium.
 *
 * Browsers are not downloaded by this project: set CHROMIUM_PATH, or a
 * preinstalled Chromium at /opt/pw-browsers/chromium is used when present,
 * otherwise Playwright's own lookup (PLAYWRIGHT_BROWSERS_PATH).
 */
const API_PORT = Number(process.env.E2E_API_PORT ?? 3105);
const WEB_PORT = Number(process.env.E2E_WEB_PORT ?? 5185);
const chromium = process.env.CHROMIUM_PATH ?? ['/opt/pw-browsers/chromium'].find((p) => existsSync(p));

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    locale: 'he-IL',
    viewport: { width: 420, height: 860 },
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 420, height: 860 },
        launchOptions: { executablePath: chromium },
      },
    },
  ],
  webServer: [
    {
      command: 'npm --prefix server start',
      url: `http://localhost:${API_PORT}/api/health`,
      env: { PORT: String(API_PORT), DATABASE_PATH: ':memory:', JWT_SECRET: 'e2e-secret', NODE_ENV: 'test' },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `npx vite --port ${WEB_PORT} --strictPort`,
      url: `http://localhost:${WEB_PORT}`,
      // VITE_CALLS_UNLOCKED opens the call tab; a RevenueCat key puts premium "on sale" (src/lib/billing.ts),
      // so the premium screen is tested. In the browser there is no store, so nothing can be bought.
      env: {
        API_URL: `http://localhost:${API_PORT}`,
        VITE_CALLS_UNLOCKED: 'true',
        VITE_REVENUECAT_ANDROID_KEY: 'goog_e2e',
      },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
