import { defineConfig, devices } from '@playwright/test'

const BASIS = process.env.TEST_BASE_URL ?? 'http://localhost:3000'

/**
 * Rauchtests: prüfen nach dem Bauen, dass die Website antwortet und der
 * MCP-Endpunkt korrekt abriegelt. Der Server muss dafür laufen — in der CI
 * startet ihn der Workflow, lokal reicht `pnpm dev`.
 */
export default defineConfig({
  testDir: './tests',
  /*
   * Zwei Minuten je Prüfung statt dreißig Sekunden.
   *
   * Die Büro-Prüfungen sind länger geworden: anmelden, Bestand abwarten, Netz
   * abschalten, Eingabe machen, Netz wieder an, warten bis die Warteschlange
   * durch ist. Das dauert im gebauten Stand eine halbe Minute und in der
   * Entwicklung ein Vielfaches. Mit dem alten Wert scheiterten sie an der Uhr
   * statt an der Sache — und ein Test, der aus Zeitgründen rot wird, sagt
   * nichts aus.
   */
  timeout: 120_000,
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
