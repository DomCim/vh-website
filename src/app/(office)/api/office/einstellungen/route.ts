import { NextResponse } from 'next/server'

import { Integrations } from '../../../../../globals/Integrations'
import { SiteSettings } from '../../../../../globals/SiteSettings'
import { payloadClient } from '../../../../../lib/data'
import { felderLesen } from '../../../../../lib/felderLesen'
import { darf } from '../../../../../lib/wache'

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

/*
 * `name in BEREICHE` wäre hier falsch: `in` sucht auch in der Prototypkette,
 * und damit gälte `?bereich=constructor` als gültiger Bereich. Danach stünde
 * in `global` eine Funktion, und die Route stürbe mit 500 statt mit einem
 * ordentlichen 400. `Object.hasOwn` fragt nur die Einträge selbst.
 */
function pruefen(name: string | null): Bereichsname | null {
  return name && Object.hasOwn(BEREICHE, name) ? (name as Bereichsname) : null
}

/**
 * Warum es nicht geklappt hat — in einem Satz, den man lesen kann.
 *
 * Payload weist unvollständige Eingaben ab und sagt genau, welches Feld fehlt.
 * Diese Auskunft blieb bisher im Log und der Mensch sah „Das hat nicht
 * geklappt." — beim Anlegen eines Postfachs mit seinen fünf Pflichtfeldern ist
 * das keine Hilfe, sondern ein Ratespiel.
 */
function fehlergrund(err: unknown): string | undefined {
  const daten = (err as { data?: { errors?: unknown } } | undefined)?.data?.errors
  if (Array.isArray(daten) && daten.length) {
    const texte = daten
      .map((e) => {
        const eintrag = e as { message?: string; path?: string; field?: string }
        const wo = eintrag.path || eintrag.field
        return wo ? `${wo}: ${eintrag.message ?? 'fehlt'}` : eintrag.message
      })
      .filter(Boolean)
    if (texte.length) return texte.join(' · ')
  }
  const text = (err as { message?: string } | undefined)?.message
  return typeof text === 'string' && text ? text : undefined
}

async function wachePassieren(req: Request) {
  const payload = await payloadClient()
  const { user } = await payload.auth({ headers: req.headers })
  if (!user || !(await darf(payload, user, 'einstellungen.aendern'))) return null
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
    return NextResponse.json(
      { error: 'fehlgeschlagen', grund: fehlergrund(err) },
      { status: 500 },
    )
  }
}
