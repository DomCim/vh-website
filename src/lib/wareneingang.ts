import type { Payload, PayloadRequest } from 'payload'

/**
 * Einen Wareneingang auf den Bestand buchen.
 *
 * Jede Zeile erhöht den Bestand ihres Postens, schreibt eine Zeile in dessen
 * Verlauf und nimmt den Merker „nachbestellt" weg — die Lieferung ist ja da.
 *
 * Drei Dinge, die hier bewusst so sind:
 *
 * **Gebucht wird genau einmal.** Der Haken `booked` am Wareneingang ist der
 * Wächter: Wer später die Lieferscheinnummer nachträgt, soll nicht denselben
 * Bestand ein zweites Mal erhöhen.
 *
 * **Ein Fehler bei einem Posten hält die anderen nicht auf.** Eine Lieferung
 * mit fünf Zeilen, bei der die dritte auf einen gelöschten Posten zeigt, soll
 * die anderen vier trotzdem einbuchen — sonst steht der ganze Wareneingang
 * still, und im Regal liegt die Ware.
 *
 * **Alle Abfragen tragen `req`.** Auslöser laufen in der Transaktion dessen,
 * der sie ausgelöst hat; ohne `req` nimmt jede Abfrage eine eigene Verbindung
 * und wartet auf eine Sperre, die erst nach dem Auslöser fällt.
 */

export type Wareneingang = {
  id: number | string
  receiptNumber?: string | null
  receivedAt?: string | null
  supplierName?: string | null
  deliveryNote?: string | null
  lines?: { item?: unknown; quantity?: number | null; note?: string | null }[] | null
}

const runden = (n: number) => Math.round(n * 1000) / 1000

export async function wareneingangBuchen(
  payload: Payload,
  eingang: Wareneingang,
  req?: PayloadRequest,
): Promise<number> {
  let gebucht = 0

  for (const zeile of eingang.lines ?? []) {
    const id = typeof zeile.item === 'object' ? (zeile.item as { id?: number })?.id : zeile.item
    const menge = Number(zeile.quantity) || 0
    if (!id || menge <= 0) continue

    try {
      const posten = await payload.findByID({
        collection: 'inventory-items',
        id: id as number,
        depth: 0,
        overrideAccess: true,
        req,
      })
      if (!posten) continue

      const rest = runden((posten.quantity ?? 0) + menge)
      const grund = [
        `Wareneingang ${eingang.receiptNumber ?? ''}`.trim(),
        eingang.supplierName || undefined,
        eingang.deliveryNote ? `Lieferschein ${eingang.deliveryNote}` : undefined,
        zeile.note || undefined,
      ]
        .filter(Boolean)
        .join(' · ')

      await payload.update({
        collection: 'inventory-items',
        id: id as number,
        overrideAccess: true,
        req,
        data: {
          quantity: rest,
          // Die Lieferung ist da — der Posten ist nicht mehr unterwegs
          reorderedAt: null,
          movements: [
            ...(posten.movements ?? []),
            {
              day: eingang.receivedAt ?? new Date().toISOString(),
              delta: menge,
              rest,
              reason: grund,
            },
          ],
        },
      })
      gebucht += 1
    } catch (err) {
      payload.logger.error(
        { err },
        `Wareneingang ${eingang.receiptNumber}: Posten ${String(id)} nicht gebucht`,
      )
    }
  }

  return gebucht
}
