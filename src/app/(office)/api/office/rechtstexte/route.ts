import { NextResponse } from 'next/server'

import { locales, type Locale } from '../../../../../lib/i18n'
import { payloadClient } from '../../../../../lib/data'
import { rechtstexteEinspielen } from '../../../../../lib/rechtstexte'
import { nurAbsaetze, RECHTSTEXT_FELDER, textAusRichText } from '../../../../../lib/rechtstexteFelder'
import { richText } from '../../../../../lib/richtext'
import { darf } from '../../../../../lib/wache'

export const dynamic = 'force-dynamic'

/**
 * Die Rechtstexte im Büro lesen, schreiben und als Entwurf einspielen.
 *
 * **Warum das nicht im Admin-Panel bleibt.** Impressum, AGB und
 * Widerrufsbelehrung sind kein Website-Inhalt wie ein Ratgeberbeitrag,
 * sondern Betriebsunterlagen: Was dort steht, entscheidet im Streitfall. Wer
 * sie ändert, sitzt im Büro und nicht in der Redaktion — und musste dafür
 * bisher die Oberfläche wechseln, sich durch drei Sprachfassungen klicken und
 * in jeder einzeln speichern.
 *
 * **Das Einspielen der Entwürfe gehört mit hierher.** Bisher ging das nur über
 * ein Kommando im laufenden Container. Das setzt voraus, dass jemand eine
 * Konsole öffnet und den richtigen Pfad kennt — und genau deshalb blieben die
 * Seiten für Widerruf und Versand monatelang leer, bis das Merchant Center
 * darüber stolperte. Ein Knopf im Büro kann dasselbe.
 *
 * Geschrieben wird beim Einspielen nur dort, wo noch nichts steht. Eine eigene
 * Fassung zu überschreiben wäre der schlimmste Ausgang: Sie ist geprüft, der
 * Entwurf ist es nicht.
 */

/** Rechtstexte gehören zur Website — dasselbe Recht wie für die Verwaltung */
const RECHT = 'website.pflegen'

async function wachePassieren(req: Request) {
  const payload = await payloadClient()
  const { user } = await payload.auth({ headers: req.headers })
  if (!user || !(await darf(payload, user, RECHT))) return null
  return payload
}

function spracheLesen(req: Request): Locale | null {
  const roh = new URL(req.url).searchParams.get('sprache') ?? 'de'
  return (locales as readonly string[]).includes(roh) ? (roh as Locale) : null
}

export async function GET(req: Request) {
  const payload = await wachePassieren(req)
  if (!payload) return NextResponse.json({ error: 'nicht-erlaubt' }, { status: 403 })

  const sprache = spracheLesen(req)
  if (!sprache) return NextResponse.json({ error: 'unbekannte-sprache' }, { status: 400 })

  /*
   * `fallbackLocale: false` ist hier entscheidend.
   *
   * Ohne das liefert Payload für eine leere französische Fassung den deutschen
   * Text zurück. Im Büro sähe es dann so aus, als stünde die Übersetzung
   * bereits da — und beim Speichern schriebe man den deutschen Text als
   * französischen fest. Lieber ein sichtbar leeres Feld.
   */
  const werte = (await payload.findGlobal({
    slug: 'legal',
    locale: sprache,
    fallbackLocale: false as never,
    depth: 0,
  })) as unknown as Record<string, unknown>

  return NextResponse.json({
    sprache,
    texte: RECHTSTEXT_FELDER.map(({ feld, label, pfad, hinweis }) => ({
      feld,
      label,
      pfad,
      hinweis,
      text: textAusRichText(werte?.[feld]),
      bearbeitbar: nurAbsaetze(werte?.[feld]),
    })),
  })
}

export async function POST(req: Request) {
  const payload = await wachePassieren(req)
  if (!payload) return NextResponse.json({ error: 'nicht-erlaubt' }, { status: 403 })

  try {
    const { was, sprache: rohSprache, texte } = (await req.json()) as {
      was?: 'speichern' | 'entwuerfe'
      sprache?: string
      texte?: Record<string, string>
    }

    if (was === 'entwuerfe') {
      const geschrieben = await rechtstexteEinspielen(payload)
      return NextResponse.json({ ok: true, geschrieben })
    }

    const sprache = (locales as readonly string[]).includes(rohSprache ?? '')
      ? (rohSprache as Locale)
      : null
    if (!sprache || !texte) {
      return NextResponse.json({ error: 'unvollstaendig' }, { status: 400 })
    }

    // Nur bekannte Felder — was nicht in der Liste steht, wird nicht geschrieben
    const daten: Record<string, unknown> = {}
    for (const { feld } of RECHTSTEXT_FELDER) {
      const text = texte[feld]
      if (typeof text !== 'string') continue
      daten[feld] = text.trim() ? richText(text) : null
    }

    if (!Object.keys(daten).length) {
      return NextResponse.json({ error: 'nichts-zu-tun' }, { status: 400 })
    }

    await payload.updateGlobal({
      slug: 'legal',
      locale: sprache,
      data: daten as never,
      overrideAccess: true,
    })
    return NextResponse.json({ ok: true, sprache, felder: Object.keys(daten) })
  } catch (err) {
    console.error('Rechtstexte speichern fehlgeschlagen:', err)
    return NextResponse.json({ error: 'fehlgeschlagen' }, { status: 500 })
  }
}
