import { expect, test } from '@playwright/test'

import { locales, t } from '../src/lib/i18n'

/**
 * Die Seite für eine Adresse, die es nicht gibt.
 *
 * **Warum das eine eigene Prüfung wert ist.** Eine 404-Seite sieht niemand
 * freiwillig an; sie verfällt deshalb unbemerkt. Vorher war es Nexts nackte
 * Notseite mit einem englischen Satz — auch auf `/fr/`.
 *
 * Zwei Sorten Prüfung, wie beim Fuß: Was ohne Server geht, geht ohne Server.
 */

const BASIS = process.env.TEST_BASE_URL ?? 'http://localhost:3000'

test('die Fehlerseite ist in allen drei Sprachen betextet', () => {
  for (const sprache of locales) {
    const texte = t(sprache).notFound
    expect(texte.title, `${sprache}: title fehlt`).toBeTruthy()
    expect(texte.lead, `${sprache}: lead fehlt`).toBeTruthy()
    expect(texte.waysTitle, `${sprache}: waysTitle fehlt`).toBeTruthy()
  }
})

test.describe('am laufenden Server', () => {
  /**
   * Der Statuscode ist der eigentliche Gegenstand dieser Prüfung.
   *
   * Es ist verlockend, eine tote Adresse auf die Startseite umzuleiten — dann
   * sieht niemand mehr einen Fehler. Google wertet das als „Soft 404": Die
   * Adresse fliegt genauso aus dem Index, und die Search Console meldet den
   * Fehler nicht mehr. Damit verlöre der Betrieb die Liste, aus der die
   * Umleitungen in `next.config.mjs` entstehen.
   */
  test('eine tote Adresse antwortet mit 404 und nicht mit einer Umleitung', async ({ request }) => {
    const antwort = await request.get(`${BASIS}/de/gibt-es-nicht`, { maxRedirects: 0 })
    expect(antwort.status()).toBe(404)
  })

  test('die Fehlerseite spricht die Sprache des Pfades', async ({ page }) => {
    // Die Sprache steht im Pfad, aber Next reicht `not-found.tsx` keine
    // Wegparameter durch — sie kommt aus dem Kopf, den die Middleware setzt.
    // Fällt der weg, wird daraus still eine deutsche Seite für Franzosen.
    await page.goto(`${BASIS}/fr/nexiste-pas`)
    await expect(page.locator('h1')).toContainText(t('fr').notFound.title)

    await page.goto(`${BASIS}/en/does-not-exist`)
    await expect(page.locator('h1')).toContainText(t('en').notFound.title)
  })

  test('von der Fehlerseite führen Wege weiter', async ({ page }) => {
    await page.goto(`${BASIS}/de/gibt-es-nicht`)
    // Die Suche ist der wichtigste davon: Wer hier landet, weiß meist, wonach
    // er sucht — nur nicht mehr, unter welcher Adresse.
    await expect(page.locator('form[action="/de/suche"] input[name="q"]')).toHaveCount(1)
    for (const pfad of ['/de/kollektion', '/de/projekte', '/de/massanfertigung', '/de/kontakt']) {
      await expect(page.locator(`main a[href="${pfad}"]`).first()).toBeVisible()
    }
  })
})
