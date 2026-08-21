import { NextResponse } from 'next/server'

import { payloadClient } from '../../../../../lib/data'
import { benachrichtige, pushSchluessel } from '../../../../../lib/push'
import { darf } from '../../../../../lib/wache'

export const dynamic = 'force-dynamic'

/** Öffentlicher Schlüssel, damit sich ein Gerät anmelden kann. */
export async function GET(req: Request) {
  const payload = await payloadClient()
  const { user } = await payload.auth({ headers: req.headers })
  if (!user || !(await darf(payload, user, 'buero.oeffnen'))) {
    return NextResponse.json({ error: 'nicht-erlaubt' }, { status: 403 })
  }

  const schluessel = await pushSchluessel(payload)
  if (!schluessel) return NextResponse.json({ error: 'keine-schluessel' }, { status: 500 })

  const { totalDocs } = await payload.count({
    collection: 'push-subscriptions',
    overrideAccess: true,
  })

  return NextResponse.json({ publicKey: schluessel.publicKey, geraete: totalDocs })
}

/** Gerät anmelden oder eine Probemeldung schicken. */
export async function POST(req: Request) {
  try {
    const payload = await payloadClient()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || !(await darf(payload, user, 'buero.oeffnen'))) {
      return NextResponse.json({ error: 'nicht-erlaubt' }, { status: 403 })
    }

    const b = (await req.json()) as Record<string, any>

    if (b.aktion === 'probe') {
      // Ohne `merken`: Ein „kommt an" ist eine Prüfung des Geräts und keine
      // Meldung über den Betrieb — auf der Liste unter der Glocke wäre es
      // nur Rauschen.
      const anzahl = await benachrichtige(
        payload,
        {
          titel: 'Büro',
          text: 'Benachrichtigungen kommen an.',
          url: '/office',
          tag: 'probe',
        },
        { merken: false },
      )
      return NextResponse.json({ ok: true, zugestellt: anzahl })
    }

    const endpoint = b.endpoint as string
    const p256dh = b.keys?.p256dh as string
    const auth = b.keys?.auth as string
    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json({ error: 'unvollstaendig' }, { status: 400 })
    }

    // Dasselbe Gerät soll nicht zweimal in der Liste stehen
    const { docs } = await payload.find({
      collection: 'push-subscriptions',
      where: { endpoint: { equals: endpoint } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    const daten = {
      endpoint,
      p256dh,
      auth,
      label: (b.label as string) || 'Gerät',
      user: user.id as number,
    }

    if (docs[0]) {
      await payload.update({
        collection: 'push-subscriptions',
        id: docs[0].id,
        overrideAccess: true,
        data: daten,
      })
    } else {
      await payload.create({ collection: 'push-subscriptions', overrideAccess: true, data: daten })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Push-Anmeldung fehlgeschlagen:', err)
    return NextResponse.json({ error: 'fehlgeschlagen' }, { status: 500 })
  }
}

/** Gerät abmelden. */
export async function DELETE(req: Request) {
  try {
    const payload = await payloadClient()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || !(await darf(payload, user, 'buero.oeffnen'))) {
      return NextResponse.json({ error: 'nicht-erlaubt' }, { status: 403 })
    }

    const { endpoint } = (await req.json()) as { endpoint?: string }
    if (!endpoint) return NextResponse.json({ error: 'endpoint-fehlt' }, { status: 400 })

    const { docs } = await payload.find({
      collection: 'push-subscriptions',
      where: { endpoint: { equals: endpoint } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (docs[0]) {
      await payload.delete({
        collection: 'push-subscriptions',
        id: docs[0].id,
        overrideAccess: true,
      })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Push-Abmeldung fehlgeschlagen:', err)
    return NextResponse.json({ error: 'fehlgeschlagen' }, { status: 500 })
  }
}
