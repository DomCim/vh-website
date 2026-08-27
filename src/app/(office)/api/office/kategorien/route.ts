import { NextResponse } from 'next/server'

import { payloadClient } from '../../../../../lib/data'
import { darf } from '../../../../../lib/wache'

export const dynamic = 'force-dynamic'

/**
 * Die Website-Kategorien fürs Büro — nur lesend.
 *
 * Gebraucht vom Dialog „Als Artikel ablegen": Ein Artikel verlangt eine
 * Kategorie, und die Kategorien sind bisher kein Büro-Bereich (sie gehören
 * zur Website-Verwaltung). Statt sie in den Gerätebestand aufzunehmen, holt
 * der Dialog sie hier ab — er braucht ohnehin Netz, weil das Anlegen des
 * Artikels sofort eine Antwort will.
 */
export async function GET(req: Request) {
  try {
    const payload = await payloadClient()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || !(await darf(payload, user, 'website.pflegen'))) {
      return NextResponse.json({ error: 'nicht-erlaubt' }, { status: 403 })
    }

    const { docs } = await payload.find({
      collection: 'categories',
      limit: 100,
      depth: 0,
      locale: 'de',
      overrideAccess: true,
      sort: 'name',
    })
    return NextResponse.json({
      kategorien: docs.map((k) => ({ id: k.id, titel: k.name ?? String(k.id) })),
    })
  } catch (err) {
    console.error('Kategorien lesen fehlgeschlagen:', err)
    return NextResponse.json({ error: 'fehlgeschlagen' }, { status: 500 })
  }
}
