import { expect, test } from '@playwright/test'

import { varianteFinden, variantenMinuten, variantenStueckliste } from '../src/lib/material'

/**
 * Welche Stückliste für ein bestelltes Stück gilt.
 *
 * Daran hängt zweierlei: ob die Bestandswarnung stimmt („Blech reicht nicht")
 * und wie viele Stunden der Auftrag in der Auslastung belegt. Beides falsch
 * heißt: Ein Termin wird zugesagt, der nicht zu halten ist — und das Material
 * fehlt am Tag, an dem gefertigt werden soll.
 */

const ARTIKEL = {
  billOfMaterials: [
    { item: 1, quantity: 2 },
    { item: 2, quantity: 4 },
  ],
  productionMinutes: 240,
  variants: [
    // Klein: nimmt alles vom Artikel
    { id: 'v-klein', title: '60 × 30 cm' },
    // Groß: mehr Blech, gleich viele Füße, länger
    {
      id: 'v-gross',
      title: '100 × 50 cm',
      billOfMaterials: [
        { item: 1, quantity: 5 },
        { item: 2, quantity: 4 },
      ],
      productionMinutes: 420,
    },
  ],
}

test.describe('Die Variante zu einer Bestellposition', () => {
  test('wird über die Kennung gefunden', () => {
    expect(varianteFinden(ARTIKEL.variants, { variantId: 'v-gross' })?.title).toBe('100 × 50 cm')
  })

  /*
   * Die Bezeichnung ist übersetzt und änderbar: Eine französische Bestellung
   * trägt den französischen Namen, und wer die Variante umbenennt, hätte sonst
   * alle alten Bestellungen von ihrer Stückliste abgeschnitten.
   */
  test('die Kennung schlägt die Bezeichnung', () => {
    const treffer = varianteFinden(ARTIKEL.variants, {
      variantId: 'v-gross',
      variantTitle: '60 × 30 cm',
    })
    expect(treffer?.id).toBe('v-gross')
  })

  test('ohne Kennung entscheidet die Bezeichnung — für alte Bestellungen', () => {
    expect(varianteFinden(ARTIKEL.variants, { variantTitle: '60 × 30 cm' })?.id).toBe('v-klein')
  })

  test('was sich nicht zuordnen lässt, bleibt ohne Variante', () => {
    expect(varianteFinden(ARTIKEL.variants, { variantTitle: 'gibt es nicht' })).toBeUndefined()
    expect(varianteFinden([], { variantId: 'v-gross' })).toBeUndefined()
  })
})

test.describe('Welche Stückliste gilt', () => {
  test('die eigene der Variante, wenn sie eine hat', () => {
    const liste = variantenStueckliste(ARTIKEL, { variantId: 'v-gross' })
    expect(liste).toHaveLength(2)
    expect(liste[0]).toMatchObject({ item: 1, quantity: 5 })
  })

  /*
   * Eine leere Variantenliste heißt „hier gilt die Grundlage" und nicht
   * „braucht kein Material". Andernfalls stünde jede neu angelegte Variante
   * ohne Material da, und die Bestandswarnung schwiege genau dann, wenn sie
   * gebraucht wird.
   */
  test('sonst die Grundliste des Artikels', () => {
    expect(variantenStueckliste(ARTIKEL, { variantId: 'v-klein' })).toEqual(
      ARTIKEL.billOfMaterials,
    )
    expect(variantenStueckliste(ARTIKEL, {})).toEqual(ARTIKEL.billOfMaterials)
  })

  test('ein Artikel ohne alles ergibt eine leere Liste, keinen Absturz', () => {
    expect(variantenStueckliste({}, { variantId: 'x' })).toEqual([])
  })
})

test.describe('Welche Arbeitszeit gilt', () => {
  test('die der Variante, sonst die des Artikels', () => {
    expect(variantenMinuten(ARTIKEL, { variantId: 'v-gross' })).toBe(420)
    expect(variantenMinuten(ARTIKEL, { variantId: 'v-klein' })).toBe(240)
    expect(variantenMinuten(ARTIKEL, {})).toBe(240)
  })

  /*
   * `null` und nicht `0`: Eine unbekannte Zeit darf in der Auslastung nicht
   * als „kostet nichts" durchgehen — sonst sieht eine volle Woche leer aus.
   */
  test('ohne jede Angabe null statt null Minuten', () => {
    expect(variantenMinuten({ variants: [{ id: 'a', title: 'A' }] }, { variantId: 'a' })).toBeNull()
    expect(variantenMinuten({ productionMinutes: 0 }, {})).toBeNull()
  })
})
