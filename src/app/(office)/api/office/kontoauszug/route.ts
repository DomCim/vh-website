import { NextResponse } from 'next/server'

import { payloadClient } from '../../../../../lib/data'
import {
  auszugLesen,
  fingerabdruck,
  zuordnungsVorschlag,
  type OffeneRechnung,
} from '../../../../../lib/kontoauszug'
import { darf } from '../../../../../lib/wache'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const MAX_BYTES = 8 * 1024 * 1024

/**
 * Kontoauszug einlesen und Zahlungen zuordnen.
 *
 * Zwei Wege durch dieselbe Tür:
 *
 *  - **Einlesen** (Datei im Formular): Die Datei wird gelesen, jede Buchung
 *    bekommt ihren Fingerabdruck, und was schon dasteht, wird übersprungen.
 *    Zugeordnet wird dabei nichts — Vorschläge macht die Seite, entschieden
 *    wird von Hand.
 *  - **Zuordnen / Beiseitelegen** (JSON): Der einzelne Klick auf eine
 *    Buchung. Beim Zuordnen wird zugleich die Rechnung auf „bezahlt" gesetzt,
 *    mit dem Buchungstag als Zahltag — und darüber läuft dann alles Weitere:
 *    Bei einer Bestellung auf Rechnung geht die Bestätigung raus und die
 *    Fertigung beginnt (siehe collections/OutgoingInvoices.ts).
 */
export async function POST(req: Request) {
  try {
    const payload = await payloadClient()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || !(await darf(payload, user, 'rechnungen.schreiben'))) {
      return NextResponse.json({ error: 'nicht-erlaubt' }, { status: 403 })
    }

    const art = req.headers.get('content-type') ?? ''

    // ── Einzelne Buchung: zuordnen oder beiseitelegen ───────────────────────
    if (!art.includes('multipart/form-data')) {
      const b = (await req.json()) as {
        aktion?: 'zuordnen' | 'beiseite' | 'oeffnen'
        id?: number | string
        rechnung?: number | string
      }
      if (!b.id) return NextResponse.json({ error: 'unvollstaendig' }, { status: 400 })

      if (b.aktion === 'beiseite') {
        const doc = await payload.update({
          collection: 'bank-transactions',
          id: b.id,
          overrideAccess: true,
          data: { status: 'ignoriert', invoice: null, matchedAt: null },
        })
        return NextResponse.json({ ok: true, id: doc.id })
      }

      if (b.aktion === 'oeffnen') {
        const doc = await payload.update({
          collection: 'bank-transactions',
          id: b.id,
          overrideAccess: true,
          data: { status: 'offen', invoice: null, matchedAt: null },
        })
        return NextResponse.json({ ok: true, id: doc.id })
      }

      if (!b.rechnung) return NextResponse.json({ error: 'unvollstaendig' }, { status: 400 })

      const bewegung = await payload.findByID({
        collection: 'bank-transactions',
        id: b.id,
        depth: 0,
        overrideAccess: true,
      })
      if (!bewegung) return NextResponse.json({ error: 'unbekannt' }, { status: 404 })

      const doc = await payload.update({
        collection: 'bank-transactions',
        id: b.id,
        overrideAccess: true,
        data: {
          status: 'zugeordnet',
          invoice: b.rechnung as number,
          matchedAt: new Date().toISOString(),
        },
      })

      /*
       * Die Rechnung mitziehen — aber nur, wenn sie noch offen ist.
       *
       * Eine Teilzahlung auf eine bereits bezahlte Rechnung darf deren Zahltag
       * nicht überschreiben; und ein zweites `bezahlt` auf dieselbe Rechnung
       * würde am Auftrag Dinge erneut auslösen, die schon passiert sind.
       */
      const rechnung = await payload.findByID({
        collection: 'outgoing-invoices',
        id: b.rechnung as number,
        depth: 0,
        overrideAccess: true,
      })
      if (rechnung && rechnung.status !== 'bezahlt') {
        await payload.update({
          collection: 'outgoing-invoices',
          id: b.rechnung as number,
          overrideAccess: true,
          data: {
            status: 'bezahlt',
            paidDate: bewegung.bookingDate ?? new Date().toISOString(),
          },
        })
      }

      return NextResponse.json({ ok: true, id: doc.id })
    }

    // ── Datei einlesen ──────────────────────────────────────────────────────
    const formular = await req.formData()
    const datei = formular.get('datei')
    if (!(datei instanceof File)) return NextResponse.json({ error: 'keine-datei' }, { status: 400 })
    if (datei.size > MAX_BYTES) return NextResponse.json({ error: 'zu-gross' }, { status: 400 })

    /*
     * Von der Bank kommt selten UTF-8.
     *
     * Deutsche Bankexporte sind meist ISO-8859-1 oder Windows-1252 — dann
     * steht im Verwendungszweck „Grundstücksstra?e". Deshalb: erst UTF-8
     * versuchen, und wenn Ersatzzeichen auftauchen, in Windows-1252 noch
     * einmal. Umgekehrt ginge es nicht, denn Windows-1252 kann jedes Byte
     * lesen und verschluckt sich nie.
     */
    const rohdaten = Buffer.from(await datei.arrayBuffer())
    let inhalt = rohdaten.toString('utf8')
    if (inhalt.includes('�')) inhalt = rohdaten.toString('latin1')

    const { bewegungen, art: quelle } = auszugLesen(inhalt)
    if (!bewegungen.length) {
      return NextResponse.json({ error: 'nichts-gefunden' }, { status: 400 })
    }

    let neu = 0
    let bekannt = 0
    for (const bewegung of bewegungen) {
      const abdruck = fingerabdruck(bewegung)
      try {
        await payload.create({
          collection: 'bank-transactions',
          overrideAccess: true,
          data: {
            fingerprint: abdruck,
            status: 'offen',
            bookingDate: bewegung.tag,
            amount: bewegung.betrag,
            counterparty: bewegung.gegenpartei || undefined,
            purpose: bewegung.zweck || undefined,
            iban: bewegung.iban,
            currency: bewegung.waehrung || 'EUR',
            source: quelle,
          },
        })
        neu += 1
      } catch {
        // Der eindeutige Fingerabdruck hat zugeschlagen: Die Buchung steht
        // schon da. Genau dafür ist er da — überschneidende Auszüge sind der
        // Normalfall, nicht die Ausnahme.
        bekannt += 1
      }
    }

    return NextResponse.json({ ok: true, gelesen: bewegungen.length, neu, bekannt, quelle })
  } catch (err) {
    console.error('Kontoauszug fehlgeschlagen:', err)
    return NextResponse.json({ error: 'fehlgeschlagen' }, { status: 500 })
  }
}

/**
 * Die Vorschläge zu den offenen Buchungen.
 *
 * Gerechnet wird auf dem Server, obwohl beides im Gerät läge: Die Zuordnung
 * entscheidet über Geld, und sie soll überall dieselbe sein — auch dann, wenn
 * im Gerät ein Bestand von gestern liegt.
 */
export async function GET(req: Request) {
  try {
    const payload = await payloadClient()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || !(await darf(payload, user, 'rechnungen.schreiben'))) {
      return NextResponse.json({ error: 'nicht-erlaubt' }, { status: 403 })
    }

    const { docs: offene } = await payload.find({
      collection: 'bank-transactions',
      where: { status: { equals: 'offen' } },
      sort: '-bookingDate',
      limit: 200,
      depth: 0,
      overrideAccess: true,
    })

    const { docs: rechnungen } = await payload.find({
      collection: 'outgoing-invoices',
      // Storno-Gegenrechnungen stehen auch auf „gestellt", aber auf die
      // zahlt niemand — sie wären nur falsche Vorschläge beim Abgleich.
      where: { and: [{ status: { equals: 'gestellt' } }, { stornoVon: { exists: false } }] },
      limit: 300,
      depth: 0,
      overrideAccess: true,
    })

    const kandidaten: OffeneRechnung[] = rechnungen.map((r) => ({
      id: r.id,
      invoiceNumber: r.invoiceNumber,
      customerName: r.customerName,
      total: r.total,
    }))

    return NextResponse.json({
      bewegungen: offene.map((b) => ({
        id: b.id,
        tag: b.bookingDate,
        betrag: b.amount,
        gegenpartei: b.counterparty ?? '',
        zweck: b.purpose ?? '',
        vorschlag: zuordnungsVorschlag(
          {
            tag: String(b.bookingDate ?? '').slice(0, 10),
            betrag: Number(b.amount) || 0,
            gegenpartei: b.counterparty ?? '',
            zweck: b.purpose ?? '',
          },
          kandidaten,
        ),
      })),
      offeneRechnungen: kandidaten,
    })
  } catch (err) {
    console.error('Vorschläge fehlgeschlagen:', err)
    return NextResponse.json({ error: 'fehlgeschlagen' }, { status: 500 })
  }
}
