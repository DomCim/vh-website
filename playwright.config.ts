import { defineConfig, devices } from '@playwright/test'

const BASIS = process.env.TEST_BASE_URL ?? 'http://localhost:3000'

/**
 * Rauchtests: prüfen nach dem Bauen, dass die Website antwortet und der
 * MCP-Endpunkt korrekt abriegelt. Der Server muss dafür laufen — in der CI
 * startet ihn der Workflow, lokal reicht `pnpm dev`.
 */
export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: BASIS,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Manche Entwicklungsumgebungen bringen einen eigenen Chromium mit,
        // dessen Version nicht zur gepinnten Playwright-Fassung passt.
        // Dann einfach PLAYWRIGHT_CHROMIUM_PATH setzen statt neu zu laden.
        ...(process.env.PLAYWRIGHT_CHROMIUM_PATH
          ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } }
          : {}),
      },
    },
  ],
})
