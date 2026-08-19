import { NextResponse } from 'next/server'

import { payloadClient } from '../../../../../lib/data'
import {
  nachrichtAendern,
  nachrichtLesen,
  nachrichtenListe,
  nachrichtSenden,
  ordnerListe,
  postfachFinden,
  postfaecher,
} from '../../../../../lib/postfach'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

async function wache(req: Request) {
  const payload = await payloadClient()
  const { user } = await payload.auth({ headers: req.headers })
  if (!user || (user as { role?: string }).role !== 'inhaber') return { payload, user: null }
  return { payload, user }
}

/**
 * Postfach lesen.
 *
 * `?fach=` wählt das Postfach, `?ordner=` den Ordner. Ohne `uid` kommt die
 * Liste, mit `uid` die einzelne Nachricht.
 */
export async function GET(req: Request) {
  try {
    const { payload, user } = await wache(req)
    if (!user) return NextResponse.json({ error: 'nicht-erlaubt' }, { status: 403 })

    const url = new URL(req.url)
    const faecher = await postfaecher(payload)
    if (!faecher.length) {
      return NextResponse.json({ fehlt: 'kein-postfach', faecher: [] })
    }

    const fach = await postfachFinden(payload, url.searchParams.get('fach'))
    if (!fach) return NextResponse.json({ error: 'postfach-unbekannt' }, { status: 404 })

    // Zugangsdaten bleiben serverseitig — nach außen gehen nur Name und Adresse
    const oeffentlich = faecher.map((f) => ({
      id: f.id,
      label: f.label,
      address: f.address,
    }))

    const ordner = url.searchParams.get('ordner') || 'INBOX'
    const uid = url.searchParams.get('uid')

    if (uid) {
      const nachricht = await nachrichtLesen(fach, ordner, Number(uid))
      if (!nachricht) return NextResponse.json({ error: 'nicht-gefunden' }, { status: 404 })
      return NextResponse.json({ fach: fach.id, faecher: oeffentlich, nachricht })
    }

    const vor = url.searchParams.get('vor')
    const [liste, ordnerAlle] = await Promise.all([
      nachrichtenListe(fach, ordner, 40, vor ? Number(vor) : undefined),
      url.searchParams.get('ordner') ? Promise.resolve(null) : ordnerListe(fach),
    ])

    return NextResponse.json({
      fach: fach.id,
      faecher: oeffentlich,
      ordner,
      ordnerListe: ordnerAlle,
      ...liste,
    })
  } catch (err) {
    console.error('Postfach lesen fehlgeschlagen:', err)
    return NextResponse.json({ error: 'postfach-nicht-erreichbar' }, { status: 502 })
  }
}

/** Schreiben, markieren, löschen. */
export async function POST(req: Request) {
  try {
    const { payload, user } = await wache(req)
    if (!user) return NextResponse.json({ error: 'nicht-erlaubt' }, { status: 403 })

    const b = (await req.json()) as Record<string, any>
    const fach = await postfachFinden(payload, b.fach)
    if (!fach) return NextResponse.json({ error: 'postfach-unbekannt' }, { status: 404 })

    if (b.aktion === 'senden') {
      if (!b.an?.trim()) return NextResponse.json({ error: 'empfaenger-fehlt' }, { status: 400 })
      await nachrichtSenden(payload, fach, {
        an: b.an,
        betreff: b.betreff || '(kein Betreff)',
        text: b.text || '',
        antwortAufMessageId: b.antwortAufMessageId || undefined,
      })
      return NextResponse.json({ ok: true })
    }

    const erlaubt = ['gelesen', 'ungelesen', 'markiert', 'unmarkiert', 'loeschen']
    if (!erlaubt.includes(b.aktion)) {
      return NextResponse.json({ error: 'aktion-unbekannt' }, { status: 400 })
    }
    if (!b.uid) return NextResponse.json({ error: 'uid-fehlt' }, { status: 400 })

    await nachrichtAendern(fach, b.ordner || 'INBOX', Number(b.uid), b.aktion)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Postfach-Aktion fehlgeschlagen:', err)
    return NextResponse.json({ error: 'fehlgeschlagen' }, { status: 500 })
  }
}
