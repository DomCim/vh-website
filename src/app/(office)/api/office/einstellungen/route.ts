import { NextResponse } from 'next/server'

import type { FeldBeschreibung } from '../../../../../lib/felderLesen'
import { Integrations } from '../../../../../globals/Integrations'
import { SiteSettings } from '../../../../../globals/SiteSettings'
import { payloadClient } from '../../../../../lib/data'
import { locales, type Locale } from '../../../../../lib/i18n'
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

/**
 * Nur die Felder herausfiltern, die es je Sprache gibt.
 *
 * Beim Schreiben einer fremden Sprachfassung darf nichts anderes mitgehen.
 * Nicht aus Ordnungsliebe: Ein Feld, das es nur einmal gibt — die IBAN, der
 * Stundensatz, die Zugangsdaten —, würde beim Speichern der französischen
 * Fassung mit dem überschrieben, was gerade im Formular steht. Und dort steht
 * bei einer Sprachfassung womöglich nichts.
 *
 * Gruppen sind selbst nicht übersetzbar, ihre Felder darin aber schon (die
 * SEO-Standardtexte etwa). Deshalb wird hineingeschaut statt abgewiesen.
 */
function nurUebersetzbares(
  felder: FeldBeschreibung[],
  werte: Record<string, unknown>,
): Record<string, unknown> {
  const raus: Record<string, unknown> = {}
  for (const feld of felder) {
    if (!(feld.name in werte)) continue
    if (feld.uebersetzt) {
      raus[feld.name] = werte[feld.name]
      continue
    }
    if (feld.art === 'gruppe' && feld.felder) {
      const inneres = werte[feld.name]
      if (inneres && typeof inneres === 'object') {
        const gefiltert = nurUebersetzbares(feld.felder, inneres as Record<string, unknown>)
        if (Object.keys(gefiltert).length) raus[feld.name] = gefiltert
      }
    }
  }
  return raus
}

function spracheLesen(roh: string | null): Locale {
  return (locales as readonly string[]).includes(roh ?? '') ? (roh as Locale) : 'de'
}

export async function GET(req: Request) {
  const payload = await wachePassieren(req)
  if (!payload) return NextResponse.json({ error: 'nicht-erlaubt' }, { status: 403 })

  const url = new URL(req.url)
  const bereich = pruefen(url.searchParams.get('bereich'))
  if (!bereich) return NextResponse.json({ error: 'unbekannter-bereich' }, { status: 400 })

  const sprache = spracheLesen(url.searchParams.get('sprache'))
  const { global, slug } = BEREICHE[bereich]

  /*
   * `fallbackLocale: false` — sonst reicht Payload für eine leere französische
   * Fassung den deutschen Text durch. Im Büro sähe das aus, als sei übersetzt,
   * und beim Speichern stünde der deutsche Text als französischer fest.
   */
  const werte = await payload.findGlobal({
    slug,
    locale: sprache,
    fallbackLocale: false as never,
    depth: 0,
  })

  return NextResponse.json({
    sprache,
    felder: felderLesen(global.fields),
    werte,
  })
}

export async function POST(req: Request) {
  const payload = await wachePassieren(req)
  if (!payload) return NextResponse.json({ error: 'nicht-erlaubt' }, { status: 403 })

  try {
    const { bereich: roh, sprache: rohSprache, werte } = (await req.json()) as {
      bereich?: string
      sprache?: string
      werte?: Record<string, unknown>
    }
    const bereich = pruefen(roh ?? null)
    if (!bereich || !werte) {
      return NextResponse.json({ error: 'unvollstaendig' }, { status: 400 })
    }

    const sprache = spracheLesen(rohSprache ?? null)
    const { global, slug } = BEREICHE[bereich]

    // Bei einer fremden Sprachfassung geht nur mit, was es je Sprache gibt
    const daten =
      sprache === 'de' ? werte : nurUebersetzbares(felderLesen(global.fields), werte)
    if (!Object.keys(daten).length) {
      return NextResponse.json({ error: 'nichts-uebersetzbares' }, { status: 400 })
    }

    await payload.updateGlobal({
      slug,
      locale: sprache,
      data: daten as never,
      overrideAccess: true,
    })
    return NextResponse.json({ ok: true, sprache })
  } catch (err) {
    console.error('Einstellungen speichern fehlgeschlagen:', err)
    return NextResponse.json(
      { error: 'fehlgeschlagen', grund: fehlergrund(err) },
      { status: 500 },
    )
  }
}
