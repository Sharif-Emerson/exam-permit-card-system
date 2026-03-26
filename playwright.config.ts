import { defineConfig, devices } from '@playwright/test'

// eslint-disable-next-line no-undef
const isCI = process.env.CI === 'true'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev:rest:e2e',
    url: 'http://127.0.0.1:4173/login',
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
})
