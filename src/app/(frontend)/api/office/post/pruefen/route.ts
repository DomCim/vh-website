import { NextResponse } from 'next/server'

import { payloadClient } from '../../../../../../lib/data'
import { postfaecher, ungeleseneAnzahl } from '../../../../../../lib/postfach'
import { benachrichtige } from '../../../../../../lib/push'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

/**
 * Schaut in den Postfächern nach und meldet neue Post.
 *
 * IMAP kennt keinen Rückkanal zum Server, deshalb wird nachgesehen — gedacht
 * für einen Aufruf im Minutentakt durch einen Cron-Dienst. Gemeldet wird nur,
 * wenn seit dem letzten Blick etwas dazugekommen ist; sonst käme bei jedem
 * Durchlauf dieselbe Meldung.
 *
 * Zugang entweder als angemeldeter Inhaber oder mit dem Schlüssel aus
 * CRON_SECRET im Kopf `Authorization: Bearer …`.
 */
export async function GET(req: Request) {
  const payload = await payloadClient()

  const geheim = process.env.CRON_SECRET
  const kopf = req.headers.get('authorization') ?? ''
  const perSchluessel = Boolean(geheim && kopf === `Bearer ${geheim}`)

  if (!perSchluessel) {
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || (user as { role?: string }).role !== 'inhaber') {
      return NextResponse.json({ error: 'nicht-erlaubt' }, { status: 403 })
    }
  }

  const faecher = await postfaecher(payload)
  if (!faecher.length) return NextResponse.json({ ok: true, faecher: 0 })

  const ergebnis: { fach: string; ungelesen: number; gemeldet: boolean }[] = []

  for (const fach of faecher) {
    try {
      const ungelesen = await ungeleseneAnzahl(fach)
      const schluessel = `postfach-${fach.id}`

      const { docs } = await payload.find({
        collection: 'counters',
        where: { key: { equals: schluessel } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      const zuletzt = docs[0]?.lastNumber ?? 0

      if (docs[0]) {
        await payload.update({
          collection: 'counters',
          id: docs[0].id,
          overrideAccess: true,
          data: { lastNumber: ungelesen },
        })
      } else {
        await payload.create({
          collection: 'counters',
          overrideAccess: true,
          data: { key: schluessel, lastNumber: ungelesen },
        })
      }

      const neu = ungelesen > zuletzt
      if (neu) {
        await benachrichtige(payload, {
          titel: `Neue Post für ${fach.label}`,
          text:
            ungelesen === 1 ? 'Eine ungelesene Nachricht.' : `${ungelesen} ungelesene Nachrichten.`,
          url: `/office/post?fach=${fach.id}`,
          tag: `post-${fach.id}`,
        })
      }
      ergebnis.push({ fach: fach.label, ungelesen, gemeldet: neu })
    } catch (err) {
      payload.logger.warn({ err }, `Postfach ${fach.label} nicht erreichbar`)
      ergebnis.push({ fach: fach.label, ungelesen: -1, gemeldet: false })
    }
  }

  return NextResponse.json({ ok: true, ergebnis })
}
