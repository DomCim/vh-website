import { expect, test } from '@playwright/test'

/**
 * Was in eine Suchmaschine gehört — und was nicht.
 *
 * Anlass war eine Frage von Dominik (08/2026): „Wird das auch von Google
 * indexiert?", mit dem Link auf eine Übergabemappe. Die Antwort war ja, aber
 * nur wegen eines `<meta name="robots">` im HTML — und ein Meta-Tag wird nur
 * gelesen, wenn jemand HTML auswertet. Eine PDF-Antwort, ein Bild, eine
 * JSON-Auskunft haben keines.
 *
 * Seither trägt jede dieser Adressen zusätzlich die Kopfzeile
 * `X-Robots-Tag`, die unabhängig vom Inhaltstyp gilt.
 *
 * **Und was ausdrücklich indexierbar bleibt.** Die Gegenprobe ist der
 * wichtigere Teil dieser Datei: `/api/media/` steht in der robots.txt als
 * erlaubt, weil dort die Produktbilder liegen. Ein pauschaler Kopf über
 * `/api/` nähme sie aus der Bildersuche, ohne dass es jemandem auffiele — der
 * Laden verlöre einen Weg, auf dem Kundschaft ihn findet, und niemand wüsste
 * warum.
 *
 * **Warum das nicht in die robots.txt gehört:** Ein `Disallow` verbietet das
 * Abrufen, und dann liest Google das noindex nie. Eine Adresse, die es
 * anderswo aufschnappt, könnte danach als nackte URL im Ergebnis stehen.
 * Erlaubt abrufen plus noindex ist der sichere Weg.
 */

const BASIS = process.env.TEST_BASE_URL ?? 'http://localhost:3000'

const VERTRAULICH = [
  ['/de/uebergabe/ABC123', 'Übergabemappe — der Link liegt in einer Mail'],
  ['/de/konto', 'Kundenbereich'],
  ['/de/bestellung/danke', 'nach dem Kauf, mit der Bestellnummer darauf'],
  ['/office', 'das Büro'],
  ['/office/artikel', 'eine Seite im Büro'],
  ['/api/checkout', 'eine Schnittstelle'],
]

const OEFFENTLICH = [
  ['/de', 'die Startseite'],
  ['/api/media/file/beispiel.jpg', 'ein Produktbild — gehört in die Bildersuche'],
  ['/sitemap.xml', 'die Sitemap selbst'],
]

test.describe('Suchindex', () => {
  for (const [pfad, was] of VERTRAULICH) {
    test(`${pfad} bleibt draußen (${was})`, async ({ request }) => {
      const antwort = await request.get(`${BASIS}${pfad}`, { maxRedirects: 0 })
      expect(antwort.headers()['x-robots-tag'] ?? '').toContain('noindex')
    })
  }

  for (const [pfad, was] of OEFFENTLICH) {
    test(`${pfad} bleibt auffindbar (${was})`, async ({ request }) => {
      const antwort = await request.get(`${BASIS}${pfad}`, { maxRedirects: 0 })
      expect(antwort.headers()['x-robots-tag'] ?? '').not.toContain('noindex')
    })
  }

  test('die robots.txt sperrt die Übergabe nicht aus', async ({ request }) => {
    /*
     * Das sieht nach einer Lücke aus und ist die Absicht: Gesperrt könnte
     * Google die Seite nicht abrufen und das noindex nicht lesen.
     */
    const text = await (await request.get(`${BASIS}/robots.txt`)).text()
    expect(text).not.toContain('Disallow: /uebergabe')
    // Die Bilder bleiben ausdrücklich erlaubt
    expect(text).toContain('Allow: /api/media/')
  })
})
