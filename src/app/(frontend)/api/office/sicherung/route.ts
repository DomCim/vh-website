import { createReadStream } from 'fs'
import fs from 'fs/promises'
import { Readable } from 'stream'

import { NextResponse } from 'next/server'

import { payloadClient } from '../../../../../lib/data'
import {
  sicherungErstellen,
  sicherungHochladen,
  sicherungLoeschen,
  sicherungsPfad,
  zustandMerken,
} from '../../../../../lib/sicherung'

export const dynamic = 'force-dynamic'
// Datenbank ziehen, packen und auf die NAS schieben dauert bei vielen
// Werkstattbildern seine Zeit.
export const maxDuration = 3600

async function nurInhaber(req: Request) {
  const payload = await payloadClient()
  const { user } = await payload.auth({ headers: req.headers })
  if (!user || (user as { role?: string }).role !== 'inhaber') return null
  return payload
}

/** Sicherung herunterladen — zum Mitnehmen auf einen dritten Datenträger. */
export async function GET(req: Request) {
  const payload = await nurInhaber(req)
  if (!payload) return NextResponse.json({ error: 'nicht-erlaubt' }, { status: 403 })

  const name = new URL(req.url).searchParams.get('name') ?? ''
  try {
    const pfad = sicherungsPfad(name)
    const stat = await fs.stat(pfad)
    const strom = Readable.toWeb(createReadStream(pfad)) as ReadableStream
    return new Response(strom, {
      headers: {
        'Content-Type': 'application/gzip',
        'Content-Length': String(stat.size),
        'Content-Disposition': `attachment; filename="${name}"`,
      },
    })
  } catch {
    return NextResponse.json({ error: 'nicht-gefunden' }, { status: 404 })
  }
}

export async function POST(req: Request) {
  const payload = await nurInhaber(req)
  if (!payload) return NextResponse.json({ error: 'nicht-erlaubt' }, { status: 403 })

  const { aktion, name } = (await req.json()) as { aktion?: string; name?: string }

  try {
    if (aktion === 'erstellen') {
      const fertig = await sicherungErstellen(payload)
      let hinweis = `${fertig.name} (${(fertig.groesse / 1048576).toFixed(1)} MB)`
      let weg: string | null = null
      try {
        weg = await sicherungHochladen(payload, fertig.name)
        hinweis += ` — auf ${weg} gesichert`
      } catch (err) {
        // Die Sicherung selbst ist trotzdem entstanden; das sagt die Meldung.
        hinweis += ` — liegt auf dem Server, das Hochladen ging schief: ${
          err instanceof Error ? err.message : 'unbekannter Fehler'
        }`
      }
      await zustandMerken(payload, 'sicherung', { ok: Boolean(weg), note: hinweis })
      return NextResponse.json({ ok: true, meldung: hinweis, hochgeladen: Boolean(weg) })
    }

    if (aktion === 'hochladen' && name) {
      const weg = await sicherungHochladen(payload, name)
      return NextResponse.json({ ok: true, meldung: `${name} liegt jetzt auf ${weg}.` })
    }

    if (aktion === 'loeschen' && name) {
      await sicherungLoeschen(name)
      return NextResponse.json({ ok: true, meldung: `${name} wurde gelöscht.` })
    }

    return NextResponse.json({ error: 'unbekannte-aktion' }, { status: 400 })
  } catch (err) {
    console.error('Sicherung fehlgeschlagen:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'fehlgeschlagen' },
      { status: 500 },
    )
  }
}
