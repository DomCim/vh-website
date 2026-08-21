import type { Payload } from 'payload'

/**
 * Materialbedarf und Bestandsprüfung.
 *
 * Grundlage ist die Stückliste je Produkt (gepflegt im Büro). Damit lässt
 * sich zu jeder Bestellung sagen, ob das Material im Haus ist — und was
 * fehlt, bevor der Kunde auf sein Stück wartet.
 *
 * **Varianten haben ihre eigene Liste.** Ein Kübel in 100 × 50 braucht mehr
 * Blech als derselbe in 60 × 30; eine gemeinsame Liste rechnet für den einen
 * zu wenig und für den anderen zu viel — und die Bestandswarnung, die daraus
 * entsteht, ist in beiden Fällen wertlos. Trägt eine Variante keine eigene
 * Liste, gilt die Grundliste am Artikel; bei Farbvarianten ist das der
 * Normalfall, und niemand soll dieselbe Liste dreimal pflegen.
 */

export type StuecklistenZeile = { item?: unknown; quantity?: number | null; note?: string | null }

/** Was eine Bestellposition über ihre Variante weiß. */
export type VariantenBezug = {
  /** Kennung der Variantenzeile am Artikel — überlebt Umbenennen und Sprachen */
  variantId?: string | null
  /** Die Bezeichnung, wie sie bei der Bestellung galt — der ältere Weg */
  variantTitle?: string | null
}

export type DienstleisterZeile = {
  contact?: unknown
  service?: string | null
  cost?: number | null
  leadTime?: string | null
  note?: string | null
}

type ProduktMitVarianten = {
  billOfMaterials?: StuecklistenZeile[] | null
  serviceProviders?: DienstleisterZeile[] | null
  productionMinutes?: number | null
  variants?:
    | {
        id?: string | null
        title?: string | null
        billOfMaterials?: StuecklistenZeile[] | null
        serviceProviders?: DienstleisterZeile[] | null
        productionMinutes?: number | null
      }[]
    | null
}

/**
 * Die Variantenzeile zu einer Bestellposition.
 *
 * Gesucht wird zuerst über die Kennung: Die bleibt, auch wenn jemand die
 * Bezeichnung ändert oder die Bestellung auf Französisch aufgegeben wurde.
 * Die Bezeichnung ist der Rückfallweg für Bestellungen von vorher — dort
 * steht keine Kennung, und dann ist der Name das Einzige, was da ist.
 */
export function varianteFinden<T extends { id?: string | null; title?: string | null }>(
  varianten: T[] | null | undefined,
  bezug: VariantenBezug,
): T | undefined {
  if (!varianten?.length) return undefined
  if (bezug.variantId) {
    const ueberKennung = varianten.find((v) => v.id && String(v.id) === String(bezug.variantId))
    if (ueberKennung) return ueberKennung
  }
  if (bezug.variantTitle) {
    return varianten.find((v) => v.title === bezug.variantTitle)
  }
  return undefined
}

/**
 * Welche Stückliste für diese Position gilt.
 *
 * Die der Variante, wenn sie eine hat — sonst die des Artikels. Eine leere
 * Variantenliste ist bewusst keine Aussage „braucht kein Material", sondern
 * heißt „hier gilt die Grundliste": Alles andere hieße, dass jede neu
 * angelegte Variante zunächst ohne Material dasteht und die Bestandswarnung
 * schweigt.
 */
export function variantenStueckliste(
  produkt: ProduktMitVarianten,
  bezug: VariantenBezug = {},
): StuecklistenZeile[] {
  const variante = varianteFinden(produkt.variants, bezug)
  const eigene = variante?.billOfMaterials ?? []
  return eigene.length ? eigene : (produkt.billOfMaterials ?? [])
}

/**
 * Welche Fremdleistung für diese Variante anfällt.
 *
 * Dieselbe Regel wie beim Material: die eigene Liste der Variante, sonst die
 * des Artikels. Verzinken kostet nach Gewicht, Beschichten nach Fläche —
 * beides ist bei einem großen Stück mehr als bei einem kleinen.
 */
export function variantenDienstleister(
  produkt: ProduktMitVarianten,
  bezug: VariantenBezug = {},
): DienstleisterZeile[] {
  const variante = varianteFinden(produkt.variants, bezug)
  const eigene = variante?.serviceProviders ?? []
  return eigene.length ? eigene : (produkt.serviceProviders ?? [])
}

/**
 * Wie lange diese Variante braucht — in Minuten.
 *
 * `null`, wenn weder Variante noch Artikel es wissen. Das ist etwas anderes
 * als eine Null: Eine unbekannte Zeit darf in der Auslastung nicht als
 * „kostet nichts" durchgehen (siehe lib/auslastung.ts).
 */
export function variantenMinuten(
  produkt: ProduktMitVarianten,
  bezug: VariantenBezug = {},
): number | null {
  const variante = varianteFinden(produkt.variants, bezug)
  if (typeof variante?.productionMinutes === 'number' && variante.productionMinutes > 0) {
    return variante.productionMinutes
  }
  return typeof produkt.productionMinutes === 'number' && produkt.productionMinutes > 0
    ? produkt.productionMinutes
    : null
}

/**
 * Der Ablauf der bestellten Variante — sonst der des Artikels.
 *
 * Dieselbe Stufenfolge wie bei Zeit und Stückliste: Was an der Variante steht,
 * gilt; sonst greift die Vorlage am Artikel. Ein Tor in 100 × 200 durchläuft
 * dieselben Schritte wie eines in 80 × 180, nur dauern sie länger — deshalb
 * lohnt sich die Vorlage am Artikel und die Ausnahme an der Variante.
 *
 * Zurück kommt eine **Abschrift**, keine Verknüpfung: Am Auftrag wird abgehakt,
 * und die Vorlage darf sich später ändern, ohne die Geschichte eines
 * abgeschlossenen Auftrags umzuschreiben.
 */
export type Planschritt = {
  was: string
  art: 'eigen' | 'fremd'
  minuten?: number | null
  dienstleister?: number | null
  kosten?: number | null
  vorlaufTage?: number | null
  stand: 'offen'
  notiz?: string | null
}

export function variantenArbeitsplan(
  produkt: ProduktMitVarianten & { arbeitsplan?: unknown },
  bezug: VariantenBezug = {},
): Planschritt[] {
  const variante = varianteFinden(produkt.variants, bezug) as
    | { arbeitsplan?: unknown }
    | undefined
  const quelle = (variante?.arbeitsplan ?? produkt.arbeitsplan) as
    | Record<string, unknown>[]
    | undefined
  if (!Array.isArray(quelle) || !quelle.length) return []

  return quelle.map((schritt) => ({
    was: String(schritt.was ?? ''),
    art: (schritt.art === 'fremd' ? 'fremd' : 'eigen') as 'eigen' | 'fremd',
    minuten: (schritt.minuten as number | null) ?? null,
    // Die Verknüpfung zum Dienstleister wird zur ID — der Auftrag soll auf
    // denselben Betrieb zeigen, aber nicht dessen Daten mitschleppen
    dienstleister:
      (typeof schritt.dienstleister === 'object' && schritt.dienstleister !== null
        ? (schritt.dienstleister as { id?: number }).id
        : (schritt.dienstleister as number | undefined)) ?? null,
    kosten: (schritt.kosten as number | null) ?? null,
    vorlaufTage: (schritt.vorlaufTage as number | null) ?? null,
    // Frisch abgeschrieben ist noch nichts erledigt
    stand: 'offen' as const,
    notiz: (schritt.notiz as string | null) ?? null,
  }))
}

export type Bedarfsposten = {
  itemId: number
  name: string
  einheit: string
  benoetigt: number
  bestand: number
  fehlt: number
}

const runden = (n: number) => Math.round(n * 1000) / 1000

/**
 * Rechnet den Materialbedarf für eine Menge Produkte zusammen.
 * `posten` sind Produkt-ID und Stückzahl.
 */
export async function bedarfFuerProdukte(
  payload: Payload,
  posten: ({ produktId: number; menge: number } & VariantenBezug)[],
): Promise<Bedarfsposten[]> {
  if (!posten.length) return []

  const { docs: produkte } = await payload.find({
    collection: 'products',
    where: { id: { in: posten.map((p) => p.produktId) } },
    limit: 200,
    depth: 0,
    overrideAccess: true,
  })

  // Bedarf je Inventar-Posten aufsummieren
  const bedarf = new Map<number, number>()
  for (const p of posten) {
    const produkt = produkte.find((x) => x.id === p.produktId)
    if (!produkt) continue
    for (const zeile of variantenStueckliste(produkt, p)) {
      const id =
        typeof zeile.item === 'object' ? (zeile.item as { id?: number })?.id : zeile.item
      if (typeof id !== 'number' || !zeile.quantity) continue
      bedarf.set(id, runden((bedarf.get(id) ?? 0) + zeile.quantity * p.menge))
    }
  }
  if (!bedarf.size) return []

  const { docs: bestand } = await payload.find({
    collection: 'inventory-items',
    where: { id: { in: [...bedarf.keys()] } },
    limit: 200,
    depth: 0,
    overrideAccess: true,
  })

  return [...bedarf.entries()]
    .map(([itemId, benoetigt]) => {
      const posten = bestand.find((b) => b.id === itemId)
      const vorhanden = posten?.quantity ?? 0
      return {
        itemId,
        name: posten?.name ?? `Posten ${itemId}`,
        einheit: posten?.unit ?? '',
        benoetigt,
        bestand: vorhanden,
        fehlt: Math.max(0, runden(benoetigt - vorhanden)),
      }
    })
    .sort((a, b) => b.fehlt - a.fehlt || a.name.localeCompare(b.name))
}

/**
 * Prüft fertige Materialzeilen (Posten + Menge) gegen den Bestand.
 * Anders als `bedarfFuerProdukte` geht das nicht über die Stückliste, sondern
 * nimmt die Zeilen, wie sie im Auftrag stehen.
 */
export async function bestandsPruefung(
  payload: Payload,
  zeilen: { item?: unknown; quantity?: number | null }[],
): Promise<Bedarfsposten[]> {
  const bedarf = new Map<number, number>()
  for (const z of zeilen) {
    const id = typeof z.item === 'object' ? (z.item as { id?: number })?.id : z.item
    if (typeof id !== 'number' || !z.quantity) continue
    bedarf.set(id, runden((bedarf.get(id) ?? 0) + z.quantity))
  }
  if (!bedarf.size) return []

  const { docs } = await payload.find({
    collection: 'inventory-items',
    where: { id: { in: [...bedarf.keys()] } },
    limit: 200,
    depth: 0,
    overrideAccess: true,
  })

  return [...bedarf.entries()]
    .map(([itemId, benoetigt]) => {
      const posten = docs.find((d) => d.id === itemId)
      const vorhanden = posten?.quantity ?? 0
      return {
        itemId,
        name: posten?.name ?? `Posten ${itemId}`,
        einheit: posten?.unit ?? '',
        benoetigt,
        bestand: vorhanden,
        fehlt: Math.max(0, runden(benoetigt - vorhanden)),
      }
    })
    .sort((a, b) => b.fehlt - a.fehlt || a.name.localeCompare(b.name))
}

/** Bedarf aus den Positionen einer Bestellung */
export async function bedarfFuerBestellung(
  payload: Payload,
  order: {
    items?:
      | ({ product?: unknown; quantity: number } & VariantenBezug)[]
      | null
  },
): Promise<Bedarfsposten[]> {
  const posten: ({ produktId: number; menge: number } & VariantenBezug)[] = []
  for (const p of order.items ?? []) {
    const id = typeof p.product === 'object' ? (p.product as { id?: number })?.id : p.product
    if (typeof id === 'number') {
      posten.push({
        produktId: id,
        menge: p.quantity ?? 1,
        variantId: p.variantId,
        variantTitle: p.variantTitle,
      })
    }
  }
  return bedarfFuerProdukte(payload, posten)
}

/**
 * Neue Variantenliste auf die bestehenden Zeilen abbilden.
 *
 * An der Kennung einer Variante hängt alles, was zu ihr gehört: Stückliste,
 * Fremdleistung, Arbeitszeit, die Werkstattdateien samt Ordnern — und die
 * Bestellpositionen, die sagen, welche Größe jemand gekauft hat. Wird eine
 * Variantenliste ohne Kennungen geschrieben, legt Payload für jede Zeile eine
 * neue an, und ein bloßes Umbenennen hängt die Zeichnungen und die Stückliste
 * stillschweigend ab.
 *
 * Gesucht wird deshalb in drei Stufen:
 *
 * 1. **Die mitgegebene Kennung** — eindeutig, und der Weg für Übersetzungen.
 * 2. **Der bisherige Name** — der Normalfall, wenn nur ein Preis sich ändert.
 * 3. **Die Position in der Liste**, solange die Anzahl gleich bleibt. Das ist
 *    der Fall beim Übersetzen ohne Kennung: Dort ändert sich jeder Name, aber
 *    die Reihenfolge bleibt.
 *
 * Bleibt alles drei ohne Treffer, ist es eine neue Variante und bekommt eine
 * neue Zeile.
 */
export function variantenZuordnen<
  A extends { id?: string | null; title?: string | null },
  N extends { kennung?: string | null; titel: string },
>(bisher: A[], neu: N[]): (N & { id?: string })[] {
  const gleicheAnzahl = neu.length === bisher.length
  return neu.map((v, i) => {
    const alt =
      (v.kennung && bisher.find((b) => String(b.id) === String(v.kennung))) ||
      bisher.find((b) => b.title === v.titel) ||
      (gleicheAnzahl ? bisher[i] : undefined)
    return alt?.id ? { ...v, id: String(alt.id) } : { ...v }
  })
}
