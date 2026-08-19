import { NextResponse } from 'next/server'

import { Integrations } from '../../../../../globals/Integrations'
import { SiteSettings } from '../../../../../globals/SiteSettings'
import { payloadClient } from '../../../../../lib/data'
import { felderLesen } from '../../../../../lib/felderLesen'

export const dynamic = 'force-dynamic'

/**
 * Einstellungen im Büro lesen und schreiben.
 *
 * Bisher führte jeder Weg zu den Zugangsdaten über das Admin-Panel — mitten
 * aus dem Büro heraus, in eine andere Oberfläche, mit anderem Aufbau. Jetzt
 * bleibt alles Betriebliche an einem Ort; das Admin-Panel ist nur noch für die
 * öffentliche Website da.
 *
 * Herausgereicht wird die Feldbeschreibung aus Payload selbst (siehe
 * lib/felderLesen). Damit erscheint ein neues Feld dort auch hier, ohne dass
 * jemand daran denken muss.
 */

const BEREICHE = {
  betrieb: { global: SiteSettings, slug: 'site-settings' as const },
  integrationen: { global: Integrations, slug: 'integrations' as const },
}

type Bereichsname = keyof typeof BEREICHE

function pruefen(name: string | null): Bereichsname | null {
  return name && name in BEREICHE ? (name as Bereichsname) : null
}

async function wachePassieren(req: Request) {
  const payload = await payloadClient()
  const { user } = await payload.auth({ headers: req.headers })
  if (!user || (user as { role?: string }).role !== 'inhaber') return null
  return payload
}

export async function GET(req: Request) {
  const payload = await wachePassieren(req)
  if (!payload) return NextResponse.json({ error: 'nicht-erlaubt' }, { status: 403 })

  const bereich = pruefen(new URL(req.url).searchParams.get('bereich'))
  if (!bereich) return NextResponse.json({ error: 'unbekannter-bereich' }, { status: 400 })

  const { global, slug } = BEREICHE[bereich]
  const werte = await payload.findGlobal({ slug, depth: 0 })

  return NextResponse.json({
    felder: felderLesen(global.fields),
    werte,
  })
}

export async function POST(req: Request) {
  const payload = await wachePassieren(req)
  if (!payload) return NextResponse.json({ error: 'nicht-erlaubt' }, { status: 403 })

  try {
    const { bereich: roh, werte } = (await req.json()) as {
      bereich?: string
      werte?: Record<string, unknown>
    }
    const bereich = pruefen(roh ?? null)
    if (!bereich || !werte) {
      return NextResponse.json({ error: 'unvollstaendig' }, { status: 400 })
    }

    const { slug } = BEREICHE[bereich]
    await payload.updateGlobal({ slug, data: werte as never, overrideAccess: true })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Einstellungen speichern fehlgeschlagen:', err)
    return NextResponse.json({ error: 'fehlgeschlagen' }, { status: 500 })
  }
}
