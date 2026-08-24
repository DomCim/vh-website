import { readFileSync } from 'node:fs'

import { defineConfig, devices } from '@playwright/test'

/*
 * Fehlende Werte aus der `.env` nachtragen.
 *
 * Die Prüfungen brauchen drei Angaben, und wer sie nicht kennt, bekommt
 * Fehlschläge, die nach kaputtem Code aussehen und keine sind:
 *
 *   TEST_BASE_URL         wohin geprüft wird
 *   ADMIN_TEST_PASSWORT   ohne das überspringen sich 27 Prüfungen still
 *   PAYLOAD_SECRET        womit der Abhol-Link fürs Steuerpaket signiert wird
 *
 * Das hat einen Nachmittag gekostet: 18 rote Prüfungen, von denen am Ende
 * genau zwei echt waren. Die übrigen kamen daher, dass `NEXT_PUBLIC_SERVER_URL`
 * in der `.env` auf eine andere Adresse zeigte als die, gegen die geprüft
 * wurde — Payload trägt diese Adresse selbst in seine Herkunftsliste ein und
 * weist danach jede Anfrage von woanders mit 403 ab.
 *
 * Die Umgebung hat weiter Vorrang; hier wird nur aufgefüllt, was fehlt. In der
 * CI gibt es keine `.env`, und das ist richtig so — dort setzt der Workflow
 * die Werte.
 */
function ausEnvDatei() {
  if (process.env.CI) return
  let inhalt: string
  try {
    inhalt = readFileSync(new URL('.env', import.meta.url), 'utf8')
  } catch {
    return // Keine .env — dann muss die Umgebung alles mitbringen
  }
  for (const zeile of inhalt.split('\n')) {
    const treffer = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/.exec(zeile)
    if (!treffer) continue
    const [, name, roh] = treffer
    if (process.env[name] !== undefined) continue
    process.env[name] = roh.trim().replace(/^["']|["']$/g, '')
  }

  /*
   * Das Anmeldekennwort heißt in der `.env` anders als in den Prüfungen.
   *
   * Dort steht `ADMIN_PASSWORT` — damit legt `scripts/benutzer.ts` das Konto
   * an. Die Prüfungen fragen nach `ADMIN_TEST_PASSWORT`. Es ist dasselbe
   * Kennwort für dasselbe Konto, und wer den Unterschied nicht kennt, bekommt
   * keinen Fehler, sondern 27 stillschweigend übersprungene Prüfungen — was
   * im Bericht aussieht, als sei alles in Ordnung.
   */
  if (!process.env.ADMIN_TEST_PASSWORT && process.env.ADMIN_PASSWORT) {
    process.env.ADMIN_TEST_PASSWORT = process.env.ADMIN_PASSWORT
  }
}
ausEnvDatei()

/*
 * Geprüft wird gegen dieselbe Adresse, die auch in der Anwendung steht.
 *
 * Weichen die beiden voneinander ab, weist Payloads Herkunftsprüfung die
 * angemeldeten Anfragen ab — mit 403, ohne Hinweis worauf. Darum hier
 * derselbe Wert statt eines zweiten Vorgabewerts.
 */
const BASIS =
  process.env.TEST_BASE_URL ?? process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3000'

/*
 * Und derselbe Wert zurück in die Umgebung.
 *
 * Die Prüfdateien lesen `TEST_BASE_URL` jede für sich — die Zeile
 * `const BASIS = process.env.TEST_BASE_URL ?? 'http://localhost:3000'` steht
 * sechsunddreißig Mal wortgleich in `tests/`. Ohne diese Zuweisung liefe
 * jede von ihnen weiter gegen Port 3000, während hier längst der richtige
 * Wert steht.
 */
process.env.TEST_BASE_URL = BASIS

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
  /*
   * Örtlich eine Prüfung nach der anderen.
   *
   * Playwright nimmt sonst die halbe Zahl der Kerne — hier acht. Alle acht
   * melden sich mit **demselben** Konto an, legen Kontakte und Rollen an und
   * schreiben auf denselben Entwurfsschlüssel; die Prüfungen sehen dann
   * Daten, die eine andere gerade angelegt oder weggeräumt hat. Nachgemessen
   * (08/2026): mit acht Arbeitern 18 rote Prüfungen, mit einem 15 — und
   * zwischen zwei Läufen wanderten Prüfungen ohne jede Änderung von rot nach
   * grün und zurück. Eine Prüfung, deren Ergebnis vom Zufall abhängt, sagt
   * nichts.
   *
   * Es kostet nichts: 3m50 gegenüber 5m06 — die Zeit, die die Gleichzeitigkeit
   * bringt, ging vorher für Wartezeiten und Wiederholungen wieder drauf.
   *
   * In der CI bleibt es beim Vorgabewert: Dort steht eine frische Datenbank je
   * Lauf, und der Grund für das Gedränge fällt weg.
   */
  workers: process.env.CI ? undefined : 1,
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
