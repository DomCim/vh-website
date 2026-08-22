import { NextResponse } from 'next/server'

import { payloadClient } from '../../../../lib/data'
import { benachrichtige } from '../../../../lib/push'
import { ipAus, zuVieleAnfragen } from '../../../../lib/rateLimit'

export const dynamic = 'force-dynamic'

/**
 * Eine Kundenstimme entgegennehmen.
 *
 * Nur mit dem Schlüssel aus der Bestellung — so steht hinter jeder Stimme
 * eine echte Lieferung. Erfundene Bewertungen sind wettbewerbswidrig, und
 * eine Werkstatt mit fünf Aufträgen im Monat hat auch nichts davon.
 *
 * Veröffentlicht wird nichts von selbst: Der Eintrag liegt zur Prüfung im
 * Admin, bis ihn jemand freigibt.
 */
export async function POST(req: Request) {
  try {
    if (zuVieleAnfragen(`kundenstimme:${ipAus(req)}`, 5, 60 * 60_000)) {
      return NextResponse.json({ error: 'zu-viele-anfragen' }, { status: 429 })
    }

    const b = (await req.json()) as {
      token?: string
      quote?: string
      author?: string
      context?: string
      rating?: number
      einverstanden?: boolean
      website?: string
    }

    if (b.website?.trim()) return NextResponse.json({ ok: true })

    /*
     * Sterne sind freiwillig — und werden trotzdem geprüft.
     *
     * Was von außen kommt, gehört nicht ungeprüft in eine Zahl, die später
     * einen Durchschnitt bildet und als Sternebewertung bei Google steht.
     * Alles außer 1 bis 5 fällt still weg; die Stimme selbst bleibt.
     */
    const sterne =
      Number.isInteger(b.rating) && Number(b.rating) >= 1 && Number(b.rating) <= 5
        ? Number(b.rating)
        : undefined

    const quote = b.quote?.trim()
    const author = b.author?.trim()
    if (!b.token || !quote || !author || quote.length > 2000 || author.length > 120) {
      return NextResponse.json({ error: 'unvollstaendig' }, { status: 400 })
    }
    if (!b.einverstanden) {
      return NextResponse.json({ error: 'kein-einverstaendnis' }, { status: 400 })
    }

    const payload = await payloadClient()
    const { docs } = await payload.find({
      collection: 'orders',
      where: { accessToken: { equals: b.token } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const bestellung = docs[0] as Record<string, any> | undefined
    if (!bestellung) return NextResponse.json({ error: 'unbekannt' }, { status: 404 })

    const erstesStueck = bestellung.items?.[0]
    const produkt =
      typeof erstesStueck?.product === 'object' ? erstesStueck?.product?.id : erstesStueck?.product

    await payload.create({
      collection: 'testimonials',
      overrideAccess: true,
      locale: 'de',
      data: {
        quote,
        author,
        rating: sterne,
        context: b.context?.trim() || undefined,
        product: typeof produkt === 'number' ? produkt : undefined,
        pending: true,
        featured: false,
        submittedEmail: bestellung.customer?.email,
        orderNumber: bestellung.orderNumber,
      },
    })

    await benachrichtige(payload, {
      titel: 'Neue Kundenstimme',
      text: `${author} hat etwas zu ${bestellung.orderNumber} geschrieben.`,
      url: '/admin/collections/testimonials',
      tag: 'kundenstimme',
    }).catch(() => undefined)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Kundenstimme fehlgeschlagen:', err)
    return NextResponse.json({ error: 'fehlgeschlagen' }, { status: 500 })
  }
}
