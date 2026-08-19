import { NextResponse } from 'next/server'

import { payloadClient } from '../../../../lib/data'
import { codeAnlegen, codeEinloesen, sitzungErzeugen, SITZUNGS_COOKIE } from '../../../../lib/kundenportal'
import { hatVorgaenge } from '../../../../lib/portalDaten'
import { ipAus, zuVieleAnfragen } from '../../../../lib/rateLimit'
import { sendMail } from '../../../../lib/sendMail'

export const dynamic = 'force-dynamic'

/**
 * Kundenportal-Anmeldung per sechsstelligem Code.
 *
 * Die Antwort verrät nie, ob es zu einer Adresse Bestellungen gibt —
 * sonst wäre das Formular eine Auskunftsstelle über die Kundschaft.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { aktion?: 'code-anfordern' | 'anmelden' | 'abmelden'; email?: string; code?: string }
    const email = body.email?.trim().toLowerCase() ?? ''
    const ip = ipAus(req)

    if (body.aktion === 'abmelden') {
      const antwort = NextResponse.json({ ok: true })
      antwort.cookies.set(SITZUNGS_COOKIE, '', { path: '/', maxAge: 0 })
      return antwort
    }

    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ error: 'email-ungueltig' }, { status: 400 })
    }

    const payload = await payloadClient()

    if (body.aktion === 'code-anfordern') {
      if (zuVieleAnfragen(`konto:${ip}`, 5, 15 * 60 * 1000) || zuVieleAnfragen(`konto:${email}`, 3, 15 * 60 * 1000)) {
        return NextResponse.json({ error: 'zu-viele-anfragen' }, { status: 429 })
      }

      /*
       * Nicht nur Bestellungen: Ein Kunde aus dem Projektgeschäft hat nie im
       * Shop bestellt — er hat einen Auftrag und Rechnungen. Vorher bekam
       * genau der keinen Code und stand vor einer Tür, die es für ihn gar
       * nicht gab.
       */
      if (await hatVorgaenge(payload, email)) {
        const code = await codeAnlegen(payload, email)
        await sendMail(payload, {
          to: email,
          subject: `Ihr Anmeldecode: ${code} – Vincent Hellmann`,
          html: `
            <div style="font-family:Helvetica,Arial,sans-serif;color:#1d1d1f;max-width:520px">
              <h1 style="font-size:18px;letter-spacing:2px;text-transform:uppercase">Vincent Hellmann</h1>
              <p>Ihr Anmeldecode für Ihre Übersicht:</p>
              <p style="font-size:30px;letter-spacing:8px;font-weight:bold;margin:18px 0">${code}</p>
              <p style="color:#666;font-size:13px">Der Code gilt 10 Minuten. Wenn Sie ihn nicht angefordert
              haben, können Sie diese Nachricht einfach löschen — ohne den Code passiert nichts.</p>
            </div>`,
          art: 'zugangscode',
        })
      }

      // Immer dieselbe Antwort, egal ob es die Adresse gibt
      return NextResponse.json({ ok: true })
    }

    if (body.aktion === 'anmelden') {
      if (zuVieleAnfragen(`konto-code:${ip}`, 15, 15 * 60 * 1000)) {
        return NextResponse.json({ error: 'zu-viele-anfragen' }, { status: 429 })
      }
      const ergebnis = await codeEinloesen(payload, email, (body.code ?? '').replace(/\D/g, ''))
      if (ergebnis !== 'ok') return NextResponse.json({ error: ergebnis }, { status: 400 })

      const sitzung = sitzungErzeugen(email)
      const antwort = NextResponse.json({ ok: true })
      antwort.cookies.set(sitzung.name, sitzung.wert, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: sitzung.maxAge,
      })
      return antwort
    }

    return NextResponse.json({ error: 'unbekannte-aktion' }, { status: 400 })
  } catch (err) {
    console.error('Kundenportal-Anmeldung fehlgeschlagen:', err)
    return NextResponse.json({ error: 'fehlgeschlagen' }, { status: 500 })
  }
}
