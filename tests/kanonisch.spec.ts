import { expect, test } from '@playwright/test'

const BASIS = process.env.TEST_BASE_URL ?? 'http://localhost:3000'

/**
 * Jede Seite muss sich selbst als kanonisch ausweisen.
 *
 * Der Anlass war eine Meldung der Search Console: „Duplikat — Google hat eine
 * andere Seite als der Nutzer als kanonische Seite bestimmt". Dahinter steckte
 * kein Rätsel, sondern eine Eigenheit von Next: Metadaten werden von oben nach
 * unten durchgereicht. Im Sprach-Layout steht `alternates: alternatesFor(locale, '')`,
 * also die Startseite — und jede Unterseite, die nichts Eigenes angibt, erbt
 * das. `/de/kontakt`, `/de/news` und `/de/aktionen` trugen dadurch
 * `rel=canonical` auf `/de`, dazu Titel und Beschreibung der Startseite. Sie
 * standen in der Sitemap und erklärten im selben Atemzug, sie seien eine
 * andere Seite. Neun Adressen, die nie in den Index kamen.
 *
 * Auffallen konnte das niemandem: Die Seiten sahen richtig aus, antworteten
 * mit 200 und waren im Browser nicht von einer gesunden Seite zu
 * unterscheiden. Deshalb steht die Prüfung hier und nicht im Kopf von
 * jemandem, der beim nächsten Mal daran denken soll.
 */
test('was in der Sitemap steht, weist sich selbst als kanonisch aus', async ({ request }) => {
  const karte = await request.get(`${BASIS}/sitemap.xml`)
  expect(karte.ok()).toBeTruthy()
  const adressen = [...(await karte.text()).matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1])
  expect(adressen.length, 'die Sitemap ist nicht leer').toBeGreaterThan(0)

  const falsch: string[] = []
  for (const adresse of adressen) {
    const seite = await request.get(adresse)
    if (!seite.ok()) {
      falsch.push(`${adresse} antwortet mit ${seite.status()}`)
      continue
    }
    const html = await seite.text()
    const eigen = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1]
    // Die Sitemap sagt „nimm mich auf", ein fremdes canonical sagt „nimm die
    // andere" — zusammen heißt das: gar nicht aufgenommen.
    if (eigen !== adresse) falsch.push(`${adresse} zeigt auf ${eigen ?? 'nichts'}`)
    if (/content="noindex/.test(html)) falsch.push(`${adresse} trägt noindex und steht doch drin`)
  }

  expect(falsch, falsch.join('\n')).toEqual([])
})

/**
 * Und umgekehrt: Warenkorb und Kasse gehören nicht in den Index.
 *
 * Sie stehen zwar nicht in der Sitemap, sind aber verlinkt und damit
 * auffindbar — drei Sprachen derselben dünnen Seite, die ohne eigene Angabe
 * ebenfalls auf die Startseite zeigten.
 */
for (const pfad of ['/de/warenkorb', '/de/kasse', '/de/newsletter']) {
  test(`${pfad} bleibt aus dem Index`, async ({ request }) => {
    const seite = await request.get(`${BASIS}${pfad}`)
    expect(seite.ok()).toBeTruthy()
    expect(await seite.text()).toContain('content="noindex')
  })
}

/**
 * Ein Artikel gehört zu einer Kategorie — und ist nur dort erreichbar.
 *
 * Bis 08/2026 prüfte die Artikelseite zwei Dinge: Gibt es die Kategorie? Gibt
 * es den Artikel? Nie aber, ob beide zusammengehören. Damit war jeder Artikel
 * unter jedem Kategoriepfad erreichbar — der Gartensessel also auch unter
 * `/de/maschinenbau/…`, mit „Maschinenbau" im Brotkrumen-Pfad. Bei vierzehn
 * Kategorien ist das die vierzehnfache Zahl an Adressen für dieselbe Seite.
 *
 * Aufgefallen ist es nie, weil `rel=canonical` seit jeher auf die richtige
 * Adresse zeigte: Google räumte still hinter uns auf, und die Meldung
 * „Duplikat" war der einzige Hinweis. Jetzt wird dauerhaft umgeleitet — alte
 * Verweise bleiben gültig, aber es gibt nur noch eine Adresse.
 */
test('ein Artikel unter fremder Kategorie leitet auf seine eigene um', async ({ request }) => {
  const karte = await request.get(`${BASIS}/sitemap.xml`)
  const adressen = [...(await karte.text()).matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1])
  const nachLocale = (u: string) => u.replace(`${BASIS}/de`, '')

  const artikel = adressen.find((u) => u.startsWith(`${BASIS}/de/`) && nachLocale(u).split('/').length === 3)
  const kategorien = adressen.filter(
    (u) => u.startsWith(`${BASIS}/de/`) && nachLocale(u).split('/').length === 2,
  )
  test.skip(!artikel || kategorien.length < 2, 'Ohne Artikel in zwei Kategorien nicht prüfbar')

  const [, eigene, artikelSlug] = nachLocale(artikel!).split('/')
  const fremde = kategorien
    .map((u) => nachLocale(u).slice(1))
    .find((k) => k !== eigene && !k.includes('/'))
  test.skip(!fremde, 'Es gibt nur eine Kategorie')

  const antwort = await request.get(`${BASIS}/de/${fremde}/${artikelSlug}`, {
    maxRedirects: 0,
  })
  // Dauerhaft, nicht vorübergehend: Google soll die Falschadresse aufgeben.
  expect([301, 308]).toContain(antwort.status())
  expect(antwort.headers()['location']).toContain(`/de/${eigene}/${artikelSlug}`)
})
