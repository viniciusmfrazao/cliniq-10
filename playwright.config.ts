import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html'], ['list']],
  timeout: 30000,
  
  use: {
    baseURL: process.env.TEST_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },

  projects: [
    // Setup project - faz login
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    // Testes principais
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        storageState: './tests/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    // Testes mobile
    {
      name: 'mobile',
      use: { 
        ...devices['iPhone 13'],
        storageState: './tests/.auth/user.json',
      },
      dependencies: ['setup'],
      testMatch: /.*responsiv.*\.spec\.ts/,
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
})
