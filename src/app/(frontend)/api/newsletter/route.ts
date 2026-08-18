import { NextResponse } from 'next/server'

import { payloadClient } from '../../../../lib/data'
import { isLocale } from '../../../../lib/i18n'
import { newsletterAnmelden, type Sprache } from '../../../../lib/newsletter'
import { ipAus, zuVieleAnfragen } from '../../../../lib/rateLimit'

export const dynamic = 'force-dynamic'

type Eingang = {
  email?: string
  locale?: string
  /** Honigtopf: für Menschen unsichtbar, Bots füllen ihn aus */
  website?: string
}

/** Anmeldung zum Newsletter — verschickt die Bestätigungsmail. */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Eingang

    // Still mit ok antworten, damit der Bot nichts lernt
    if (body.website?.trim()) return NextResponse.json({ ok: true })

    if (zuVieleAnfragen(`newsletter:${ipAus(req)}`, 5, 10 * 60_000)) {
      return NextResponse.json({ error: 'zu-viele-anfragen' }, { status: 429 })
    }

    const email = body.email?.trim().toLowerCase()
    if (!email || email.length > 200 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ error: 'ungueltig' }, { status: 400 })
    }

    const sprache: Sprache = isLocale(body.locale ?? '') ? (body.locale as Sprache) : 'de'
    const payload = await payloadClient()
    const ergebnis = await newsletterAnmelden(payload, email, sprache)

    // Auch „schon dabei" sieht von außen aus wie eine normale Anmeldung —
    // sonst ließe sich über das Formular herausfinden, wer eingetragen ist.
    return NextResponse.json({ ok: true, ergebnis })
  } catch (err) {
    console.error('Newsletter-Anmeldung fehlgeschlagen:', err)
    return NextResponse.json({ error: 'fehlgeschlagen' }, { status: 500 })
  }
}
