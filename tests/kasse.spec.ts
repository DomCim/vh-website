import { expect, test } from '@playwright/test'

import { sitzungErzeugen } from '../src/lib/kundenportal'

/**
 * Die Kasse in Schritten — und die E-Mail-Bestätigung als Tor.
 *
 * Vorher lief alles auf einer Seite: siebzehn Felder untereinander, und die
 * Bestätigung der Adresse kam ganz am Schluss, nach dem Klick auf
 * „Bestellen". Wer sich vertippt hatte, erfuhr es als Letztes — dabei hängt an
 * dieser Adresse alles: Bestätigungsmail, Rechnung, Versandmeldung und der
 * Zugang zum Kundenportal.
 *
 * Geprüft wird deshalb vor allem, dass man **nicht** weiterkommt: ohne
 * Kontaktangaben nicht, und mit Kontaktangaben erst nach der Bestätigung. Der
 * Code selbst kommt per Mail und lässt sich hier nicht lesen — was danach
 * kommt, prüft die Schnittstelle unten direkt.
 */

const WARENKORB = [
  {
    productId: 1,
    slug: 'pruefstueck',
    title: 'Prüfstück',
    variantId: 'pruef-variante',
    variantTitle: 'Klein',
    unitPrice: 890,
    shippingCost: 19,
    quantity: 1,
    madeToOrder: true,
  },
]

/**
 * Legt einen Warenkorb an und öffnet die Kasse.
 *
 * Mit `alsBestaetigt` bekommt der Browser vorab eine gültige Portal-Sitzung
 * für diese Adresse — genau die, die nach dem Eintippen des Codes entstünde.
 * Das ist keine Hintertür, sondern derselbe Weg: Das Cookie wird mit dem
 * Geheimnis des Servers unterschrieben, und ohne dieses Geheimnis taugt es
 * nichts. Anders käme man hier nie über den ersten Schritt hinaus — der Code
 * steht in einer E-Mail, und die liest kein Test.
 */
async function zurKasse(
  page: import('@playwright/test').Page,
  alsBestaetigt?: string,
) {
  if (alsBestaetigt) {
    const sitzung = sitzungErzeugen(alsBestaetigt)
    await page.context().addCookies([
      {
        name: sitzung.name,
        value: sitzung.wert,
        url: process.env.TEST_BASE_URL ?? 'http://localhost:3000',
      },
    ])
  }
  await page.addInitScript((korb) => {
    window.localStorage.setItem('vh-cart-v1', JSON.stringify(korb))
  }, WARENKORB)
  await page.goto('/de/kasse')
  await expect(page.locator('ol[aria-label="Schritte"]')).toBeVisible({ timeout: 30_000 })
}

/** Vom Kontakt in den zweiten Schritt — für alles, was dahinter liegt */
async function bisVersand(page: import('@playwright/test').Page, email: string) {
  await page.fill('input[name=name]', 'Prüf Kundin')
  await page.fill('input[name=email]', email)
  await page.getByRole('button', { name: 'Weiter' }).click()
  await expect(stand(page)).toContainText('Versand', { timeout: 20_000 })
}

const stand = (page: import('@playwright/test').Page) =>
  page.locator('p[aria-live="polite"]').first()

test.describe('Kasse Schritt für Schritt', () => {
  test('beginnt beim Kontakt und zählt die Schritte', async ({ page }) => {
    await zurKasse(page)
    await expect(stand(page)).toContainText('Schritt 1 von 4')
    await expect(stand(page)).toContainText('Kontakt')
  })

  /*
   * Ohne Namen und Adresse geht es nicht weiter. Geprüft wird mit dem, was
   * der Browser ohnehin kann — deshalb steht hier keine eigene Meldung,
   * sondern nur: Man steht noch da, wo man stand.
   */
  test('leere Pflichtfelder halten den ersten Schritt fest', async ({ page }) => {
    await zurKasse(page)
    await page.getByRole('button', { name: 'Weiter' }).click()
    await expect(stand(page)).toContainText('Schritt 1 von 4')
  })

  /**
   * Das Tor: ausgefüllt heißt noch nicht bestätigt.
   *
   * Genau das war der Auftrag — der nächste Schritt öffnet sich erst, wenn
   * die Adresse bestätigt ist. Vorher kam der Code am Ende, wenn schon alles
   * ausgefüllt war.
   */
  test('mit Kontakt, aber ohne bestätigte E-Mail bleibt der zweite Schritt zu', async ({
    page,
  }) => {
    await zurKasse(page)
    await page.fill('input[name=name]', 'Prüf Kundin')
    await page.fill('input[name=email]', `pruef-${Date.now()}@example.test`)
    await page.getByRole('button', { name: 'Weiter' }).click()

    // Das Codefeld erscheint, und der Schritt bleibt derselbe
    await expect(page.locator('input[autocomplete="one-time-code"]')).toBeVisible({
      timeout: 20_000,
    })
    await expect(stand(page)).toContainText('Schritt 1 von 4')

    // Ein falscher Code bringt einen auch nicht weiter
    await page.fill('input[autocomplete="one-time-code"]', '000000')
    await page.getByRole('button', { name: 'Weiter' }).click()
    await expect(page.locator('p[role=alert]')).toContainText('Code', { timeout: 20_000 })
    await expect(stand(page)).toContainText('Schritt 1 von 4')
  })

  /**
   * Ein Schritt, den es gerade nicht gibt, wird auch nicht mitgezählt.
   *
   * Bei Abholung ist keine Lieferanschrift nötig. Stünde sie trotzdem in der
   * Zählung, hieße es „Schritt 2 von 4" und einer bliebe für immer leer.
   */
  test('bei Abholung fällt die Anschrift weg — samt ihrer Nummer', async ({ page }) => {
    const email = `abholung-${Date.now()}@example.test`
    await zurKasse(page, email)
    await bisVersand(page, email)

    await expect(page.locator('ol[aria-label="Schritte"] button')).toHaveCount(4)
    await page.locator('input[name=deliveryMethod][value=pickup]').check()
    await expect(page.locator('ol[aria-label="Schritte"] button')).toHaveCount(3)
    await expect(stand(page)).toContainText('von 3')
  })

  /*
   * Wer schon angemeldet ist, soll nicht bei jeder Bestellung einen Code
   * bekommen. Bestätigt ist bestätigt — das entscheidet der Server anhand des
   * Cookies, nicht die Seite.
   */
  test('wer angemeldet ist, kommt ohne Code weiter', async ({ page }) => {
    const email = `stammkunde-${Date.now()}@example.test`
    await zurKasse(page, email)
    await bisVersand(page, email)
    await expect(page.locator('input[autocomplete="one-time-code"]')).toHaveCount(0)
  })

  /**
   * Der letzte Schritt zeigt, was eingetippt wurde.
   *
   * Am Stück sah man die Anschrift beim Abschicken noch vor sich; in Schritten
   * liegt sie zwei Seiten zurück. Ein Zahlendreher in der Hausnummer fiele
   * sonst erst dem Paketboten auf.
   */
  test('vor dem Bestellen steht noch einmal da, was man eingetippt hat', async ({ page }) => {
    const email = `rueckschau-${Date.now()}@example.test`
    await zurKasse(page, email)
    await bisVersand(page, email)

    await page.locator('input[name=paymentMethod][value=rechnung]').check()
    await page.getByRole('button', { name: 'Weiter' }).click()
    await expect(stand(page)).toContainText('Anschrift')

    await page.fill('input[name=line1]', 'Musterweg 1')
    await page.fill('input[name=postalCode]', '95119')
    await page.fill('input[name=city]', 'Naila')
    await page.getByRole('button', { name: 'Weiter' }).click()
    await expect(stand(page)).toContainText('Schritt 4 von 4')

    const rueckschau = page.locator('dl')
    await expect(rueckschau).toContainText('Prüf Kundin')
    await expect(rueckschau).toContainText(email)
    await expect(rueckschau).toContainText('Musterweg 1, 95119 Naila')
    /*
     * Das Land steht ausgeschrieben da, nicht als Kürzel.
     *
     * Seit den Versandzonen ist es eine Auswahl, und das Feld trägt „DE" —
     * die Rückschau soll aber aussehen wie die Anschrift auf dem Paket.
     */
    await expect(rueckschau).toContainText('Deutschland')
  })

  /**
   * Wohin nicht geliefert wird, lässt sich auch nicht anwählen.
   *
   * Vorher war das Land ein Textfeld: „Schweiz", „CH" und „Suisse" kamen
   * gleichermaßen an, keines ließ sich verrechnen, und der Versand war
   * überall derselbe Betrag. Jetzt kommen die Länder aus den Versandzonen —
   * ohne gepflegte Zone sind das Frankreich, Deutschland und Österreich.
   *
   * Geprüft wird am rohen Seitenaufbau und nicht durch das Formular
   * hindurch: Die Schritte stehen alle im Dokument (nur ausgeblendet), und
   * der Weg bis zur Anschrift kostet einen Bestätigungscode. Fünf davon pro
   * Viertelstunde lässt der Server zu — die sind in dieser Datei vergeben.
   */
  test('das Land ist eine Auswahl aus den Versandzonen', async ({ page }) => {
    await zurKasse(page)

    const land = page.locator('select[name=country]')
    await expect(land).toHaveCount(1)
    const werte = await land
      .locator('option')
      .evaluateAll((o) => o.map((x) => (x as HTMLOptionElement).value))
    expect(werte).toEqual(['FR', 'DE', 'AT'])
    // Kein freies Textfeld mehr — genau das war die Ursache
    await expect(page.locator('input[name=country]')).toHaveCount(0)
  })

  /**
   * Der Wächter vor dem Abschicken.
   *
   * Ohne ihn bliebe der Browser an einem Pflichtfeld in einem versteckten
   * Schritt hängen: Er weigert sich abzuschicken, kann das Feld aber nicht
   * anspringen, und schreibt „not focusable" in eine Konsole, die niemand
   * offen hat. Für den Menschen davor wäre es ein Knopf, der nichts tut.
   */
  test('fehlt weiter vorn etwas, springt das Abschicken dorthin zurück', async ({ page }) => {
    const email = `luecke-${Date.now()}@example.test`
    await zurKasse(page, email)
    await bisVersand(page, email)

    await page.locator('input[name=paymentMethod][value=rechnung]').check()
    await page.getByRole('button', { name: 'Weiter' }).click()
    await page.fill('input[name=line1]', 'Musterweg 1')
    await page.fill('input[name=postalCode]', '95119')
    await page.fill('input[name=city]', 'Naila')
    await page.getByRole('button', { name: 'Weiter' }).click()
    await expect(stand(page)).toContainText('Schritt 4 von 4')

    // Zurück in die Anschrift und den Ort löschen
    await page.locator('ol[aria-label="Schritte"] button').nth(2).click()
    await page.fill('input[name=city]', '')
    await page.locator('ol[aria-label="Schritte"] button').nth(3).click()
    await expect(stand(page)).toContainText('Schritt 4 von 4')

    // Abschicken muss zur Lücke zurückführen, nicht stumm scheitern
    await page.locator('input[type=checkbox]').first().check()
    await page.getByRole('button', { name: 'Zahlungspflichtig bestellen' }).click()
    await expect(stand(page)).toContainText('Anschrift', { timeout: 10_000 })
  })
})

test.describe('Die Bestätigung an der Kasse', () => {
  test('eine unsinnige Adresse wird abgewiesen', async ({ request }) => {
    const antwort = await request.post('/api/kasse/pruefung', {
      data: { aktion: 'code-anfordern', email: 'kein-mailkonto' },
    })
    expect(antwort.status()).toBe(400)
  })

  test('ohne bekannte Aktion passiert nichts', async ({ request }) => {
    const antwort = await request.post('/api/kasse/pruefung', {
      data: { aktion: 'irgendwas', email: 'jemand@example.test' },
    })
    expect(antwort.status()).toBe(400)
  })

  /*
   * Ein Code, den es nie gab, ist „abgelaufen" — und nicht „falsch". Der
   * Unterschied ist Absicht: Sonst verriete die Antwort, ob zu dieser Adresse
   * gerade ein Code offen ist.
   */
  test('ein erfundener Code öffnet nichts', async ({ request }) => {
    const antwort = await request.post('/api/kasse/pruefung', {
      data: { aktion: 'bestaetigen', email: `niemand-${Date.now()}@example.test`, code: '123456' },
    })
    expect(antwort.status()).toBe(400)
    expect((await antwort.json()).error).toBe('abgelaufen')
    // Und vor allem: kein Sitzungscookie
    expect(antwort.headers()['set-cookie'] ?? '').not.toContain('vh-konto')
  })
})
