import { NextResponse } from 'next/server'

import { payloadClient } from '../../../../lib/data'
import { belegAusPdf } from '../../../../lib/facturxLesen'
import { belegAuslesen, kiZugang, textVorschlagen, uebersetzen } from '../../../../lib/ki'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * KI-Funktionen für das Backend: Belege auslesen, Texte vorschlagen, übersetzen.
 *
 * Nur für angemeldete Benutzer; das Auslesen von Belegen zusätzlich nur für die
 * Inhaberrolle, weil dort Geschäftszahlen im Spiel sind.
 */
export async function POST(req: Request) {
  try {
    const payload = await payloadClient()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user) return NextResponse.json({ error: 'nicht angemeldet' }, { status: 401 })

    /**
     * Den KI-Zugang erst holen, wenn er wirklich gebraucht wird: Eine
     * elektronische Rechnung liest sich ohne Modell — und ohne Schlüssel.
     */
    const zugangHolen = async () => kiZugang(payload)
    const ohneSchluessel = () =>
      NextResponse.json(
        { error: 'kein-schluessel', hinweis: 'Anthropic-Schlüssel unter Integrationen hinterlegen.' },
        { status: 503 },
      )

    const body = (await req.json()) as {
      aktion?: 'beleg' | 'text' | 'uebersetzen'
      medienId?: number
      art?: 'news' | 'produktbeschreibung' | 'kurzbeschreibung' | 'referenz' | 'frei'
      vorgabe?: string
      vorhandenerText?: string
      text?: string
      ziel?: 'fr' | 'en'
    }

    if (body.aktion === 'beleg') {
      if ((user as { role?: string }).role !== 'inhaber') {
        return NextResponse.json({ error: 'nicht-erlaubt' }, { status: 403 })
      }
      if (!body.medienId) return NextResponse.json({ error: 'medienId fehlt' }, { status: 400 })

      const medium = await payload
        .findByID({ collection: 'media', id: body.medienId, depth: 0, overrideAccess: true })
        .catch(() => null)
      if (!medium?.filename) return NextResponse.json({ error: 'beleg-fehlt' }, { status: 404 })

      const mimetype = medium.mimeType ?? ''
      const erlaubt = mimetype.startsWith('image/') || mimetype === 'application/pdf'
      if (!erlaubt) return NextResponse.json({ error: 'dateityp' }, { status: 400 })

      const { readFile } = await import('fs/promises')
      const { join } = await import('path')
      const daten = await readFile(join(process.cwd(), 'media', medium.filename))

      /**
       * Steckt im PDF eine Rechnungs-XML, ist alles Nötige exakt vorhanden —
       * Nummer, Datum, Beträge, Zahlungsziel. Dann braucht es kein Modell,
       * das ein Bild deutet: Das wäre langsamer, teurer und ungenauer.
       */
      if (mimetype === 'application/pdf') {
        const ausRechnung = belegAusPdf(daten)
        if (ausRechnung) {
          return NextResponse.json({ ok: true, beleg: ausRechnung, quelle: 'factur-x' })
        }
      }

      const zugang = await zugangHolen()
      if (!zugang) return ohneSchluessel()

      const { docs: lieferanten } = await payload.find({
        collection: 'contacts',
        where: { role: { in: ['lieferant', 'beides'] } },
        limit: 60,
        depth: 0,
        overrideAccess: true,
      })

      const ergebnis = await belegAuslesen(
        zugang,
        { daten, mimetype },
        lieferanten.map((l) => l.name).filter(Boolean),
      )
      if (!ergebnis) return NextResponse.json({ error: 'nicht-gelesen' }, { status: 502 })
      return NextResponse.json({ ok: true, beleg: ergebnis })
    }

    if (body.aktion === 'text') {
      if (!body.vorgabe?.trim()) {
        return NextResponse.json({ error: 'vorgabe-fehlt' }, { status: 400 })
      }
      const zugang = await zugangHolen()
      if (!zugang) return ohneSchluessel()

      const text = await textVorschlagen(zugang, {
        art: body.art ?? 'frei',
        vorgabe: body.vorgabe,
        vorhandenerText: body.vorhandenerText,
      })
      return NextResponse.json({ ok: true, text })
    }

    if (body.aktion === 'uebersetzen') {
      if (!body.text?.trim()) return NextResponse.json({ error: 'text-fehlt' }, { status: 400 })
      const ziel = body.ziel === 'en' ? 'en' : 'fr'
      const zugang = await zugangHolen()
      if (!zugang) return ohneSchluessel()

      const text = await uebersetzen(zugang, body.text, ziel)
      return NextResponse.json({ ok: true, text })
    }

    return NextResponse.json({ error: 'unbekannte-aktion' }, { status: 400 })
  } catch (err) {
    console.error('KI-Aufruf fehlgeschlagen:', err)
    return NextResponse.json({ error: 'fehlgeschlagen' }, { status: 500 })
  }
}
