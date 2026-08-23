import { NextResponse } from 'next/server'

import { Integrations } from '../../../../../globals/Integrations'
import { SiteSettings } from '../../../../../globals/SiteSettings'
import { payloadClient } from '../../../../../lib/data'
import { locales, type Locale } from '../../../../../lib/i18n'
import { felderLesen } from '../../../../../lib/felderLesen'
import { nurUebersetzbares } from '../../../../../lib/sprachfelder'
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

  const url = new URL(req.url)
  const bereich = pruefen(url.searchParams.get('bereich'))
  if (!bereich) return NextResponse.json({ error: 'unbekannter-bereich' }, { status: 400 })

  const { global, slug } = BEREICHE[bereich]

  /*
   * Alle Sprachen auf einmal — und warum das die richtige Menge ist.
   *
   * Früher holte das Formular eine Sprache und lud beim Umschalten neu. Das
   * zwang zu einem Modus: Solange „Französisch" galt, war die halbe Liste weg,
   * denn Anschrift und Bankverbindung gibt es nur einmal. Jetzt liegt die
   * Sprache am einzelnen Feld, nicht an der Seite — dafür müssen alle drei
   * Fassungen gleichzeitig vorliegen.
   *
   * `fallbackLocale: false` — sonst reicht Payload für eine leere französische
   * Fassung den deutschen Text durch. Im Büro sähe das aus, als sei übersetzt,
   * und beim Speichern stünde der deutsche Text als französischer fest.
   */
  const alle = await Promise.all(
    locales.map(async (sprache) => [
      sprache,
      await payload.findGlobal({
        slug,
        locale: sprache,
        fallbackLocale: false as never,
        depth: 0,
      }),
    ]),
  )

  return NextResponse.json({
    felder: felderLesen(global.fields),
    werte: Object.fromEntries(alle),
  })
}

export async function POST(req: Request) {
  const payload = await wachePassieren(req)
  if (!payload) return NextResponse.json({ error: 'nicht-erlaubt' }, { status: 403 })

  try {
    const { bereich: roh, werte } = (await req.json()) as {
      bereich?: string
      werte?: Partial<Record<Locale, Record<string, unknown>>>
    }
    const bereich = pruefen(roh ?? null)
    if (!bereich || !werte || typeof werte !== 'object') {
      return NextResponse.json({ error: 'unvollstaendig' }, { status: 400 })
    }

    const { global, slug } = BEREICHE[bereich]
    const felder = felderLesen(global.fields)

    /*
     * Je Sprache ein Schreibvorgang: Payload nimmt pro Aufruf genau eine.
     * Nacheinander und nicht nebenher — zwei gleichzeitige Schreibzugriffe auf
     * dasselbe Global überschreiben einander je nach Reihenfolge des Servers.
     */
    const geschrieben: Locale[] = []
    for (const sprache of locales) {
      const roh = werte[sprache]
      if (!roh || typeof roh !== 'object') continue

      // In eine fremde Sprachfassung geht nur, was es je Sprache gibt: Anschrift,
      // Bankverbindung und Zugangsdaten würden sonst mit dem überschrieben, was
      // gerade im Formular steht — und dort steht bei einer Übersetzung nichts.
      const daten = sprache === 'de' ? roh : nurUebersetzbares(felder, roh)
      if (!Object.keys(daten).length) continue

      await payload.updateGlobal({
        slug,
        locale: sprache,
        data: daten as never,
        overrideAccess: true,
      })
      geschrieben.push(sprache)
    }

    if (!geschrieben.length) {
      return NextResponse.json({ error: 'nichts-zu-speichern' }, { status: 400 })
    }
    return NextResponse.json({ ok: true, sprachen: geschrieben })
  } catch (err) {
    console.error('Einstellungen speichern fehlgeschlagen:', err)
    return NextResponse.json(
      { error: 'fehlgeschlagen', grund: fehlergrund(err) },
      { status: 500 },
    )
  }
}
