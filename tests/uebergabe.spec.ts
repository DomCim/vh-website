import { expect, test } from '@playwright/test'

import { dateiName, endungErlaubt } from '../src/lib/dateigrenzen'
import {
  fuerKunden,
  gueltigBis,
  mappenSitzung,
  mappenSitzungLesen,
  mappenTitel,
  ordnerName,
  passwortErzeugen,
  passwortStimmt,
  passwortVerwahren,
  tokenErzeugen,
  zugangGueltig,
} from '../src/lib/uebergabe'

/**
 * Die Regeln hinter der Übergabemappe — ohne Server, ohne Datenbank.
 *
 * Es sind die Stellen, an denen ein Fehler nicht auffällt, sondern wirkt:
 * ein Passwort, das auch falsch stimmt; ein Zugang, der nach Ablauf noch
 * gilt; eine Hausdatei, die beim Kunden landet, ohne freigegeben zu sein;
 * ein Dateiname, der zu einem Pfad wird.
 */

test.describe('Passwort', () => {
  test('stimmt nur mit sich selbst — und ist gegen Groß/Klein tolerant', () => {
    const passwort = passwortErzeugen()
    const verwahrt = passwortVerwahren(passwort)

    expect(verwahrt).not.toContain(passwort)
    expect(passwortStimmt(passwort, verwahrt)).toBe(true)
    // Am Telefon durchgesagt und klein getippt — das darf kein Hindernis sein
    expect(passwortStimmt(passwort.toLowerCase(), verwahrt)).toBe(true)
    expect(passwortStimmt(` ${passwort} `, verwahrt)).toBe(true)
    expect(passwortStimmt(`${passwort}X`, verwahrt)).toBe(false)
    expect(passwortStimmt(passwort, null)).toBe(false)
    expect(passwortStimmt(passwort, 'kaputt')).toBe(false)
  })

  test('enthält keine Zeichen, die man am Telefon verwechselt', () => {
    for (let i = 0; i < 200; i++) {
      expect(passwortErzeugen()).not.toMatch(/[IlO01]/)
    }
  })

  test('zwei Passwörter sind nie dasselbe', () => {
    const gesehen = new Set(Array.from({ length: 500 }, () => passwortErzeugen()))
    expect(gesehen.size).toBe(500)
  })

  test('derselbe Klartext ergibt zweimal einen anderen Abdruck', () => {
    // Ohne eigenes Salz verriete die Datenbank, welche Mappen dasselbe
    // Passwort tragen
    expect(passwortVerwahren('ABCD2345')).not.toBe(passwortVerwahren('ABCD2345'))
  })
})

test.describe('Zugang', () => {
  test('gilt, bis er abläuft oder zurückgezogen wird', () => {
    const token = tokenErzeugen()
    expect(zugangGueltig({ token, gueltigBis: gueltigBis() })).toBe(true)
    expect(zugangGueltig({ token, gueltigBis: gueltigBis(-1) })).toBe(false)
    expect(zugangGueltig({ token, gueltigBis: gueltigBis(), zurueckgezogen: true })).toBe(false)
    expect(zugangGueltig({ gueltigBis: gueltigBis() })).toBe(false)
    expect(zugangGueltig(null)).toBe(false)
  })

  test('läuft nach sieben Tagen ab', () => {
    const tage = (new Date(gueltigBis()).getTime() - Date.now()) / 86400_000
    expect(tage).toBeGreaterThan(6.9)
    expect(tage).toBeLessThan(7.1)
  })
})

test.describe('Sitzung', () => {
  test('gilt für genau eine Mappe und nur mit gültiger Unterschrift', () => {
    const token = tokenErzeugen()
    const keks = mappenSitzung(token, gueltigBis())
    expect(mappenSitzungLesen(keks.wert)).toBe(token)

    // Eine gefälschte Unterschrift darf nichts öffnen
    const [teil] = keks.wert.split('.')
    expect(mappenSitzungLesen(`${teil}.${'0'.repeat(64)}`)).toBe(null)
    expect(mappenSitzungLesen(undefined)).toBe(null)
    expect(mappenSitzungLesen('unfug')).toBe(null)
  })

  test('lebt nie länger als der Zugang selbst', () => {
    const bald = new Date(Date.now() + 3600_000).toISOString()
    const keks = mappenSitzung(tokenErzeugen(), bald)
    expect(keks.maxAge).toBeLessThanOrEqual(3600)
  })

  test('ein abgelaufenes Cookie öffnet nichts mehr', () => {
    const keks = mappenSitzung(tokenErzeugen(), new Date(Date.now() - 1000).toISOString())
    expect(mappenSitzungLesen(keks.wert)).toBe(null)
  })
})

test.describe('Wer welche Datei sieht', () => {
  test('eigene immer, fremde nur nach Freigabe', () => {
    expect(fuerKunden({ herkunft: 'kunde', freigabe: false })).toBe(true)
    expect(fuerKunden({ herkunft: 'haus', freigabe: true })).toBe(true)
    // Der Fall, auf den es ankommt: im Haus entstanden, nicht freigegeben
    expect(fuerKunden({ herkunft: 'haus', freigabe: false })).toBe(false)
    expect(fuerKunden({ herkunft: 'haus' })).toBe(false)
    expect(fuerKunden({})).toBe(false)
    expect(fuerKunden(null)).toBe(false)
  })
})

test.describe('Namen', () => {
  test('ein Dateiname wird nie zu einem Pfad', () => {
    expect(dateiName('../../etc/passwd')).toBe('passwd')
    expect(dateiName('..\\..\\windows\\system32\\cmd.exe')).toBe('cmd.exe')
    expect(dateiName('.bashrc')).toBe('bashrc')
    expect(dateiName('zuschnitt.dxf')).toBe('zuschnitt.dxf')
    expect(dateiName('Träger links (2).step')).toBe('Träger links (2).step')
    expect(dateiName('teil#1?.dxf')).toBe('teil_1_.dxf')
    expect(dateiName('')).toBe('')
  })

  test('ein Ordnername taugt als Name in einer Liste', () => {
    expect(ordnerName(' Zeichnungen/Alt ')).toBe('Zeichnungen Alt')
    expect(ordnerName('a'.repeat(200))).toHaveLength(60)
  })

  test('nur brauchbare Dateitypen kommen durch', () => {
    for (const gut of ['teil.dxf', 'Baugruppe.STEP', 'plan.pdf', 'archiv.zip', 'foto.JPG']) {
      expect(endungErlaubt(gut)).toBe(true)
    }
    // Vom Browser ausführbar oder ausführbar überhaupt — beides bleibt draußen
    for (const schlecht of ['virus.exe', 'seite.html', 'zeichnung.svg', 'skript.sh', 'ohneendung']) {
      expect(endungErlaubt(schlecht)).toBe(false)
    }
  })

  test('eine Mappe ohne eingetippten Namen heißt nach ihrem Bezug', () => {
    expect(mappenTitel({ kontakt: 'Metallbau Meier' })).toBe('Metallbau Meier')
    expect(mappenTitel({ kontakt: 'Meier', anfrage: 42 })).toBe('Meier · Anfrage 42')
    expect(mappenTitel({})).toBe('Übergabemappe')
  })
})
