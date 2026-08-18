/**
 * Beträge für Angebote und Rechnungen — an einer Stelle, damit Angebot,
 * Rechnung und PDF nie unterschiedlich rechnen.
 *
 * Der Rabatt wird anteilig auf die Positionen verteilt, nicht am Ende vom
 * Bruttobetrag abgezogen. Das klingt nach Erbsenzählerei, ist aber der
 * Unterschied zwischen richtiger und falscher Steuer, sobald zwei Steuersätze
 * im selben Beleg stehen.
 */

export type Posten = {
  quantity?: number | null
  unitPrice?: number | null
  vatRate?: number | null
}

export type RabattEingabe = {
  discountKind?: string | null
  discountValue?: number | null
}

export type Betraege = {
  /** Netto vor Rabatt */
  subtotal: number
  /** Gewährter Nachlass in Euro */
  discountTotal: number
  /** Netto nach Rabatt — Bemessungsgrundlage der Steuer */
  netTotal: number
  vatTotal: number
  total: number
}

const runden = (n: number) => Math.round(n * 100) / 100

export function betraege(posten: Posten[], rabatt: RabattEingabe = {}): Betraege {
  const zeilen = (posten ?? []).map((p) => ({
    netto: (p.quantity ?? 0) * (p.unitPrice ?? 0),
    satz: p.vatRate ?? 0,
  }))
  const subtotal = zeilen.reduce((s, z) => s + z.netto, 0)

  let nachlass = 0
  if (rabatt.discountKind === 'prozent') {
    nachlass = subtotal * ((rabatt.discountValue ?? 0) / 100)
  } else if (rabatt.discountKind === 'betrag') {
    nachlass = rabatt.discountValue ?? 0
  }
  // Mehr Nachlass als Auftragswert ergibt keinen Sinn
  nachlass = Math.min(Math.max(nachlass, 0), subtotal)

  const anteil = subtotal > 0 ? (subtotal - nachlass) / subtotal : 1
  const vatTotal = zeilen.reduce((s, z) => s + z.netto * anteil * (z.satz / 100), 0)
  const netTotal = subtotal - nachlass

  return {
    subtotal: runden(subtotal),
    discountTotal: runden(nachlass),
    netTotal: runden(netTotal),
    vatTotal: runden(vatTotal),
    total: runden(netTotal + vatTotal),
  }
}
