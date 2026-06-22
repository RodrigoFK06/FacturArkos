import { defineConfig, devices } from '@playwright/test';

// E2E contra el stack local ya en marcha: web dev en :3000, API en :3001.
// (No levanta servidores: arranca `pnpm dev:web` + la API antes de `pnpm test:e2e`.)
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1, // DB compartida → sin carreras
  timeout: 30_000,
  expect: { timeout: 8_000 },
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
