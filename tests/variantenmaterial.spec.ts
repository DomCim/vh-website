import { expect, test } from '@playwright/test'

import {
  farbenZuordnen,
  varianteFinden,
  variantenArbeitsplan,
  variantenDienstleister,
  variantenMinuten,
  variantenStueckliste,
  variantenZuordnen,
} from '../src/lib/material'

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
  serviceProviders: [{ contact: 7, service: 'Verzinken', cost: 60 }],
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
      serviceProviders: [{ contact: 7, service: 'Verzinken', cost: 145 }],
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

/*
 * Fremdleistung hängt genauso an der Größe wie das Material: Verzinken wird
 * nach Gewicht abgerechnet, Beschichten nach Fläche. Mit einem gemeinsamen
 * Preis rechnet die Kalkulation das kleine Stück zu teuer und das große zu
 * billig — und ausgerechnet beim großen fällt es ins Gewicht.
 */
test.describe('Welche Fremdleistung anfällt', () => {
  test('die eigene der Variante, wenn sie eine hat', () => {
    const dienste = variantenDienstleister(ARTIKEL, { variantId: 'v-gross' })
    expect(dienste).toHaveLength(1)
    expect(dienste[0].cost).toBe(145)
  })

  test('sonst die der Grundlage', () => {
    expect(variantenDienstleister(ARTIKEL, { variantId: 'v-klein' })[0].cost).toBe(60)
    expect(variantenDienstleister(ARTIKEL, {})[0].cost).toBe(60)
  })

  test('ohne alles bleibt die Liste leer statt undefiniert', () => {
    expect(variantenDienstleister({}, { variantId: 'x' })).toEqual([])
  })
})

/**
 * Varianten behalten ihre Kennung.
 *
 * Daran hängt alles, was zur Variante gehört: Stückliste, Fremdleistung,
 * Arbeitszeit, Werkstattdateien samt Ordnern — und die Bestellpositionen, die
 * sagen, welche Größe jemand gekauft hat. Wird eine Variantenliste ohne
 * Kennungen geschrieben, vergibt Payload neue, und ein bloßes Umbenennen
 * hängt die Zeichnungen stillschweigend ab.
 */
test.describe('Varianten wiederfinden', () => {
  const bisher = [
    { id: 'a1', title: '60 × 30 cm' },
    { id: 'a2', title: '100 × 50 cm' },
  ]

  test('die mitgegebene Kennung gewinnt — auch bei neuem Namen', () => {
    const raus = variantenZuordnen(bisher, [
      { kennung: 'a2', titel: 'Groß (100 × 50)' },
      { kennung: 'a1', titel: 'Klein (60 × 30)' },
    ])
    expect(raus.map((v) => v.id)).toEqual(['a2', 'a1'])
  })

  test('sonst der bisherige Name — der Normalfall beim Preisändern', () => {
    const raus = variantenZuordnen(bisher, [
      { titel: '60 × 30 cm' },
      { titel: '100 × 50 cm' },
    ])
    expect(raus.map((v) => v.id)).toEqual(['a1', 'a2'])
  })

  test('beim Übersetzen zählt die Reihenfolge, solange die Anzahl stimmt', () => {
    // Auf Französisch heißt keine Zeile mehr wie vorher — die Liste ist aber
    // dieselbe, nur übersetzt
    const raus = variantenZuordnen(bisher, [{ titel: '60 × 30 cm (petit)' }, { titel: 'grand' }])
    expect(raus.map((v) => v.id)).toEqual(['a1', 'a2'])
  })

  test('eine hinzugekommene Variante bekommt keine fremde Kennung', () => {
    const raus = variantenZuordnen(bisher, [
      { titel: '60 × 30 cm' },
      { titel: '100 × 50 cm' },
      { titel: '150 × 80 cm' },
    ])
    expect(raus.map((v) => v.id)).toEqual(['a1', 'a2', undefined])
  })

  test('ohne bestehende Varianten bleibt alles neu', () => {
    expect(variantenZuordnen([], [{ titel: 'Einzige' }])[0].id).toBeUndefined()
  })
})

/**
 * Farben behalten ihre Kennung — und damit ihr Bild.
 *
 * Der Anlass war ein gemessener Datenverlust: `produkt_varianten_setzen`
 * schrieb die Farben mit nur Name und Farbwert, Payload legte neue Zeilen an,
 * und das hinterlegte Farbbild war weg — beim bloßen Berichtigen eines
 * Farbnamens, ohne Fehlermeldung. Am laufenden Stand nachgemessen (08/2026):
 * Mit Kennung bleibt das Bild stehen, ohne Kennung ist es fort.
 *
 * Die Varianten hatten das Problem nie, weil sie die Kennung schon immer
 * mitgaben. Genau dieser Unterschied ist hier festgenagelt.
 */
test.describe('Farben einem bestehenden Artikel zuordnen', () => {
  const bisher = [
    { id: 'f1', name: 'Anthrazitgrau (RAL 7016)', image: 10 },
    { id: 'f2', name: 'Rubinrot (RAL 3003)', image: 26 },
  ]

  test('das Bild bleibt, wenn niemand eines mitgibt', () => {
    // Der Fall, der vorher Daten verlor: nur ein Name wird berichtigt
    const raus = farbenZuordnen(bisher, [
      { name: 'Anthrazitgrau (RAL 7016)' },
      { name: 'Rubinrot (RAL 3003)' },
    ])
    expect(raus.map((c) => c.image)).toEqual([10, 26])
    expect(raus.map((c) => c.id)).toEqual(['f1', 'f2'])
  })

  test('ein mitgegebenes Bild gewinnt', () => {
    const raus = farbenZuordnen(bisher, [
      { name: 'Anthrazitgrau (RAL 7016)', bild: 99 },
      { name: 'Rubinrot (RAL 3003)' },
    ])
    expect(raus.map((c) => c.image)).toEqual([99, 26])
  })

  test('null entfernt das Bild ausdrücklich', () => {
    // Der Unterschied zu „weggelassen": Ohne ihn könnte niemand ein Bild
    // wieder loswerden, ohne die ganze Farbe zu löschen
    const raus = farbenZuordnen(bisher, [{ name: 'Rubinrot (RAL 3003)', bild: null }])
    expect(raus[0].image).toBeNull()
  })

  test('die mitgegebene Kennung gewinnt — auch bei neuem Namen', () => {
    const raus = farbenZuordnen(bisher, [
      { kennung: 'f2', name: 'Rouge rubis (RAL 3003)' },
      { kennung: 'f1', name: 'Gris anthracite (RAL 7016)' },
    ])
    expect(raus.map((c) => c.id)).toEqual(['f2', 'f1'])
    // Und das Bild reist mit der Kennung, nicht mit der Position
    expect(raus.map((c) => c.image)).toEqual([26, 10])
  })

  test('beim Übersetzen zählt die Reihenfolge, solange die Anzahl stimmt', () => {
    // Ohne Kennung, alle Namen anders — genau der Fall einer Sprachfassung
    const raus = farbenZuordnen(bisher, [
      { name: 'Gris anthracite' },
      { name: 'Rouge rubis' },
    ])
    expect(raus.map((c) => c.id)).toEqual(['f1', 'f2'])
    expect(raus.map((c) => c.image)).toEqual([10, 26])
  })

  test('eine hinzugekommene Farbe bekommt keine fremde Kennung und kein fremdes Bild', () => {
    const raus = farbenZuordnen(bisher, [
      { name: 'Anthrazitgrau (RAL 7016)' },
      { name: 'Rubinrot (RAL 3003)' },
      { name: 'Moosgrün (RAL 6005)' },
    ])
    expect(raus.map((c) => c.id)).toEqual(['f1', 'f2', undefined])
    expect(raus[2].image).toBeUndefined()
  })

  test('ohne bestehende Farben bleibt alles neu', () => {
    const raus = farbenZuordnen([], [{ name: 'Einzige', bild: 5 }])
    expect(raus[0].id).toBeUndefined()
    expect(raus[0].image).toBe(5)
  })
})

/**
 * Welcher Ablauf gilt — dieselbe Stufenfolge wie bei Stückliste und Zeit.
 *
 * Der heimtückische Fall ist der **leere** Varianten-Ablauf: Payload liefert
 * das Feld an jeder Variante als leere Liste mit. Zählte die als „hat einen
 * (leeren) Ablauf", griffe die Vorlage am Artikel bei Artikeln mit Varianten
 * nie — genau so stand es hier zuerst im Code (`??` statt Längenprüfung).
 */
test.describe('Welcher Ablauf gilt', () => {
  const MIT_PLAN = {
    variants: [
      { id: 'v1', title: 'Klein', arbeitsplan: [] },
      {
        id: 'v2',
        title: 'Groß',
        arbeitsplan: [{ was: 'Extra-Naht', art: 'fremd', dienstleister: 7, vorlaufTage: 3 }],
      },
    ],
    arbeitsplan: [
      { was: 'Zuschnitt', art: 'eigen', minuten: 30 },
      { was: 'Schweißen', art: 'eigen', minuten: 90 },
    ],
  }

  test('der eigene der Variante, wenn sie einen hat', () => {
    const plan = variantenArbeitsplan(MIT_PLAN, { variantId: 'v2' })
    expect(plan.map((s) => s.was)).toEqual(['Extra-Naht'])
    // Die Verknüpfung wird zur Kennung — der Auftrag zeigt auf den Betrieb,
    // schleppt aber nicht dessen Daten mit
    expect(plan[0].dienstleister).toBe(7)
  })

  test('ein leerer Varianten-Ablauf erbt die Vorlage vom Artikel', () => {
    const plan = variantenArbeitsplan(MIT_PLAN, { variantId: 'v1' })
    expect(plan.map((s) => s.was)).toEqual(['Zuschnitt', 'Schweißen'])
  })

  test('ohne Variante gilt die Vorlage vom Artikel', () => {
    expect(variantenArbeitsplan(MIT_PLAN, {}).map((s) => s.was)).toEqual([
      'Zuschnitt',
      'Schweißen',
    ])
  })

  test('die Abschrift fängt immer bei offen an', () => {
    // Auch wenn in der Vorlage je ein Stand stünde: Ein frischer Auftrag hat
    // noch nichts erledigt
    const plan = variantenArbeitsplan(
      { arbeitsplan: [{ was: 'Kanten', art: 'eigen', stand: 'erledigt' }] },
      {},
    )
    expect(plan[0].stand).toBe('offen')
  })

  test('ohne alles bleibt die Liste leer statt undefiniert', () => {
    expect(variantenArbeitsplan({}, {})).toEqual([])
  })
})
