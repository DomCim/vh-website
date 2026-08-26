import { expect, test } from '@playwright/test'

import {
  bildKennung,
  bildStelleAnfang,
  type Galeriebild,
  galerieErgaenzen,
  stelleFuer,
} from '../src/lib/artikelbilder'

/**
 * Welches Bild eine Farbe zeigt — festgenagelt.
 *
 * Der Anlass: Wer auf „Rubinrot" tippte, sah weiter das anthrazitfarbene Bild.
 * Die Regeln, die das richten, sind klein, aber jede einzelne hat einen Fall
 * dahinter, in dem die naheliegende Umsetzung falsch gewesen wäre — vor allem
 * die beiden Rückfälle: nichts tun ist besser, als auf das erste Bild zu
 * springen.
 *
 * Reine Funktionen, kein Browser, kein Server.
 */

const BILDER = [
  { id: 25, url: '/anthrazit.jpg', alt: 'Herz anthrazit' },
  { id: 26, url: '/rot.jpg', alt: 'Herz rot' },
  { id: 27, url: '/gruen.jpg', alt: 'Herz grün' },
]

test('Die Kennung kommt aus der Zahl, dem Text und dem geladenen Objekt', () => {
  expect(bildKennung(26)).toBe(26)
  expect(bildKennung('26')).toBe('26')
  expect(bildKennung({ id: 26 })).toBe(26)
})

test('Kein Bild hinterlegt heißt keine Kennung', () => {
  expect(bildKennung(null)).toBeNull()
  expect(bildKennung(undefined)).toBeNull()
  expect(bildKennung({})).toBeNull()
})

test('Die Farbe findet ihr Bild in der Galerie', () => {
  expect(stelleFuer(26, BILDER)).toBe(1)
  expect(stelleFuer(27, BILDER)).toBe(2)
})

test('Zahl und Text meinen dasselbe Bild', () => {
  // Payload gibt Kennungen je nach Weg als Zahl oder als Text heraus — an
  // dieser Naht wäre ein stiller Fehlschlag besonders unangenehm
  expect(stelleFuer('26', BILDER)).toBe(1)
})

test('Eine Farbe ohne Bild lässt die Galerie stehen', () => {
  // Nicht 0: Wer eine Größe wählt, soll nicht die Ansicht verlieren, die er
  // sich gerade ausgesucht hat
  expect(stelleFuer(null, BILDER)).toBeNull()
})

test('Ein Bild, das die Galerie nicht führt, lässt sie ebenfalls stehen', () => {
  expect(stelleFuer(99, BILDER)).toBeNull()
})

/*
 * Beim Laden entscheidet die Variante — und das ist die Umkehrung dessen, was
 * hier zuerst stand.
 *
 * Der Fall aus dem Betrieb: Beim Dubbe-Stehtisch heißt Variante 0
 * „Cortenstahl" (rostfarbener Tisch), die erste Farbe „Anthrazitgrau"
 * (dunkler Tisch). Solange die Farbe den Vortritt hatte, stand oben der
 * dunkle Tisch, während unten „Cortenstahl" hervorgehoben war. Sichtbar
 * hervorgehoben ist beim Laden die Variante, also muss sie das Bild bestimmen.
 */
test('Beim Laden gewinnt die Variante gegen die Farbe', () => {
  const stelle = bildStelleAnfang({ bildId: 26 }, { bildId: 27 }, BILDER)
  expect(stelle).toBe(2)
})

test('Ohne Variantenbild zählt beim Laden das der Farbe', () => {
  expect(bildStelleAnfang({ bildId: 26 }, { bildId: undefined }, BILDER)).toBe(1)
  expect(bildStelleAnfang({ bildId: 26 }, null, BILDER)).toBe(1)
})

test('Hat keine der beiden ein Bild, bleibt es offen', () => {
  expect(bildStelleAnfang(null, null, BILDER)).toBeNull()
  expect(bildStelleAnfang({}, {}, BILDER)).toBeNull()
})

test('Ein Artikel ohne Varianten fängt bei der Farbe an', () => {
  // Der Normalfall beim Herz: Varianten sind Größen ohne eigenes Bild
  expect(bildStelleAnfang({ bildId: 26 }, undefined, BILDER)).toBe(1)
})

test('Ein Farbbild, das nicht oben steht, kommt hinten dazu', () => {
  const ergebnis = galerieErgaenzen(BILDER.slice(0, 1), [
    { bezug: 26, bild: BILDER[1] },
  ])
  expect(ergebnis).toHaveLength(2)
  expect(ergebnis[1].id).toBe(26)
})

test('Das erste Bild bleibt das erste', () => {
  // Es ist das Aushängeschild des Artikels in Listen und Vorschauen
  const ergebnis = galerieErgaenzen(BILDER.slice(0, 1), [
    { bezug: 27, bild: BILDER[2] },
    { bezug: 26, bild: BILDER[1] },
  ])
  expect(ergebnis[0].id).toBe(25)
  expect(ergebnis.map((b) => b.id)).toEqual([25, 27, 26])
})

test('Ein Bild, das schon oben steht, kommt nicht doppelt', () => {
  const ergebnis = galerieErgaenzen(BILDER, [
    { bezug: 26, bild: BILDER[1] },
    { bezug: 27, bild: BILDER[2] },
  ])
  expect(ergebnis).toHaveLength(3)
})

test('Dieselbe Farbe an zwei Stellen ergänzt nur einmal', () => {
  // Zwei Varianten dürfen auf dasselbe Bild zeigen — die Galerie soll es
  // trotzdem nur einmal führen
  const ergebnis = galerieErgaenzen([BILDER[0]], [
    { bezug: 26, bild: BILDER[1] },
    { bezug: '26', bild: BILDER[1] },
  ])
  expect(ergebnis).toHaveLength(2)
})

test('Farben ohne Bild ergänzen nichts', () => {
  const ergebnis = galerieErgaenzen([BILDER[0]], [
    { bezug: null, bild: null },
    { bezug: undefined, bild: null },
  ])
  expect(ergebnis).toEqual([BILDER[0]])
})

test('Ein Verweis ohne ladbares Bild wird übersprungen', () => {
  // Ein gelöschtes Medium, auf das noch ein Verweis steht: Die Galerie darf
  // dadurch keinen leeren Platz bekommen
  const ergebnis = galerieErgaenzen([BILDER[0]], [{ bezug: 26, bild: null }])
  expect(ergebnis).toEqual([BILDER[0]])
})

test('Eine Galerie ohne Kennungen bringt die Zuordnung nicht durcheinander', () => {
  // Altbestand: Bilder, die vor dieser Änderung ohne Kennung durchgereicht
  // wurden. Sie sollen nicht versehentlich als Treffer gelten.
  const ohne: Galeriebild[] = [{ id: null, url: '/alt.jpg', alt: 'alt' }]
  expect(stelleFuer(26, ohne)).toBeNull()
  expect(galerieErgaenzen(ohne, [{ bezug: 26, bild: BILDER[1] }])).toHaveLength(2)
})
