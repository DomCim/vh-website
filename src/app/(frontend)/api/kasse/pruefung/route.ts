import { NextResponse } from 'next/server'

import { payloadClient } from '../../../../../lib/data'
import { isLocale, type Locale } from '../../../../../lib/i18n'
import {
  codeAnlegen,
  codeEinloesen,
  sitzungAusAnfrage,
  sitzungErzeugen,
} from '../../../../../lib/kundenportal'
import { zugangscodeEmail, type CompanyInfo } from '../../../../../lib/mail'
import { ipAus, zuVieleAnfragen } from '../../../../../lib/rateLimit'
import { sendMail } from '../../../../../lib/sendMail'
import { firmenAngaben } from '../../../../../lib/settings'

export const dynamic = 'force-dynamic'

/**
 * Die E-Mail-Adresse bestätigen — als Tor zwischen zwei Schritten der Kasse.
 *
 * Bisher wurde die Adresse erst geprüft, wenn alles ausgefüllt war und man
 * auf „Bestellen" gedrückt hatte. Der Code kam also am Ende, nachdem man
 * zwanzig Felder ausgefüllt hatte. Jetzt steht die Prüfung dort, wo die
 * Adresse eingetippt wird: Wer weitergehen will, hat sie bestätigt.
 *
 * **Warum überhaupt.** Bestätigungsmail, Zugang zum Kundenportal,
 * Versandmeldung — alles hängt an dieser einen Adresse. Ein Tippfehler hieße:
 * Der Kunde bekommt nichts davon, und wer die vertippte Adresse wirklich
 * besitzt, könnte sich später im Portal anmelden und eine fremde Bestellung
 * samt Anschrift sehen.
 *
 * **Warum eine eigene Route und nicht `/api/konto`.** Die Anmeldung dort
 * verschickt bewusst nur an Adressen, zu denen es schon Vorgänge gibt —
 * sonst wäre das Formular eine Auskunftsstelle darüber, wer hier Kunde ist.
 * An der Kasse ist es umgekehrt: Der Mensch tippt gerade seine eigene Adresse
 * ein, und ein neuer Kunde ist der Normalfall. Beides in eine Route zu
 * pressen hieße, diese Unterscheidung in ein Flag zu verwandeln — und
 * irgendwann steht das Flag falsch.
 *
 * Bestätigt heißt angemeldet: Derselbe Nachweis öffnet das Kundenportal, und
 * die Bestellung geht später ohne zweite Abfrage durch.
 */

const EMAIL_MUSTER = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      aktion?: 'code-anfordern' | 'bestaetigen'
      email?: string
      code?: string
      locale?: string
    }

    const email = body.email?.trim().toLowerCase() ?? ''
    if (!EMAIL_MUSTER.test(email)) {
      return NextResponse.json({ error: 'email-ungueltig' }, { status: 400 })
    }

    const sprache: Locale = body.locale && isLocale(body.locale) ? body.locale : 'de'
    const ip = ipAus(req)
    const payload = await payloadClient()

    if (body.aktion === 'code-anfordern') {
      /*
       * Wer schon eine gültige Sitzung für genau diese Adresse hat, ist
       * fertig — bestätigt ist bestätigt. Ohne das bekäme ein Stammkunde bei
       * jeder Bestellung eine Code-Mail, die er nicht braucht.
       */
      if (sitzungAusAnfrage(req) === email) {
        return NextResponse.json({ ok: true, schonBestaetigt: true })
      }

      if (
        zuVieleAnfragen(`kasse:${ip}`, 8, 15 * 60 * 1000) ||
        zuVieleAnfragen(`kasse:${email}`, 4, 15 * 60 * 1000)
      ) {
        return NextResponse.json({ error: 'zu-viele-anfragen' }, { status: 429 })
      }

      const code = await codeAnlegen(payload, email)
      let firma: CompanyInfo | undefined
      try {
        firma = firmenAngaben(await payload.findGlobal({ slug: 'site-settings', depth: 0 }))
      } catch {
        // Ohne Pflichtangaben geht die Mail trotzdem raus — ohne Code kommt
        // niemand weiter, und das wäre das größere Übel
      }
      await sendMail(payload, {
        to: email,
        ...zugangscodeEmail(code, 'bestellung', sprache, firma),
        art: 'zugangscode',
      })
      return NextResponse.json({ ok: true })
    }

    if (body.aktion === 'bestaetigen') {
      if (zuVieleAnfragen(`kasse-code:${ip}`, 20, 15 * 60 * 1000)) {
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
    console.error('Bestätigung an der Kasse fehlgeschlagen:', err)
    return NextResponse.json({ error: 'fehlgeschlagen' }, { status: 500 })
  }
}
