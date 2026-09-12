import type { Payload, PayloadRequest } from 'payload'

import { bewegung } from './bestandsbewegung'
import { OFFENE_STAENDE } from './nachbestellung'

/**
 * Einen Wareneingang auf den Bestand buchen.
 *
 * Jede Zeile erhöht den Bestand ihres Postens und schreibt eine Zeile in
 * dessen Verlauf. Danach wird die Lieferung gegen die offenen
 * Lieferantenbestellungen gerechnet: Was ankam, wird dort als geliefert
 * vermerkt, und der Stand springt auf `teilgeliefert` oder `geliefert`.
 *
 * **Warum das nicht mehr ein Datum am Posten ist.** Vorher löschte jeder
 * Zugang den Merker `reorderedAt` — auch eine halbe Lieferung. Der Posten lag
 * danach weiter unter dem Mindestbestand, stand am nächsten Tag wieder in der
 * Nachbestellliste und wäre ein zweites Mal bestellt worden. Jetzt zählt die
 * Menge: Solange etwas aussteht, bleibt es unterwegs.
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
        data: bewegung(posten, menge, grund, undefined, eingang.receivedAt),
      })
      gebucht += 1
    } catch (err) {
      payload.logger.error(
        { err },
        `Wareneingang ${eingang.receiptNumber}: Posten ${String(id)} nicht gebucht`,
      )
    }
  }

  await bestellungenNachfuehren(payload, eingang, req)

  return gebucht
}

/**
 * Die gelieferten Mengen in den offenen Bestellungen nachtragen.
 *
 * **Zugeordnet wird nach Posten, älteste Bestellung zuerst** — und nicht nach
 * Lieferant. Der Grund ist der Alltag: Bestellt wird oft woanders als beim
 * hinterlegten Lieferanten (im Netz, im Laden), und dann stünde am
 * Wareneingang ein anderer Name als an der Bestellung. Nach dem Posten zu
 * gehen trifft in beiden Fällen das Richtige.
 *
 * Mehr zu liefern als bestellt ist kein Fehler, sondern kommt vor
 * (Gebindegröße, Dreingabe). Die Zeile wird dann voll, der Rest verfällt —
 * eingebucht ist er beim Bestand ohnehin.
 */
async function bestellungenNachfuehren(
  payload: Payload,
  eingang: Wareneingang,
  req?: PayloadRequest,
): Promise<void> {
  const offen = new Map<string, number>()
  for (const zeile of eingang.lines ?? []) {
    const id = typeof zeile.item === 'object' ? (zeile.item as { id?: number })?.id : zeile.item
    const menge = Number(zeile.quantity) || 0
    if (!id || menge <= 0) continue
    offen.set(String(id), (offen.get(String(id)) ?? 0) + menge)
  }
  if (!offen.size) return

  try {
    const { docs } = await payload.find({
      collection: 'supplier-orders',
      where: { status: { in: [...OFFENE_STAENDE] } },
      sort: 'createdAt',
      limit: 200,
      depth: 0,
      overrideAccess: true,
      req,
    })

    for (const bestellung of docs) {
      let beruehrt = false
      const zeilen = (bestellung.lines ?? []).map((z) => {
        const id = String(typeof z.item === 'object' ? (z.item as { id?: number })?.id : z.item)
        const fehlt = Math.max((z.quantity ?? 0) - (z.deliveredQuantity ?? 0), 0)
        const uebrig = offen.get(id) ?? 0
        if (fehlt <= 0 || uebrig <= 0) return z
        const nimmt = Math.min(fehlt, uebrig)
        offen.set(id, Math.round((uebrig - nimmt) * 1000) / 1000)
        beruehrt = true
        return {
          ...z,
          deliveredQuantity: Math.round(((z.deliveredQuantity ?? 0) + nimmt) * 1000) / 1000,
        }
      })
      if (!beruehrt) continue

      const vollstaendig = zeilen.every((z) => (z.deliveredQuantity ?? 0) >= (z.quantity ?? 0))
      await payload.update({
        collection: 'supplier-orders',
        id: bestellung.id,
        overrideAccess: true,
        req,
        data: {
          lines: zeilen,
          status: vollstaendig ? 'geliefert' : 'teilgeliefert',
          ...(vollstaendig
            ? { deliveredAt: eingang.receivedAt || new Date().toISOString() }
            : {}),
        },
      })
    }
  } catch (err) {
    // Der Bestand ist gebucht — das ist das Wichtige. Die Bestellung
    // nachzuführen darf das nicht im Nachhinein umwerfen.
    payload.logger.error(
      { err },
      `Wareneingang ${eingang.receiptNumber}: Bestellungen nicht nachgeführt`,
    )
  }
}
