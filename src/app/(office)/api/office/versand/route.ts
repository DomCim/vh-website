import { NextResponse } from 'next/server'

import { payloadClient } from '../../../../../lib/data'
import { dokument, type DokumentArt } from '../../../../../lib/dokumente'
import { nachrichtSenden, postfachFinden } from '../../../../../lib/postfach'
import { sendMail } from '../../../../../lib/sendMail'
import { getIntegrations } from '../../../../../lib/settings'
import { darf } from '../../../../../lib/wache'

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
 *
 * Verschickt wird bevorzugt über ein Postfach — dann liegt die Rechnung als
 * Kopie in „Gesendet", und die Antwort des Kunden landet dort, wo sie
 * gelesen wird. Ist keines eingerichtet, geht die Mail über den normalen
 * Versandweg (SMTP, dieselbe Absenderadresse wie Bestellbestätigungen)
 * hinaus, statt den Versand zu blockieren: Vorher stand hier „ohne Postfach
 * kein Versand", und die erste echte Rechnung blieb daran hängen.
 */
export async function POST(req: Request) {
  try {
    const payload = await payloadClient()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || !(await darf(payload, user, 'anfragen.bearbeiten'))) {
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

    let unterlage
    try {
      unterlage = await dokument(payload, b.art, b.id)
    } catch (err) {
      const grund = err instanceof Error ? err.message : 'fehler'
      return NextResponse.json(
        {
          error:
            grund === 'entwurf'
              ? 'noch-entwurf'
              : grund === 'nicht-offen'
                ? 'nicht-offen'
                : 'nicht-gefunden',
        },
        { status: grund === 'entwurf' || grund === 'nicht-offen' ? 409 : 404 },
      )
    }

    const an = (b.an || unterlage.an || '').trim()
    if (!an) return NextResponse.json({ error: 'empfaenger-fehlt' }, { status: 400 })

    const betreff = b.betreff?.trim() || unterlage.betreff
    const text = b.text?.trim() || unterlage.text

    if (fach) {
      await nachrichtSenden(payload, fach, {
        an,
        betreff,
        text,
        dateien: [
          { name: unterlage.dateiname, inhalt: unterlage.datei, typ: 'application/pdf' },
        ],
      })
    } else {
      await sendMail(payload, {
        to: an,
        subject: betreff,
        html: text
          .split('\n')
          .map((zeile) => zeile || '&nbsp;')
          .join('<br>'),
        attachments: [
          { filename: unterlage.dateiname, content: unterlage.datei, contentType: 'application/pdf' },
        ],
        art: 'bestellung',
      })
    }

    // Erst jetzt festhalten, was verschickt wurde — vorher hätte ein
    // gescheiterter Versand die Mahnstufe hochgezählt.
    if (unterlage.nachSenden) {
      await unterlage.nachSenden().catch((err) => {
        console.error('Nachbereitung nach dem Versand fehlgeschlagen:', err)
      })
    }

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
  if (!user || !(await darf(payload, user, 'anfragen.bearbeiten'))) {
    return NextResponse.json({ error: 'nicht-erlaubt' }, { status: 403 })
  }

  const url = new URL(req.url)
  const art = url.searchParams.get('art') as DokumentArt | null
  const id = url.searchParams.get('id')
  if (!art || !id) return NextResponse.json({ error: 'unvollstaendig' }, { status: 400 })

  try {
    const unterlage = await dokument(payload, art, id)
    // Ohne Postfach zeigt das Fenster die System-Absenderadresse — dieselbe,
    // über die dann auch wirklich verschickt wird.
    const fach = await postfachFinden(payload, null)
    const { email } = await getIntegrations(payload)
    return NextResponse.json({
      an: unterlage.an ?? '',
      betreff: unterlage.betreff,
      text: unterlage.text,
      dateiname: unterlage.dateiname,
      absender: fach?.address ?? email.fromAddress ?? null,
    })
  } catch (err) {
    const grund = err instanceof Error ? err.message : 'fehler'
    return NextResponse.json(
      {
        error:
          grund === 'entwurf'
            ? 'noch-entwurf'
            : grund === 'nicht-offen'
              ? 'nicht-offen'
              : 'nicht-gefunden',
      },
      { status: grund === 'entwurf' || grund === 'nicht-offen' ? 409 : 404 },
    )
  }
}
