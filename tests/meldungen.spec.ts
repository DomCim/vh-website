import { expect, test } from '@playwright/test'

import { UEBERLAPPUNG_MS, neuerStand } from '../src/lib/bereiche'
import {
  istEntwurf,
  istFaellig,
  istKnapp,
  istNeueAnfrage,
  istNeuePost,
  istUeberfaellig,
  istZuZahlen,
  zuErledigen,
} from '../src/lib/zuErledigen'

/**
 * Der Stand des Abgleichs — und was die Zähler zählen.
 *
 * Beides hängt an demselben Vorfall: Eine Schlussrechnung wurde vorbereitet,
 * die Meldung kam aufs Handy, und in der Rechnungsliste stand nichts. Der
 * Entwurf lag in der Datenbank; das Gerät hatte sich nur einen Stand gemerkt,
 * der jünger war als der Datensatz, und fragte danach nie wieder nach ihm.
 */

const TAG = 24 * 3600 * 1000

test.describe('Stand des Abgleichs', () => {
  test('liegt eine Minute zurück, damit nichts durchs Fenster fällt', () => {
    const jetzt = '2026-08-21T06:00:00.000Z'
    const stand = neuerStand(jetzt, undefined, false)

    expect(new Date(jetzt).getTime() - new Date(stand).getTime()).toBe(UEBERLAPPUNG_MS)
  })

  test('bei vollem Paket zählt der letzte Datensatz, unverändert', () => {
    /*
     * Der Abzug darf hier nicht greifen: Beim Nachfassen fragt das Gerät mit
     * genau diesem Stand weiter. Zöge man ihn zurück, käme dieselbe Seite
     * wieder — und bei mehr als einem Paket in derselben Sekunde liefe das
     * Nachfassen im Kreis, statt vorwärtszukommen.
     */
    const letzter = '2026-08-21T05:59:30.000Z'
    expect(neuerStand('2026-08-21T06:00:00.000Z', letzter, true)).toBe(letzter)
  })

  test('volles Paket ohne Datensatz fällt auf den verminderten Zeitpunkt zurück', () => {
    const jetzt = '2026-08-21T06:00:00.000Z'
    expect(neuerStand(jetzt, undefined, true)).toBe(
      new Date(new Date(jetzt).getTime() - UEBERLAPPUNG_MS).toISOString(),
    )
  })

  test('der Entwurf aus dem Wettlauf kommt beim nächsten Mal mit', () => {
    /*
     * Nachgestellt: Der Entwurf wird um 06:00:00 geschrieben, festgeschrieben
     * ist er erst um 06:00:02. Das Gerät fragt dazwischen und bekommt nichts.
     *
     * Mit dem alten Stand (`jetzt`) wäre der Entwurf für immer weg — sein
     * `updatedAt` ist älter. Mit der Überlappung fragt das Gerät beim nächsten
     * Mal weit genug zurück.
     */
    const entwurfUpdatedAt = new Date('2026-08-21T06:00:00.000Z').getTime()
    const gemerkt = new Date(neuerStand('2026-08-21T06:00:01.000Z', undefined, false)).getTime()

    expect(gemerkt).toBeLessThan(entwurfUpdatedAt)
  })
})

test.describe('Was zu erledigen ist', () => {
  const jetzt = new Date('2026-08-21T08:00:00.000Z').getTime()

  test('ein Rechnungsentwurf zählt, eine bezahlte Rechnung nicht', () => {
    /*
     * Der Anlass für die Zähler: Ein Entwurf entsteht von selbst und bleibt
     * liegen, bis ihn jemand prüft und verschickt. Er ist Arbeit, keine
     * Rechnung — und ohne Zahl an der Navigation erfährt man von ihm nur aus
     * einer Meldung, die man vielleicht weggewischt hat.
     */
    expect(istEntwurf({ status: 'entwurf' })).toBe(true)
    expect(istEntwurf({ status: 'bezahlt' })).toBe(false)

    const zahlen = zuErledigen(
      {
        rechnungen: [
          { status: 'entwurf' },
          { status: 'bezahlt', dueDate: '2026-01-01' },
          { status: 'gestellt', dueDate: '2026-08-01' },
          { status: 'gestellt', dueDate: '2026-09-30' },
        ],
      },
      jetzt,
    )

    // Der Entwurf und die eine überfällige — die künftig fällige zählt nicht
    expect(zahlen['/office/rechnungen']).toBe(2)
  })

  test('überfällig ist nur, was gestellt wurde und eine Frist hat', () => {
    expect(istUeberfaellig({ status: 'gestellt', dueDate: '2026-08-01' }, jetzt)).toBe(true)
    expect(istUeberfaellig({ status: 'gestellt', dueDate: null }, jetzt)).toBe(false)
    expect(istUeberfaellig({ status: 'entwurf', dueDate: '2026-08-01' }, jetzt)).toBe(false)
    expect(istUeberfaellig({ status: 'bezahlt', dueDate: '2026-08-01' }, jetzt)).toBe(false)
  })

  test('Belege zählen drei Tage im Voraus — so lange vorher meldet auch das Handy', () => {
    const inZweiTagen = new Date(jetzt + 2 * TAG).toISOString()
    const inZehnTagen = new Date(jetzt + 10 * TAG).toISOString()

    expect(istZuZahlen({ paid: false, dueDate: inZweiTagen }, jetzt)).toBe(true)
    expect(istZuZahlen({ paid: false, dueDate: inZehnTagen }, jetzt)).toBe(false)
    expect(istZuZahlen({ paid: true, dueDate: inZweiTagen }, jetzt)).toBe(false)
    expect(istZuZahlen({ paid: false, dueDate: null }, jetzt)).toBe(false)
  })

  test('knapp ist nur, wofür ein Mindestbestand hinterlegt ist', () => {
    expect(istKnapp({ quantity: 2, minQuantity: 5 })).toBe(true)
    expect(istKnapp({ quantity: 5, minQuantity: 5 })).toBe(false)
    // Ohne Mindestbestand gibt es nichts zu unterschreiten — sonst zählte
    // jedes Teil mit Bestand 0, das nie nachbestellt werden soll.
    expect(istKnapp({ quantity: 0 })).toBe(false)
  })

  test('Wiedervorlagen werden auf den Tag verglichen, nicht auf die Minute', () => {
    // Heute um 23:00 fällig, jetzt ist 08:00 — der Tag ist da, also zählt sie
    expect(istFaellig({ done: false, dueDate: '2026-08-21T23:00:00.000Z' }, jetzt)).toBe(true)
    expect(istFaellig({ done: false, dueDate: '2026-08-22T00:00:00.000Z' }, jetzt)).toBe(false)
    expect(istFaellig({ done: true, dueDate: '2026-08-01' }, jetzt)).toBe(false)
  })

  test('neue Anfragen zählen, angefasste nicht', () => {
    expect(istNeueAnfrage({ status: 'neu' })).toBe(true)
    expect(istNeueAnfrage({ status: 'beantwortet' })).toBe(false)
  })

  test('was null wäre, steht gar nicht erst da', () => {
    /*
     * Ein Zähler mit 0 ist kein Zähler, sondern ein Fleck. Die Navigation
     * fragt `zahlen[href] ?? 0` — fehlt der Eintrag, erscheint nichts.
     */
    const zahlen = zuErledigen({ anfragen: [{ status: 'beantwortet' }] }, jetzt)
    expect(zahlen['/office/anfragen']).toBeUndefined()
    expect(Object.keys(zahlen)).toHaveLength(0)
  })

  test('ein leerer Bestand wirft nicht — das Gerät ist beim ersten Start leer', () => {
    expect(zuErledigen({}, jetzt)).toEqual({})
  })

  test('jede Zahl hängt an einem Ziel, das es in der Navigation gibt', () => {
    const zahlen = zuErledigen(
      {
        anfragen: [{ status: 'neu' }],
        rechnungen: [{ status: 'entwurf' }],
        belege: [{ paid: false, dueDate: new Date(jetzt).toISOString() }],
        inventar: [{ quantity: 0, minQuantity: 1 }],
        wiedervorlagen: [{ done: false, dueDate: '2026-08-01' }],
      },
      jetzt,
    )

    expect(Object.keys(zahlen).sort()).toEqual([
      '/office/anfragen',
      '/office/belege',
      '/office/nachbestellen',
      '/office/rechnungen',
      '/office/wiedervorlagen',
    ])
    expect(Object.values(zahlen).every((n) => n === 1)).toBe(true)
  })
})

test('neue Post zählt an der Navigation, solange sie ungelesen ist', () => {
  /*
   * Die Zahl der Mails liegt beim Anbieter, nicht im Gerät — gezählt wird
   * deshalb, was im Gerät liegt: die Meldung des Wartungslaufs. Sie steht für
   * „da ist etwas, das du noch nicht angesehen hast".
   */
  expect(istNeuePost({ tag: 'post-1', gelesen: false })).toBe(true)
  expect(istNeuePost({ tag: 'post-1', gelesen: true })).toBe(false)
  // Andere Meldungen zählen woanders — eine überfällige Rechnung ist keine Post
  expect(istNeuePost({ tag: 'rechnung-12', gelesen: false })).toBe(false)
  expect(istNeuePost({ gelesen: false })).toBe(false)

  const zahlen = zuErledigen({
    meldungen: [
      { tag: 'post-1', gelesen: false },
      { tag: 'post-2', gelesen: false },
      { tag: 'post-1', gelesen: true },
      { tag: 'mahnung-3', gelesen: false },
    ],
  })
  expect(zahlen['/office/post']).toBe(2)

  // Nichts Ungelesenes, kein Zähler — eine Null an der Navigation wäre Lärm
  expect(zuErledigen({ meldungen: [{ tag: 'post-1', gelesen: true }] })['/office/post']).toBeUndefined()
})
