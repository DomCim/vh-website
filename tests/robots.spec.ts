import { expect, test } from '@playwright/test'

import robots from '../src/app/robots'

/**
 * Die Bilder der Artikel liegen unter `/api/media/file/…`, und `/api/` ist
 * gesperrt. Ohne die genauere Erlaubnis darüber ist damit jedes Produktfoto
 * für Google unsichtbar — aufgefallen ist das erst, als das Merchant Center
 * alle 19 Artikel beanstandete.
 *
 * Diese Prüfung steht hier, damit die Zeile nicht beim nächsten Aufräumen
 * wieder verschwindet: Sie sieht aus wie eine Ausnahme, die niemand braucht.
 */
test('robots.txt lässt die Bilder durch und sperrt den Rest der Schnittstelle', () => {
  const regeln = robots().rules
  const liste = Array.isArray(regeln) ? regeln : [regeln]

  for (const name of ['*', 'Googlebot', 'Googlebot-Image']) {
    const regel = liste.find((r) => r.userAgent === name)
    expect(regel, `Gruppe für ${name} fehlt`).toBeDefined()

    const erlaubt = [regel!.allow].flat()
    const gesperrt = [regel!.disallow].flat()

    expect(erlaubt, `${name} darf die Bilder nicht holen`).toContain('/api/media/')
    expect(gesperrt, `${name}: die Schnittstelle muss gesperrt bleiben`).toContain('/api/')
    expect(gesperrt, `${name}: die Verwaltung muss gesperrt bleiben`).toContain('/admin')
    // Der KI-Zugang liegt in der Wurzel und war deshalb als einziger offen
    expect(gesperrt, `${name}: der KI-Zugang muss gesperrt bleiben`).toContain('/mcp')
  }
})

/**
 * Das Büro gehört bewusst NICHT in die Sperrliste.
 *
 * Seine Seiten tragen `noindex`, und das ist die schärfere Ansage: Es hält
 * eine Adresse auch dann aus dem Bestand, wenn jemand von außen darauf
 * verlinkt. Wer nicht crawlen darf, liest das `noindex` nie — eine Sperre
 * hier bewirkte also das Gegenteil dessen, wonach sie aussieht.
 */
test('das Büro wird nicht gesperrt, sondern trägt noindex', () => {
  const regeln = robots().rules
  const liste = Array.isArray(regeln) ? regeln : [regeln]
  for (const regel of liste) {
    expect([regel.disallow].flat()).not.toContain('/office')
  }
})
