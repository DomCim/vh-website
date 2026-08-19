import { NextResponse } from 'next/server'

import { payloadClient } from '../../../../../lib/data'
import { darf } from '../../../../../lib/wache'

export const dynamic = 'force-dynamic'

/**
 * Inventar-Posten anlegen, ändern — und den Bestand korrigieren.
 *
 * Die Korrektur ist ein eigener, enger Weg. Sie rechnet auf den Bestand, statt
 * ihn zu setzen: Wer „2 Meter verbraucht" bucht, soll nicht erst nachsehen
 * müssen, wie viel gerade dasteht, und sich beim Abziehen vertun. Und sie
 * schreibt eine Zeile in den Verlauf — ohne die wüsste hinterher niemand mehr,
 * warum aus 50 plötzlich 48 wurden.
 */
export async function POST(req: Request) {
  try {
    const payload = await payloadClient()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || !(await darf(payload, user, 'inventar.pflegen'))) {
      return NextResponse.json({ error: 'nicht-erlaubt' }, { status: 403 })
    }

    const b = (await req.json()) as Record<string, any>

    if (b.aktion === 'korrektur') {
      const delta = Number(b.delta)
      if (!b.id || !Number.isFinite(delta) || delta === 0) {
        return NextResponse.json({ error: 'unvollstaendig' }, { status: 400 })
      }

      const posten = await payload.findByID({
        collection: 'inventory-items',
        id: b.id,
        depth: 0,
        overrideAccess: true,
      })
      if (!posten) return NextResponse.json({ error: 'unbekannt' }, { status: 404 })

      /*
       * Der Bestand darf rechnerisch unter null rutschen, und das bleibt auch
       * so stehen. Ein auf null gedeckelter Bestand sähe ordentlich aus und
       * verschwiege genau die Information, um die es geht: Es wurde mehr
       * verbraucht, als je gebucht wurde — da fehlt eine Lieferung im System
       * oder es ist Zeit für eine Inventur.
       */
      const rest = Math.round(((posten.quantity ?? 0) + delta) * 1000) / 1000
      const konto = user as { name?: string; email?: string; username?: string }

      const doc = await payload.update({
        collection: 'inventory-items',
        id: b.id,
        overrideAccess: true,
        data: {
          quantity: rest,
          /*
           * Ein Zugang heißt: Die Lieferung ist da. Damit ist der Posten nicht
           * mehr „unterwegs" — sonst bliebe er es für immer, und die
           * Nachbestellliste verschwiege beim nächsten Mal, dass er wieder
           * knapp ist.
           */
          ...(delta > 0 ? { reorderedAt: null } : {}),
          movements: [
            ...(posten.movements ?? []),
            {
              day: new Date().toISOString(),
              delta,
              rest,
              reason: String(b.grund ?? '').trim() || undefined,
              who: konto?.name || konto?.email || konto?.username || undefined,
            },
          ],
        },
      })

      return NextResponse.json({ ok: true, id: doc.id, quantity: rest })
    }

    if (!b.name?.trim()) return NextResponse.json({ error: 'name-fehlt' }, { status: 400 })

    const daten = {
      name: b.name,
      type: b.type || 'material',
      quantity: Number(b.quantity) || 0,
      unit: b.unit || 'Stück',
      minQuantity: b.minQuantity ?? undefined,
      orderQuantity: b.orderQuantity ?? undefined,
      supplierRef: b.supplierRef || undefined,
      unitValue: b.unitValue ?? undefined,
      location: b.location || undefined,
      purchaseDate: b.purchaseDate || undefined,
      purchaseValue: b.purchaseValue ?? undefined,
      notes: b.notes || undefined,
      // `movements` steht bewusst nicht in dieser Liste: Das Formular kennt
      // den Verlauf nicht, und was es nicht kennt, darf es nicht leeren.
    }

    const doc = b.id
      ? await payload.update({
          collection: 'inventory-items',
          id: b.id,
          overrideAccess: true,
          data: daten,
        })
      : await payload.create({ collection: 'inventory-items', overrideAccess: true, data: daten })

    return NextResponse.json({ ok: true, id: doc.id })
  } catch (err) {
    console.error('Inventar speichern fehlgeschlagen:', err)
    return NextResponse.json({ error: 'fehlgeschlagen' }, { status: 500 })
  }
}
