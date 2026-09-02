import { expect, test } from '@playwright/test'

import { locales, t } from '../src/lib/i18n'

/**
 * Der Kredit im Fuß und der Pfeil, der mitfährt.
 *
 * Zwei Sorten Prüfung, und die Trennung ist Absicht: Was sich ohne Server
 * prüfen lässt, wird ohne Server geprüft — dass der Kredit in allen drei
 * Sprachen vorhanden ist, hängt an keiner Datenbank. Nur das Verhalten des
 * Knopfes braucht eine laufende Seite; ohne sie überspringt sich der Rest
 * still, statt rot zu sein.
 */

const BASIS = process.env.TEST_BASE_URL ?? 'http://localhost:3000'

test('der Kredit steht in allen drei Sprachen', () => {
  // Eine fehlende Übersetzung fiele sonst erst auf, wenn jemand die
  // französische Seite bis unten scrollt — also nie.
  for (const sprache of locales) {
    const text = t(sprache).footer.umgesetztVon
    expect(text, `${sprache}: umgesetztVon fehlt`).toBeTruthy()
    expect(text, `${sprache}: der Name gehört nicht übersetzt`).toContain('DiD0m')
  }
})

test('der Pfeil hat in jeder Sprache eine Beschriftung', () => {
  // Der Knopf trägt nur ein Zeichen. Ohne aria-label sagt ein Vorleser
  // „Schaltfläche Pfeil nach oben" — oder gar nichts.
  for (const sprache of locales) {
    expect(t(sprache).nav.nachOben, `${sprache}: nachOben fehlt`).toBeTruthy()
  }
})

test.describe('am laufenden Server', () => {
  test('der Fuß führt zu did0m.dev, und zwar in neuem Fenster', async ({ page }) => {
    await page.goto(`${BASIS}/de`)
    const kredit = page.locator('footer a[href="https://did0m.dev"]')
    await expect(kredit).toHaveCount(1)
    await expect(kredit).toContainText('DiD0m')
    // `noopener` schützt die eigene Seite; auf `noreferrer` wird bewusst
    // verzichtet, damit did0m.dev sieht, woher der Besuch kommt.
    await expect(kredit).toHaveAttribute('rel', 'noopener')
    await expect(kredit.locator('svg')).toHaveCount(1)
  })

  test('das alte „↑" steht nicht mehr im Fuß', async ({ page }) => {
    await page.goto(`${BASIS}/de`)
    await expect(page.locator('footer a[href="#top"]')).toHaveCount(0)
  })

  test('der Pfeil kommt erst weit unten und geht am Fuß wieder', async ({ page }) => {
    await page.goto(`${BASIS}/de`)
    const knopf = page.getByRole('button', { name: 'Zurück nach oben' })

    // Oben: da, aber unsichtbar — ein Knopf, der immer steht, ist Möblierung.
    await expect(knopf).not.toBeInViewport()

    // Zwei Bildschirmhöhen weiter unten soll er sich zeigen …
    await page.evaluate(() => window.scrollTo(0, window.innerHeight * 3))
    await expect(knopf).toBeInViewport()

    // … und am Seitenende wieder verschwinden, wo der Fuß steht.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await expect(knopf).not.toBeInViewport()
  })
})
