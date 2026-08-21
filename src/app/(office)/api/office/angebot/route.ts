import { NextResponse } from 'next/server'

import { payloadClient } from '../../../../../lib/data'
import { darf } from '../../../../../lib/wache'
import { nurGesendete } from '../../../../../lib/teilaenderung'

export const dynamic = 'force-dynamic'

/**
 * Die Zahlungsstufen des Artikels, über den die Anfrage lief.
 *
 * Ohne Anfrage oder ohne Artikel bleibt es bei null — dann wird der Auftrag am
 * Ende in einem Stück abgerechnet, wie bisher. Das ist der häufigere Fall und
 * der harmlosere: Eine vergessene Anzahlung kostet Vorfinanzierung, eine
 * erfundene kostet Vertrauen.
 */
async function zahlplanAusAngebot(
  payload: Awaited<ReturnType<typeof payloadClient>>,
  anfrageId: unknown,
): Promise<{ anzahlungProzent: number; zwischenProzent: number } | undefined> {
  const id = typeof anfrageId === 'object' ? (anfrageId as { id?: number })?.id : anfrageId
  if (typeof id !== 'number') return undefined
  try {
    const anfrage = await payload.findByID({
      collection: 'inquiries',
      id,
      depth: 1,
      overrideAccess: true,
    })
    const produkt = anfrage?.product
    if (!produkt || typeof produkt !== 'object') return undefined
    const anzahlung = Number(produkt.anzahlungProzent) || 0
    const zwischen = Number(produkt.zwischenProzent) || 0
    if (!anzahlung && !zwischen) return undefined
    return { anzahlungProzent: anzahlung, zwischenProzent: zwischen }
  } catch {
    return undefined
  }
}

/** Angebot anlegen, ändern oder in Auftrag bzw. Rechnung umwandeln. */
export async function POST(req: Request) {
  try {
    const payload = await payloadClient()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || !(await darf(payload, user, 'angebote.schreiben'))) {
      return NextResponse.json({ error: 'nicht-erlaubt' }, { status: 403 })
    }

    const b = (await req.json()) as Record<string, any>

    // ── Entwurf verwerfen ───────────────────────────────────────────────────
    if (b.aktion === 'verwerfen') {
      if (!b.id) return NextResponse.json({ error: 'unvollstaendig' }, { status: 400 })
      const angebot = await payload
        .findByID({ collection: 'quotes', id: b.id, depth: 0, overrideAccess: true })
        .catch(() => null)
      if (!angebot) return NextResponse.json({ error: 'nicht-gefunden' }, { status: 404 })
      /*
       * Nur Entwürfe ohne Nummer. Ein versendetes Angebot hat eine Nummer,
       * die beim Kunden liegt — das wird abgelehnt, nicht gelöscht, sonst
       * fehlte die Nummer hinterher in der Reihe.
       */
      if (angebot.quoteNumber) {
        return NextResponse.json({ error: 'schon-versendet' }, { status: 409 })
      }
      await payload.delete({ collection: 'quotes', id: b.id, overrideAccess: true })
      return NextResponse.json({ ok: true })
    }

    // ── Umwandeln ───────────────────────────────────────────────────────────
    if (b.aktion === 'in-auftrag' || b.aktion === 'in-rechnung') {
      const angebot = await payload
        .findByID({ collection: 'quotes', id: b.id, depth: 0, overrideAccess: true })
        .catch(() => null)
      if (!angebot) return NextResponse.json({ error: 'nicht-gefunden' }, { status: 404 })

      if (b.aktion === 'in-auftrag') {
        /*
         * Zweimal getippt hieß vorher: zwei Aufträge mit zwei Nummern.
         * Gibt es zu diesem Angebot schon einen, führt der Knopf dorthin,
         * statt zu schimpfen — dieselbe Prüfung wie beim Shop-Checkout.
         */
        const { docs: vorhandene } = await payload.find({
          collection: 'jobs',
          where: { quote: { equals: angebot.id } },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })
        if (vorhandene[0]) {
          return NextResponse.json(
            { error: 'schon-vorhanden', auftragId: vorhandene[0].id },
            { status: 409 },
          )
        }
        /*
         * Die Zahlungsstufen kommen vom Artikel, über den gesprochen wurde:
         * Anfrage → Angebot → Auftrag. Abgeschrieben, nicht verknüpft — was
         * hier vereinbart ist, darf sich nicht ändern, weil jemand Monate
         * später den Artikel im Shop anfasst.
         */
        const zahlplan = await zahlplanAusAngebot(payload, angebot.inquiry)

        const auftrag = await payload.create({
          collection: 'jobs',
          overrideAccess: true,
          data: {
            title: angebot.title || `Angebot ${angebot.quoteNumber}`,
            status: 'geplant',
            source: 'angebot',
            customerName: angebot.customerName ?? undefined,
            contact: (angebot.customer as number) ?? undefined,
            quote: angebot.id as number,
            zahlplan,
            positions: (angebot.items ?? []).map((p) => ({
              description: p.description,
              quantity: p.quantity,
              price: p.unitPrice,
              // Nur für das Bild auf den Papieren — siehe Quotes.items.product
              product: (p.product as number) ?? undefined,
            })),
          },
        })
        return NextResponse.json({ ok: true, auftragId: auftrag.id, nummer: auftrag.jobNumber })
      }

      const { docs: vorhandeneRechnungen } = await payload.find({
        collection: 'outgoing-invoices',
        where: { quote: { equals: angebot.id } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      if (vorhandeneRechnungen[0]) {
        return NextResponse.json(
          { error: 'schon-vorhanden', rechnungId: vorhandeneRechnungen[0].id },
          { status: 409 },
        )
      }

      const rechnung = await payload.create({
        collection: 'outgoing-invoices',
        overrideAccess: true,
        data: {
          status: 'entwurf',
          customerName: angebot.customerName ?? undefined,
          customer: (angebot.customer as number) ?? undefined,
          customerAddress: angebot.customerAddress ?? undefined,
          items: (angebot.items ?? []).map((p) => ({
            description: p.description,
            quantity: p.quantity,
            unit: p.unit ?? 'Stück',
            unitPrice: p.unitPrice,
            vatRate: p.vatRate,
            product: (p.product as number) ?? undefined,
          })),
          note: angebot.note ?? undefined,
          // Der zugesagte Nachlass gilt auch auf der Rechnung — sonst stünde
          // dort plötzlich mehr, als verhandelt wurde
          discountKind: angebot.discountKind ?? undefined,
          discountValue: angebot.discountValue ?? undefined,
          discountReason: angebot.discountReason ?? undefined,
          quote: angebot.id as number,
        },
      })
      return NextResponse.json({ ok: true, rechnungId: rechnung.id })
    }

    // ── Anlegen und Ändern ──────────────────────────────────────────────────
    const daten = {
      status: b.status || 'entwurf',
      title: b.title || undefined,
      customerName: b.customerName || undefined,
      customerAddress: b.customerAddress || undefined,
      issueDate: b.issueDate || undefined,
      validUntil: b.validUntil || undefined,
      productionTime: b.productionTime || undefined,
      discountKind: b.discountKind || 'kein',
      discountValue: b.discountValue ?? undefined,
      discountReason: b.discountReason || undefined,
      items: (b.items ?? [])
        .filter((p: { description?: string }) => p.description?.trim())
        .map((p: Record<string, unknown>) => ({
          description: p.description,
          quantity: Number(p.quantity) || 0,
          unit: p.unit || 'Stück',
          unitPrice: Number(p.unitPrice) || 0,
          vatRate: Number(p.vatRate) || 0,
          product: Number(p.product) || undefined,
        })),
      note: b.note || undefined,
      /*
       * Wird das Angebot hier auf „angenommen" gestellt, war es ein Anruf.
       * Der Zeitpunkt gehört trotzdem festgehalten — sonst steht hinterher
       * nur ein Status da, und „wann haben Sie zugestimmt?" bleibt
       * unbeantwortet. Die Portal-Annahme setzt dieselben Felder mit
       * `acceptedVia: 'portal'`, und das ist der Unterschied zwischen einer
       * Angabe und einem Beleg.
       */
      ...(b.status === 'angenommen'
        ? { acceptedAt: b.acceptedAt || new Date().toISOString(), acceptedVia: 'buero' as const }
        : {}),
    }

    /* Beim Ändern nur das Gesendete — siehe lib/teilaenderung.ts */
    const doc = b.id
      ? await payload.update({
          collection: 'quotes',
          id: b.id,
          overrideAccess: true,
          data: nurGesendete(b, daten, { acceptedAt: 'status', acceptedVia: 'status' }),
        })
      : await payload.create({ collection: 'quotes', overrideAccess: true, data: daten })

    return NextResponse.json({
      ok: true,
      id: doc.id,
      quoteNumber: doc.quoteNumber,
      revision: doc.revision,
    })
  } catch (err) {
    console.error('Angebot speichern fehlgeschlagen:', err)
    return NextResponse.json({ error: 'fehlgeschlagen' }, { status: 500 })
  }
}
