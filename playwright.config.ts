import { defineConfig, devices } from '@playwright/test'
import * as path from 'path'

export const AUTH_CLIENT_FILE = path.join(__dirname, 'e2e/.auth/client.json')
export const AUTH_UNAUTH_FILE = path.join(__dirname, 'e2e/.auth/unauth.json')

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['html', { open: 'never' }], ['list']],

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    // ── Auth setup (runs first, saves browser sessions) ──
    {
      name: 'auth-setup',
      testMatch: '**/setup/*.setup.ts',
      use: { ...devices['Desktop Chrome'] },
    },

    // ── Authenticated client tests ──
    {
      name: 'portal',
      testMatch: '**/tests/portal.spec.ts',
      dependencies: ['auth-setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: AUTH_CLIENT_FILE,
      },
    },

    // ── Login page + unauthorized flow (no saved session) ──
    {
      name: 'auth',
      testMatch: ['**/tests/login.spec.ts', '**/tests/unauthorized.spec.ts'],
      dependencies: ['auth-setup'],
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  globalSetup: './e2e/global-setup.ts',

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
