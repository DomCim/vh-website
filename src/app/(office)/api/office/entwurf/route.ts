import { NextResponse } from 'next/server'

import { payloadClient } from '../../../../../lib/data'
import { darf } from '../../../../../lib/wache'

export const dynamic = 'force-dynamic'

/**
 * Entwürfe: der halbfertige Stand eines Formulars, am Benutzer festgemacht.
 *
 * Der Fall dahinter: Jemand fängt am Handy eine Rechnung an, kommt bis zur
 * dritten Position, setzt sich an den Rechner. Bisher war der Stand dort weg —
 * er lag im Formular des anderen Geräts und nirgends sonst.
 *
 * Drei Handgriffe, mehr braucht es nicht: holen, ablegen, wegwerfen. Abgelegt
 * wird immer unter demselben Schlüssel je Formular, damit ein Entwurf sich
 * selbst überschreibt statt sich zu vermehren — beim Tippen entstünde sonst
 * alle paar Sekunden ein neuer.
 */

/** `rechnungen:neu`, `belege:214` — Bereich und Kennung, mehr steckt nicht drin. */
const SCHLUESSEL = /^[a-z]+:(neu|[0-9]+|neu:[a-z0-9-]+)$/

async function wer(req: Request) {
  const payload = await payloadClient()
  const { user } = await payload.auth({ headers: req.headers })
  if (!user || !(await darf(payload, user, 'buero.oeffnen'))) return { payload, user: null }
  return { payload, user }
}

export async function GET(req: Request) {
  try {
    const { payload, user } = await wer(req)
    if (!user) return NextResponse.json({ error: 'nicht-erlaubt' }, { status: 403 })

    const schluessel = new URL(req.url).searchParams.get('schluessel') ?? ''
    if (!SCHLUESSEL.test(schluessel)) {
      return NextResponse.json({ error: 'schluessel-ungueltig' }, { status: 400 })
    }

    const gefunden = await payload.find({
      collection: 'drafts',
      where: { and: [{ benutzer: { equals: user.id } }, { schluessel: { equals: schluessel } }] },
      limit: 1,
      overrideAccess: true,
    })

    const entwurf = gefunden.docs[0]
    // Nichts gefunden ist kein Fehler — die meisten Formulare werden ohne
    // Vorgeschichte geöffnet.
    if (!entwurf) return NextResponse.json({ entwurf: null })

    return NextResponse.json({
      entwurf: {
        stand: entwurf.stand,
        geraet: entwurf.geraet ?? null,
        zeit: entwurf.updatedAt,
      },
    })
  } catch (err) {
    console.error('Entwurf holen fehlgeschlagen:', err)
    return NextResponse.json({ error: 'fehlgeschlagen' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { payload, user } = await wer(req)
    if (!user) return NextResponse.json({ error: 'nicht-erlaubt' }, { status: 403 })

    const b = (await req.json()) as { schluessel?: string; stand?: unknown; geraet?: string }
    if (!SCHLUESSEL.test(b.schluessel ?? '')) {
      return NextResponse.json({ error: 'schluessel-ungueltig' }, { status: 400 })
    }
    if (!b.stand || typeof b.stand !== 'object') {
      return NextResponse.json({ error: 'stand-fehlt' }, { status: 400 })
    }

    const vorhanden = await payload.find({
      collection: 'drafts',
      where: { and: [{ benutzer: { equals: user.id } }, { schluessel: { equals: b.schluessel } }] },
      limit: 1,
      overrideAccess: true,
    })

    const daten = {
      benutzer: user.id,
      schluessel: b.schluessel!,
      stand: b.stand as Record<string, unknown>,
      geraet: b.geraet?.slice(0, 60) || undefined,
    }

    const doc = vorhanden.docs[0]
      ? await payload.update({
          collection: 'drafts',
          id: vorhanden.docs[0].id,
          overrideAccess: true,
          data: daten,
        })
      : await payload.create({ collection: 'drafts', overrideAccess: true, data: daten })

    return NextResponse.json({ ok: true, zeit: doc.updatedAt })
  } catch (err) {
    console.error('Entwurf ablegen fehlgeschlagen:', err)
    return NextResponse.json({ error: 'fehlgeschlagen' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const { payload, user } = await wer(req)
    if (!user) return NextResponse.json({ error: 'nicht-erlaubt' }, { status: 403 })

    const schluessel = new URL(req.url).searchParams.get('schluessel') ?? ''
    if (!SCHLUESSEL.test(schluessel)) {
      return NextResponse.json({ error: 'schluessel-ungueltig' }, { status: 400 })
    }

    /*
     * Gelöscht wird über eine Abfrage statt über die Kennung: Der Aufrufer
     * kennt nur „welches Formular", nicht „welcher Datensatz". Und weil die
     * Abfrage den Benutzer einschließt, kann niemand fremde Entwürfe treffen,
     * auch nicht versehentlich.
     */
    await payload.delete({
      collection: 'drafts',
      where: { and: [{ benutzer: { equals: user.id } }, { schluessel: { equals: schluessel } }] },
      overrideAccess: true,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Entwurf wegwerfen fehlgeschlagen:', err)
    return NextResponse.json({ error: 'fehlgeschlagen' }, { status: 500 })
  }
}
