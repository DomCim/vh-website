import { NextResponse } from 'next/server'

import { payloadClient } from '../../../../lib/data'
import { isLocale, type Locale } from '../../../../lib/i18n'
import { codeAnlegen, codeEinloesen, sitzungErzeugen, SITZUNGS_COOKIE } from '../../../../lib/kundenportal'
import { zugangscodeEmail, type CompanyInfo } from '../../../../lib/mail'
import { hatVorgaenge } from '../../../../lib/portalDaten'
import { ipAus, zuVieleAnfragen } from '../../../../lib/rateLimit'
import { sendMail } from '../../../../lib/sendMail'
import { firmenAngaben } from '../../../../lib/settings'

export const dynamic = 'force-dynamic'

/**
 * Kundenportal-Anmeldung per sechsstelligem Code.
 *
 * Die Antwort verrät nie, ob es zu einer Adresse Bestellungen gibt —
 * sonst wäre das Formular eine Auskunftsstelle über die Kundschaft.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      aktion?: 'code-anfordern' | 'anmelden' | 'abmelden'
      email?: string
      code?: string
      locale?: string
    }
    const email = body.email?.trim().toLowerCase() ?? ''
    // In welcher Sprache die Kundschaft gerade auf der Seite steht — die Mail
    // soll in derselben ankommen
    const sprache: Locale = body.locale && isLocale(body.locale) ? body.locale : 'de'
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
        let firma: CompanyInfo | undefined
        try {
          firma = firmenAngaben(await payload.findGlobal({ slug: 'site-settings', depth: 0 }))
        } catch {
          // Ohne Pflichtangaben geht die Mail trotzdem raus — ohne Code kommt
          // niemand ins Portal
        }
        await sendMail(payload, {
          to: email,
          ...zugangscodeEmail(code, 'anmeldung', sprache, firma),
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
