import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  outputDir: './screenshots/artifacts',
  snapshotDir: './screenshots/snapshots',
  timeout: 15_000,
  retries: 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'screenshots/report', open: 'never' }],
  ],

  use: {
    baseURL: 'http://localhost:1423',
    colorScheme: 'dark',
    screenshot: 'only-on-failure',
    actionTimeout: 5_000,
  },

  projects: [
    {
      name: 'screenshots',
      testMatch: 'tests/screenshots.spec.ts',
      use: { ...devices['Desktop Chrome'], viewport: { width: 400, height: 700 } },
    },
    {
      name: 'dashboard-screenshots',
      testMatch: 'tests/dashboard.spec.ts',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1100, height: 800 } },
    },
    {
      name: 'interactions',
      testMatch: 'tests/interactions.spec.ts',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1100, height: 800 } },
    },
  ],

  webServer: {
    command: 'npm run dev',
    port: 1423,
    reuseExistingServer: true,
    timeout: 30_000,
  },
})
