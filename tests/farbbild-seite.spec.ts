import { expect, test } from '@playwright/test'

const BASIS = process.env.TEST_BASE_URL ?? 'http://localhost:3000'

/**
 * Der Klick auf eine Farbe wechselt das Bild — im Browser nachgesehen.
 *
 * Die Regeln selbst stehen in `artikelbilder.spec.ts` und laufen ohne Server.
 * Hier geht es um die Naht dahinter: dass die Kennungen aus der Datenbank
 * wirklich bis in die Anzeige kommen und der Griff dort greift. Genau dort
 * wäre ein Fehler still — die Seite sähe heil aus und zeigte trotzdem das
 * falsche Stück.
 *
 * Braucht einen laufenden Server samt Datenbank. Ohne hinterlegtes Farbbild
 * gibt es nichts zu prüfen, dann überspringt die Prüfung sich selbst und sagt
 * auch, warum — eine stillschweigend übergangene Prüfung sieht im Bericht aus
 * wie eine bestandene.
 */
test.describe('Farbe und Bild auf der Artikelseite', () => {
  test('Der Klick auf eine Farbe mit eigenem Bild wechselt die Ansicht', async ({
    page,
    request,
  }) => {
    // Einen Artikel suchen, bei dem eine Farbe ein Bild mitbringt
    const antwort = await request.get(
      `${BASIS}/api/products?depth=1&limit=100&locale=de`,
    )
    test.skip(!antwort.ok(), 'Artikel nicht abrufbar — läuft der Server?')
    const { docs } = (await antwort.json()) as {
      docs: {
        slug?: string
        category?: { slug?: string } | number
        colorOptions?: { image?: number | { id?: number } | null }[]
      }[]
    }

    const artikel = docs.find((d) =>
      (d.colorOptions ?? []).some((c) => c.image !== null && c.image !== undefined),
    )
    test.skip(
      !artikel,
      'Kein Artikel mit hinterlegtem Farbbild — unter Artikel eine Farbe mit Bild versehen',
    )

    const kategorie =
      typeof artikel!.category === 'object' && artikel!.category
        ? artikel!.category.slug
        : undefined
    test.skip(!kategorie || !artikel!.slug, 'Artikel ohne Adresse')

    await page.goto(`${BASIS}/de/${kategorie}/${artikel!.slug}`)

    const grossesBild = page.locator('img[sizes*="55vw"]').first()
    await expect(grossesBild).toBeVisible()
    const vorher = await grossesBild.getAttribute('src')

    // Die Farbpunkte sind runde Knöpfe mit dem Farbnamen im Titel
    const stelle = (artikel!.colorOptions ?? []).findIndex(
      (c) => c.image !== null && c.image !== undefined,
    )
    const farbknopf = page.locator('button.rounded-full').nth(stelle)
    await expect(farbknopf).toBeVisible()
    await farbknopf.click()

    /*
     * Das Bild muss ein anderes sein.
     *
     * Nicht auf eine bestimmte Adresse geprüft: Welches Bild hinterlegt ist,
     * entscheidet der Betrieb, und eine Prüfung, die eine Datei beim Namen
     * nennt, bricht beim ersten Austausch der Aufnahme.
     */
    await expect(grossesBild).not.toHaveAttribute('src', vorher ?? '')
  })

  test('Eine Farbe ohne eigenes Bild lässt die Ansicht stehen', async ({
    page,
    request,
  }) => {
    const antwort = await request.get(
      `${BASIS}/api/products?depth=1&limit=100&locale=de`,
    )
    test.skip(!antwort.ok(), 'Artikel nicht abrufbar — läuft der Server?')
    const { docs } = (await antwort.json()) as {
      docs: {
        slug?: string
        category?: { slug?: string } | number
        colorOptions?: { image?: number | { id?: number } | null }[]
      }[]
    }

    // Ein Artikel mit mehreren Farben, von denen mindestens eine leer ist
    const artikel = docs.find(
      (d) =>
        (d.colorOptions ?? []).length > 1 &&
        (d.colorOptions ?? []).some((c) => c.image === null || c.image === undefined),
    )
    test.skip(!artikel, 'Kein Artikel mit einer Farbe ohne Bild')

    const kategorie =
      typeof artikel!.category === 'object' && artikel!.category
        ? artikel!.category.slug
        : undefined
    test.skip(!kategorie || !artikel!.slug, 'Artikel ohne Adresse')

    await page.goto(`${BASIS}/de/${kategorie}/${artikel!.slug}`)

    const grossesBild = page.locator('img[sizes*="55vw"]').first()
    await expect(grossesBild).toBeVisible()
    const vorher = await grossesBild.getAttribute('src')

    const stelle = (artikel!.colorOptions ?? []).findIndex(
      (c) => c.image === null || c.image === undefined,
    )
    const farbknopf = page.locator('button.rounded-full').nth(stelle)
    await expect(farbknopf).toBeVisible()
    await farbknopf.click()

    // Unverändert: nicht auf Bild 0 zurückgesprungen
    await expect(grossesBild).toHaveAttribute('src', vorher ?? '')
  })
})
