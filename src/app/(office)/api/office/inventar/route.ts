import { NextResponse } from 'next/server'

import { bewegung } from '../../../../../lib/bestandsbewegung'
import { payloadClient } from '../../../../../lib/data'
import { doppelgaenger } from '../../../../../lib/inventarerfassung'
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

      const konto = user as { name?: string; email?: string; username?: string }
      const buchung = bewegung(
        posten,
        delta,
        String(b.grund ?? ''),
        konto?.name || konto?.email || konto?.username,
      )

      const doc = await payload.update({
        collection: 'inventory-items',
        id: b.id,
        overrideAccess: true,
        data: buchung,
      })

      return NextResponse.json({ ok: true, id: doc.id, quantity: buchung.quantity })
    }

    if (!b.name?.trim()) return NextResponse.json({ error: 'name-fehlt' }, { status: 400 })

    /*
     * Kein zweiter Posten gleichen Namens. Das Formular prüft das schon beim
     * Tippen gegen den Bestand im Gerät — aber der Bestand ist so alt wie der
     * letzte Abgleich, und ein zweites Gerät kann seitdem angelegt haben.
     * `like` findet großzügig (alle Wörter, in beliebiger Reihenfolge), die
     * genaue Entscheidung trifft dieselbe Regel wie im Formular.
     */
    const { docs: aehnliche } = await payload.find({
      collection: 'inventory-items',
      where: { name: { like: String(b.name).trim() } },
      limit: 50,
      depth: 0,
      overrideAccess: true,
    })
    const vorhanden = doppelgaenger(b.name, aehnliche, b.id)
    if (vorhanden) {
      return NextResponse.json({ error: 'doppelt', id: vorhanden.id }, { status: 409 })
    }

    const daten = {
      name: b.name,
      type: b.type || 'material',
      quantity: Number(b.quantity) || 0,
      unit: b.unit || 'Stück',
      // `null` bleibt `null`: Ein geleertes Feld heißt „nicht gesetzt" — beim
      // Mindestbestand ist das der Unterschied zwischen „kein Mindestbestand"
      // und „Mindestbestand null", und nur Ersteres nimmt den Posten aus der
      // Knapp-Liste. Nicht mitgeschickte Felder bleiben unangetastet.
      minQuantity: 'minQuantity' in b ? b.minQuantity : undefined,
      orderQuantity: 'orderQuantity' in b ? b.orderQuantity : undefined,
      // Ohne Lieferant am Posten wüsste die Nachbestellliste nicht, an wen
      // die Anfrage geht — das Feld wurde hier lange verschluckt.
      supplier: 'supplier' in b ? (b.supplier ? Number(b.supplier) : null) : undefined,
      supplierRef: b.supplierRef || undefined,
      unitValue: 'unitValue' in b ? b.unitValue : undefined,
      location: b.location || undefined,
      purchaseDate: b.purchaseDate || undefined,
      purchaseValue: 'purchaseValue' in b ? b.purchaseValue : undefined,
      notes: b.notes || undefined,
      // `movements` steht bewusst nicht in dieser Liste: Das Formular kennt
      // den Verlauf nicht, und was es nicht kennt, darf es nicht leeren.
    }

    let doc
    if (b.id) {
      const bisher = await payload.findByID({
        collection: 'inventory-items',
        id: b.id,
        depth: 0,
        overrideAccess: true,
      })
      if (!bisher) return NextResponse.json({ error: 'unbekannt' }, { status: 404 })

      /*
       * Wer im Formular den Bestand überschreibt, bucht damit — also gehört
       * auch das in den Verlauf. Vorher war genau hier das Loch: Die Zahl
       * änderte sich, und keine Zeile erzählte hinterher, wann und durch wen.
       */
      const neueMenge = Number(b.quantity) || 0
      const delta = Math.round((neueMenge - (bisher.quantity ?? 0)) * 1000) / 1000
      if (delta !== 0) {
        const konto = user as { name?: string; email?: string; username?: string }
        Object.assign(
          daten,
          bewegung(
            bisher,
            delta,
            'Im Formular geändert',
            konto?.name || konto?.email || konto?.username,
          ),
        )
      }

      doc = await payload.update({
        collection: 'inventory-items',
        id: b.id,
        overrideAccess: true,
        data: daten,
      })
    } else {
      doc = await payload.create({ collection: 'inventory-items', overrideAccess: true, data: daten })
    }

    return NextResponse.json({ ok: true, id: doc.id })
  } catch (err) {
    console.error('Inventar speichern fehlgeschlagen:', err)
    return NextResponse.json({ error: 'fehlgeschlagen' }, { status: 500 })
  }
}
