import type { Payload } from 'payload'

/**
 * Materialbedarf und Bestandsprüfung.
 *
 * Grundlage ist die Stückliste je Produkt (gepflegt im Büro). Damit lässt
 * sich zu jeder Bestellung sagen, ob das Material im Haus ist — und was
 * fehlt, bevor der Kunde auf sein Stück wartet.
 */

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
  posten: { produktId: number; menge: number }[],
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
    for (const zeile of produkt?.billOfMaterials ?? []) {
      const id = typeof zeile.item === 'object' ? zeile.item?.id : zeile.item
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
  order: { items?: { product?: unknown; quantity: number }[] | null },
): Promise<Bedarfsposten[]> {
  const posten: { produktId: number; menge: number }[] = []
  for (const p of order.items ?? []) {
    const id = typeof p.product === 'object' ? (p.product as { id?: number })?.id : p.product
    if (typeof id === 'number') posten.push({ produktId: id, menge: p.quantity ?? 1 })
  }
  return bedarfFuerProdukte(payload, posten)
}
