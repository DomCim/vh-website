/**
 * Materialbedarf, gerechnet im Browser.
 *
 * Dieselbe Rechnung wie in lib/material.ts, nur ohne Datenbank: Die
 * Inventarposten liegen im Bestand des Geräts, also braucht die Auftragsseite
 * dafür keine Anfrage mehr — und rechnet auch ohne Netz richtig.
 */

export type Bedarfsposten = {
  itemId: number
  name: string
  einheit: string
  benoetigt: number
  bestand: number
  fehlt: number
}

export type Posten = {
  id: number | string
  name?: string | null
  unit?: string | null
  quantity?: number | null
  unitValue?: number | null
}

const runden = (n: number) => Math.round(n * 1000) / 1000

/** Prüft Materialzeilen eines Auftrags gegen den Inventarbestand. */
export function bestandsPruefung(
  zeilen: { item?: unknown; quantity?: number | null }[],
  posten: Posten[],
): Bedarfsposten[] {
  const bedarf = new Map<number, number>()
  for (const zeile of zeilen) {
    const roh = typeof zeile.item === 'object' ? (zeile.item as { id?: number })?.id : zeile.item
    const id = Number(roh)
    if (!Number.isFinite(id) || !zeile.quantity) continue
    bedarf.set(id, runden((bedarf.get(id) ?? 0) + zeile.quantity))
  }
  if (!bedarf.size) return []

  return [...bedarf.entries()]
    .map(([itemId, benoetigt]) => {
      const stueck = posten.find((p) => Number(p.id) === itemId)
      const vorhanden = stueck?.quantity ?? 0
      return {
        itemId,
        name: stueck?.name ?? `Posten ${itemId}`,
        einheit: stueck?.unit ?? '',
        benoetigt,
        bestand: vorhanden,
        fehlt: Math.max(0, runden(benoetigt - vorhanden)),
      }
    })
    .sort((a, b) => b.fehlt - a.fehlt || a.name.localeCompare(b.name))
}
