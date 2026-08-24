import { expect, test } from '@playwright/test'

import {
  bildGueltig,
  bildLink,
  bildSignatur,
  fehlermeldungsKoerper,
  fehlermeldungsTitel,
  MELDUNGSARTEN,
  meldungsKennzeichen,
  istBild,
  repoZerlegen,
} from '../src/lib/fehlermeldung'

/**
 * Was aus einer Meldung wird — ohne GitHub prüfbar.
 *
 * Zwei Dinge sind hier teuer, wenn sie schiefgehen. Das Repository wandert
 * ungeprüft in eine Adresse bei GitHub, wenn es niemand zerlegt; und der
 * unterschriebene Bildlink ist die einzige Schranke vor einer geschützten
 * Dateiablage.
 */

test.beforeEach(() => {
  process.env.PAYLOAD_SECRET = 'nur-fuer-die-pruefung'
})

test('das Repository wird streng zerlegt', () => {
  expect(repoZerlegen('DomCim/vh-website')).toEqual({ besitzer: 'DomCim', name: 'vh-website' })
  expect(repoZerlegen('  DomCim/vh-website  ')).toEqual({ besitzer: 'DomCim', name: 'vh-website' })

  // Wer die Adresse aus dem Browser kopiert, soll nicht scheitern
  expect(repoZerlegen('https://github.com/DomCim/vh-website')).toEqual({
    besitzer: 'DomCim',
    name: 'vh-website',
  })
  expect(repoZerlegen('https://github.com/DomCim/vh-website.git')).toEqual({
    besitzer: 'DomCim',
    name: 'vh-website',
  })
})

test('was in einer Adresse nichts zu suchen hat, fällt durch', () => {
  for (const unsinn of [
    '',
    '   ',
    'vh-website',
    'DomCim/vh-website/issues',
    'DomCim/',
    '/vh-website',
    'Dom Cim/vh-website',
    'DomCim/../../etc',
    'DomCim/vh?a=1',
    null,
    undefined,
  ]) {
    expect(repoZerlegen(unsinn), String(unsinn)).toBeNull()
  }
})

test('nur Bilder gelten als Foto', () => {
  expect(istBild('image/png')).toBe(true)
  expect(istBild('IMAGE/JPEG')).toBe(true)
  expect(istBild('application/pdf')).toBe(false)
  expect(istBild('image/svg+xml')).toBe(false) // SVG kann Skript enthalten
  expect(istBild(null)).toBe(false)
})

test('der Bildlink trägt seine Berechtigung selbst', () => {
  expect(bildGueltig(42, bildSignatur(42))).toBe(true)

  // Wer die Nummer hochzählt, kommt keinen Schritt weiter
  expect(bildGueltig(43, bildSignatur(42))).toBe(false)
  expect(bildGueltig(42, '')).toBe(false)
  expect(bildGueltig(42, 'x'.repeat(43))).toBe(false)
  expect(bildGueltig('', bildSignatur(''))).toBe(false)
})

test('der Bildlink ist vollständig', () => {
  process.env.NEXT_PUBLIC_SERVER_URL = 'https://vincent-hellmann.com/'
  const link = bildLink(7)
  expect(link.startsWith('https://vincent-hellmann.com/api/fehlermeldung/bild?datei=7&sig=')).toBe(
    true,
  )
  // Kein doppelter Schrägstrich, wenn die Adresse mit einem endet
  expect(link).not.toContain('.com//')
})

test('der Text stellt die Beschreibung nach vorn und die Umgebung nach hinten', () => {
  const koerper = fehlermeldungsKoerper({
    text: 'Beim Speichern passiert nichts.',
    umgebung: { seite: '/office/inventar/neu', fassung: 'abc1234', melder: 'Vincent' },
    bilder: ['https://example.test/a.png'],
  })

  expect(koerper.indexOf('Beim Speichern')).toBeLessThan(koerper.indexOf('![Foto 1]'))
  expect(koerper.indexOf('![Foto 1]')).toBeLessThan(koerper.indexOf('<details>'))
  expect(koerper).toContain('| Seite | /office/inventar/neu |')
  expect(koerper).toContain('| Gemeldet von | Vincent |')
  // Was nicht angegeben ist, steht auch nicht als leere Zeile da
  expect(koerper).not.toContain('| Gerät |')
})

test('ein Strich in der Umgebung sprengt die Tabelle nicht', () => {
  // Die Browserkennung enthält gelegentlich einen senkrechten Strich, und der
  // ist in einer Markdown-Tabelle das Spaltentrennzeichen.
  const koerper = fehlermeldungsKoerper({
    text: 'x',
    umgebung: { geraet: 'Safari | iOS 18\nZweite Zeile' },
  })
  expect(koerper).toContain('| Gerät | Safari \\| iOS 18 Zweite Zeile |')
})

test('ohne Beschreibung entsteht kein leerer Eintrag', () => {
  const koerper = fehlermeldungsKoerper({ text: '   ' })
  expect(koerper).toContain('_Ohne Beschreibung gemeldet._')
})

test('der Titel fällt auf den Ort zurück', () => {
  expect(fehlermeldungsTitel('  Komma   geht nicht ')).toBe('Komma geht nicht')
  expect(fehlermeldungsTitel('', '/office/inventar')).toBe('Meldung aus /office/inventar')
  expect(fehlermeldungsTitel('', null)).toBe('Meldung aus dem Büro')
  expect(fehlermeldungsTitel('x'.repeat(200)).length).toBe(120)
})

/**
 * Die Kennzeichen — damit eine Liste aus fünfzig Meldungen sortierbar bleibt.
 *
 * Angefangen hat es mit fünf Meldungen an einem Morgen, alle gleich aussehend.
 * Zwei davon betrafen dieselbe Sache aus zwei Fassungen, und das fiel nur auf,
 * weil es jemand zufällig noch wusste.
 */
test('die Art wird zum Kennzeichen, die Fassung auch', () => {
  const k = meldungsKennzeichen('idee', 'ded8415')
  expect(k).toContain('enhancement')
  expect(k).toContain('büro')
  // Der eigentliche Gewinn: Man sieht in der Liste, aus welchem Stand es kommt
  expect(k).toContain('Fassung ded8415')
})

test('ohne Art gilt „Fehler" — das ist der häufige Fall', () => {
  expect(meldungsKennzeichen(null, null)).toContain('bug')
  expect(meldungsKennzeichen('unfug', null)).toContain('bug')
})

test('nur eine plausible Fassung wird zum Kennzeichen', () => {
  /*
   * Lokal steht dort „Entwicklungs-Version"; daraus ein Kennzeichen zu machen
   * hieße, die Liste mit Müll zu füllen, den niemand wieder wegbekommt.
   */
  expect(meldungsKennzeichen('fehler', 'Entwicklungs-Version')).toEqual(['büro', 'bug'])
  expect(meldungsKennzeichen('fehler', '')).toEqual(['büro', 'bug'])
  // Ein langer Hash wird auf die gewohnten sieben Zeichen gekürzt
  expect(meldungsKennzeichen('fehler', 'ded8415f340c489bd42a')).toContain('Fassung ded8415')
})

test('jede Art im Formular hat ein Kennzeichen', () => {
  // Eine Art ohne Kennzeichen fiele stumm auf „bug" zurück
  for (const a of MELDUNGSARTEN) {
    expect(meldungsKennzeichen(a.wert, null), `„${a.text}" fehlt das Kennzeichen`).toContain(
      a.kennzeichen,
    )
  }
})
