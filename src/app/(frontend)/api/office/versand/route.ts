import { NextResponse } from 'next/server'

import { payloadClient } from '../../../../../lib/data'
import { dokument, type DokumentArt } from '../../../../../lib/dokumente'
import { nachrichtSenden, postfachFinden } from '../../../../../lib/postfach'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

/**
 * Ein Kundendokument per Mail verschicken.
 *
 * Angebot, Rechnung und Auftragsbestätigung gehen als PDF raus — nicht als
 * Fließtext in der Mail. Ein PDF lässt sich ablegen, weiterreichen und
 * ausdrucken, und es sieht bei jedem Empfänger gleich aus.
 *
 * Ohne `an` wird die hinterlegte Adresse des Geschäftspartners genommen;
 * ohne Text der Vorschlag aus dem Dokument.
 */
export async function POST(req: Request) {
  try {
    const payload = await payloadClient()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || (user as { role?: string }).role !== 'inhaber') {
      return NextResponse.json({ error: 'nicht-erlaubt' }, { status: 403 })
    }

    const b = (await req.json()) as {
      art?: DokumentArt
      id?: string | number
      an?: string
      betreff?: string
      text?: string
      fach?: string
    }
    if (!b.art || !b.id) return NextResponse.json({ error: 'unvollstaendig' }, { status: 400 })

    const fach = await postfachFinden(payload, b.fach)
    if (!fach) {
      return NextResponse.json({ error: 'kein-postfach' }, { status: 409 })
    }

    let unterlage
    try {
      unterlage = await dokument(payload, b.art, b.id)
    } catch (err) {
      const grund = err instanceof Error ? err.message : 'fehler'
      return NextResponse.json(
        { error: grund === 'entwurf' ? 'noch-entwurf' : 'nicht-gefunden' },
        { status: grund === 'entwurf' ? 409 : 404 },
      )
    }

    const an = (b.an || unterlage.an || '').trim()
    if (!an) return NextResponse.json({ error: 'empfaenger-fehlt' }, { status: 400 })

    await nachrichtSenden(payload, fach, {
      an,
      betreff: b.betreff?.trim() || unterlage.betreff,
      text: b.text?.trim() || unterlage.text,
      dateien: [
        { name: unterlage.dateiname, inhalt: unterlage.datei, typ: 'application/pdf' },
      ],
    })

    return NextResponse.json({ ok: true, an, dateiname: unterlage.dateiname })
  } catch (err) {
    console.error('Versand fehlgeschlagen:', err)
    return NextResponse.json({ error: 'fehlgeschlagen' }, { status: 500 })
  }
}

/** Vorschlag für Empfänger, Betreff und Text — füllt das Versandfenster */
export async function GET(req: Request) {
  const payload = await payloadClient()
  const { user } = await payload.auth({ headers: req.headers })
  if (!user || (user as { role?: string }).role !== 'inhaber') {
    return NextResponse.json({ error: 'nicht-erlaubt' }, { status: 403 })
  }

  const url = new URL(req.url)
  const art = url.searchParams.get('art') as DokumentArt | null
  const id = url.searchParams.get('id')
  if (!art || !id) return NextResponse.json({ error: 'unvollstaendig' }, { status: 400 })

  try {
    const unterlage = await dokument(payload, art, id)
    const fach = await postfachFinden(payload, null)
    return NextResponse.json({
      an: unterlage.an ?? '',
      betreff: unterlage.betreff,
      text: unterlage.text,
      dateiname: unterlage.dateiname,
      absender: fach?.address ?? null,
    })
  } catch (err) {
    const grund = err instanceof Error ? err.message : 'fehler'
    return NextResponse.json(
      { error: grund === 'entwurf' ? 'noch-entwurf' : 'nicht-gefunden' },
      { status: grund === 'entwurf' ? 409 : 404 },
    )
  }
}
