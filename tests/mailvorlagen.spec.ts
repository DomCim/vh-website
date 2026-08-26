import { expect, test } from '@playwright/test'

import {
  einsetzen,
  fehlendePflicht,
  gueltigeVorlage,
  VORLAGEN,
  vorlageBeschreibung,
} from '../src/lib/mailvorlagen'

/**
 * Die Mail-Vorlagen — Platzhalter, Pflichtfelder und der Rückfall.
 *
 * Der Kern dieser Datei ist das Sicherheitsnetz. „Ganze Mail frei" heißt, dass
 * jemand einen Platzhalter löschen kann, und meistens ist das gewollt: Nicht
 * jede Bestellung braucht den Fertigungshinweis. Bei manchen wäre es aber ein
 * stiller Schaden — eine Versandmail ohne Sendungsnummer, eine Rechnungsmail
 * ohne Betrag. Dann geht die eingebaute Fassung hinaus, und das muss belegt
 * sein.
 */

test.describe('Platzhalter einsetzen', () => {
  test('ersetzt, was da ist', () => {
    expect(einsetzen('Guten Tag {{kunde}},', { kunde: 'Stadt Naila' })).toBe(
      'Guten Tag Stadt Naila,',
    )
  })

  test('Leerzeichen und Großschreibung sind gleichgültig', () => {
    // Beim Tippen im Editor entstehen die schnell — daran soll es nicht scheitern
    const werte = { bestellnummer: 'VH-2026-0042' }
    expect(einsetzen('{{ bestellnummer }}', werte)).toBe('VH-2026-0042')
    expect(einsetzen('{{Bestellnummer}}', werte)).toBe('VH-2026-0042')
    expect(einsetzen('{{BESTELLNUMMER}}', werte)).toBe('VH-2026-0042')
  })

  test('was es nicht gibt, wird leer — kein stehengelassener Platzhalter', () => {
    /*
     * Ein `{{irgendwas}}` in der zugestellten Mail sieht nach kaputter
     * Software aus. Eine Lücke ist das kleinere Übel.
     */
    expect(einsetzen('A {{gibtesnicht}} B', {})).toBe('A  B')
  })

  test('setzt denselben Platzhalter mehrfach ein', () => {
    expect(einsetzen('{{nr}} und nochmal {{nr}}', { nr: '7' })).toBe('7 und nochmal 7')
  })

  test('Blöcke kommen als HTML durch, nicht als Text', () => {
    const html = '<table><tr><td>Sitzbank</td></tr></table>'
    expect(einsetzen('<p>Vorher</p>{{positionen}}', { positionen: html })).toContain('<table>')
  })
})

test.describe('Pflicht-Platzhalter', () => {
  test('erkennt einen fehlenden', () => {
    // Ohne {{sendung}} wäre die Versandmail ein Rückruf
    const fehlt = fehlendePflicht('versandt', '<p>Guten Tag {{kunde}}, Ihre {{bestellnummer}}.</p>')
    expect(fehlt).toContain('sendung')
  })

  test('meldet nichts, wenn alles da ist', () => {
    expect(
      fehlendePflicht('versandt', '{{kunde}} {{bestellnummer}} {{sendung}}'),
    ).toHaveLength(0)
  })

  test('freiwillige dürfen fehlen', () => {
    // Der Statuslink ist keine Pflicht — wer ihn weglässt, meint es so
    expect(fehlendePflicht('inFertigung', '{{bestellnummer}}')).toHaveLength(0)
  })

  test('eine unbekannte Art meldet nichts statt zu werfen', () => {
    expect(fehlendePflicht('gibt-es-nicht', 'egal')).toHaveLength(0)
  })
})

test.describe('Welche Vorlage gilt', () => {
  test('keine hinterlegt: die eingebaute Fassung', () => {
    expect(gueltigeVorlage('versandt', [])).toBeNull()
    expect(gueltigeVorlage('versandt', undefined)).toBeNull()
  })

  test('leerer Text zählt nicht als Vorlage', () => {
    expect(gueltigeVorlage('versandt', [{ art: 'versandt', inhalt: '   ' }])).toBeNull()
  })

  test('abgeschaltet: die eingebaute Fassung, der Text bleibt aber liegen', () => {
    const vorlagen = [{ art: 'versandt', aktiv: false, inhalt: '{{kunde}} {{bestellnummer}} {{sendung}}' }]
    expect(gueltigeVorlage('versandt', vorlagen)).toBeNull()
  })

  test('vollständig: die Vorlage gilt', () => {
    const inhalt = '<p>Hallo {{kunde}}, {{bestellnummer}} ist unterwegs. {{sendung}}</p>'
    expect(gueltigeVorlage('versandt', [{ art: 'versandt', inhalt }])).toBe(inhalt)
  })

  /**
   * Der eigentliche Riegel: Fehlt ein Pflichtfeld, wird die Vorlage abgewiesen
   * — und es wird gesagt, warum. Ein stiller Rückfall wäre nicht erklärbar:
   * Jemand ändert eine Vorlage, die Mail sieht aus wie vorher, und niemand
   * weiß weshalb.
   */
  test('unvollständig: eingebaute Fassung, mit Warnung', () => {
    const warnungen: string[] = []
    const inhalt = '<p>Hallo {{kunde}}, {{bestellnummer}} ist unterwegs.</p>'

    expect(gueltigeVorlage('versandt', [{ art: 'versandt', inhalt }], (t) => warnungen.push(t))).toBeNull()
    expect(warnungen).toHaveLength(1)
    expect(warnungen[0], 'die Warnung nennt den fehlenden Platzhalter').toContain('{{sendung}}')
  })
})

test.describe('Die Liste der Vorlagen', () => {
  test('jede Art kommt genau einmal vor', () => {
    const arten = VORLAGEN.map((v) => v.art)
    expect(new Set(arten).size, 'keine Art doppelt').toBe(arten.length)
  })

  test('jede hat Titel, Anlass und mindestens einen Platzhalter', () => {
    for (const v of VORLAGEN) {
      expect(v.titel.length, `${v.art} braucht einen Titel`).toBeGreaterThan(2)
      expect(v.anlass.length, `${v.art} braucht einen Anlass`).toBeGreaterThan(10)
      expect(v.platzhalter.length, `${v.art} braucht Platzhalter`).toBeGreaterThan(0)
    }
  })

  test('Platzhalternamen sind eindeutig und schlicht', () => {
    for (const v of VORLAGEN) {
      const namen = v.platzhalter.map((p) => p.name)
      expect(new Set(namen).size, `${v.art}: kein Name doppelt`).toBe(namen.length)
      for (const n of namen) {
        // Nur Buchstaben und Ziffern: Alles andere findet der Einsetzer nicht
        expect(n, `${v.art}: {{${n}}} ist einsetzbar`).toMatch(/^[a-zA-Z0-9_]+$/)
      }
    }
  })

  test('jede Kundenmail kann eine Grußformel tragen', () => {
    // Sonst könnte man den Gruß nicht ändern, ohne den ganzen Text zu ersetzen
    for (const v of VORLAGEN.filter((x) => x.anKundschaft)) {
      expect(
        v.platzhalter.some((p) => p.name === 'gruss'),
        `${v.art} braucht {{gruss}}`,
      ).toBe(true)
    }
  })

  test('nachschlagen findet, was es gibt — und sonst nichts', () => {
    expect(vorlageBeschreibung('versandt')?.titel).toBeTruthy()
    expect(vorlageBeschreibung('gibt-es-nicht')).toBeUndefined()
  })
})
