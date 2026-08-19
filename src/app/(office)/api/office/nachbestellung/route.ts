import { NextResponse } from 'next/server'

import { payloadClient } from '../../../../../lib/data'
import { briefbogen } from '../../../../../lib/mail'
import { nachrichtSenden, postfachFinden } from '../../../../../lib/postfach'
import { sendMail } from '../../../../../lib/sendMail'
import { firmenAngaben } from '../../../../../lib/settings'
import { darf } from '../../../../../lib/wache'

export const dynamic = 'force-dynamic'

/**
 * Die Bestellanfrage an einen Lieferanten.
 *
 * Verschickt die Liste der knappen Posten als Mail und hält an jedem Posten
 * fest, dass er bestellt ist. Das Zweite ist wichtiger als es aussieht:
 * Zwischen „bestellt" und „liegt im Regal" vergehen Tage, und in denen steht
 * der Bestand weiter unter dem Mindestbestand. Ohne diesen Merker stünde die
 * Anfrage jeden Morgen wieder auf der Liste, und irgendwann läge alles doppelt
 * da.
 *
 * Verschickt wird bevorzugt über ein Postfach — dann liegt die Anfrage als
 * Kopie in „Gesendet", und die Antwort des Lieferanten landet dort, wo sie
 * gelesen wird. Ohne Postfach geht sie über den normalen Mailweg hinaus,
 * statt den Versand zu blockieren.
 */
export async function POST(req: Request) {
  try {
    const payload = await payloadClient()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || !(await darf(payload, user, 'inventar.pflegen'))) {
      return NextResponse.json({ error: 'nicht-erlaubt' }, { status: 403 })
    }

    const b = (await req.json()) as {
      aktion?: 'senden' | 'vermerken' | 'zuruecksetzen'
      an?: string
      betreff?: string
      text?: string
      posten?: (number | string)[]
      fach?: string
    }

    const posten = (b.posten ?? []).filter(Boolean)
    if (!posten.length) return NextResponse.json({ error: 'keine-posten' }, { status: 400 })

    /** Den Merker an den Posten setzen — oder wieder wegnehmen. */
    const merken = async (wert: string | null) => {
      for (const id of posten) {
        await payload
          .update({
            collection: 'inventory-items',
            id,
            overrideAccess: true,
            data: { reorderedAt: wert },
          })
          .catch((err) =>
            payload.logger.warn({ err }, `Nachbestellung: Posten ${id} nicht vermerkt`),
          )
      }
    }

    if (b.aktion === 'zuruecksetzen') {
      await merken(null)
      return NextResponse.json({ ok: true, posten: posten.length })
    }

    /*
     * „Vermerken" ist der Weg für alles, was nicht per Mail läuft: Der
     * Lieferant nimmt Bestellungen am Telefon, im Portal oder im Laden an.
     * Ohne diesen Knopf müsste man die Anfrage trotzdem verschicken, nur damit
     * die Liste stimmt.
     */
    if (b.aktion === 'vermerken') {
      await merken(new Date().toISOString())
      return NextResponse.json({ ok: true, posten: posten.length })
    }

    const an = String(b.an ?? '').trim()
    if (!an) return NextResponse.json({ error: 'keine-adresse' }, { status: 400 })

    const betreff = String(b.betreff ?? '').trim() || 'Bestellanfrage'
    const text = String(b.text ?? '').trim()
    if (!text) return NextResponse.json({ error: 'kein-text' }, { status: 400 })

    const angaben = firmenAngaben(
      await payload.findGlobal({ slug: 'site-settings', depth: 0 }).catch(() => null),
    )
    const html = briefbogen(
      text
        .split(/\n{2,}/)
        .map((absatz) => `<p style="white-space:pre-line">${absatz}</p>`)
        .join(''),
      angaben,
    )

    const fach = await postfachFinden(payload, b.fach)
    if (fach) {
      await nachrichtSenden(payload, fach, { an, betreff, text })
    } else {
      await sendMail(payload, { to: an, subject: betreff, html, art: 'sonstiges' })
    }

    await merken(new Date().toISOString())
    return NextResponse.json({ ok: true, an, posten: posten.length, ueberPostfach: Boolean(fach) })
  } catch (err) {
    console.error('Bestellanfrage fehlgeschlagen:', err)
    return NextResponse.json({ error: 'fehlgeschlagen' }, { status: 500 })
  }
}
