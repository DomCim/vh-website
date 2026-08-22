import { NextResponse } from 'next/server'

import { payloadClient } from '../../../../../lib/data'
import { briefbogen } from '../../../../../lib/mail'
import { sendMail } from '../../../../../lib/sendMail'
import { firmenAngaben } from '../../../../../lib/settings'
import { darf } from '../../../../../lib/wache'
import {
  MAX_JE_NACHRICHT,
  WEITERGABE_TAGE,
  weitergabeBis,
  weitergabeLink,
} from '../../../../../lib/weitergabe'

export const dynamic = 'force-dynamic'

/**
 * Werkstattdateien an einen Zulieferer schicken.
 *
 * Ankreuzen, Adresse, abschicken. Es entsteht kein Ordner und keine zweite
 * Fassung der Zeichnung — nur ein Abhol-Link je Datei (`lib/weitergabe.ts`),
 * der vierzehn Tage gilt und immer den Stand von jetzt ausliefert.
 *
 * **Warum `auftraege.bearbeiten` und nicht `website.pflegen`.** Wer Dateien am
 * Artikel pflegt, tut das im Haus; wer sie hinausgibt, entscheidet über
 * Fremdfertigung. Das ist die Arbeit dessen, der den Auftrag führt — und die
 * Werkstattrolle, die unter „Unterlagen" nur nachschlagen darf, soll die
 * Zeichnungen des Hauses nicht mit einer Adresse verschicken können.
 *
 * Ohne Adresse wird nichts verschickt: Dann kommen die Links zurück und
 * stehen im Büro zum Weitergeben auf einem anderen Weg. Das ist kein
 * Nebenweg, sondern der Fall „ich schreibe die Mail selbst, mit Text".
 */
export async function POST(req: Request) {
  try {
    const payload = await payloadClient()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || !(await darf(payload, user, 'auftraege.bearbeiten'))) {
      return NextResponse.json({ error: 'nicht-erlaubt' }, { status: 403 })
    }

    const b = (await req.json()) as {
      dateien?: (number | string)[]
      an?: string
      betreff?: string
      notiz?: string
    }

    const kennungen = (b.dateien ?? []).map((d) => String(d)).filter(Boolean)
    if (kennungen.length === 0) return NextResponse.json({ error: 'keine-datei' }, { status: 400 })
    if (kennungen.length > MAX_JE_NACHRICHT) {
      return NextResponse.json({ error: 'zu-viele' }, { status: 400 })
    }

    const { docs } = await payload.find({
      collection: 'product-files',
      where: { id: { in: kennungen } },
      limit: MAX_JE_NACHRICHT,
      depth: 0,
      overrideAccess: true,
    })
    /*
     * Nur Dateien, die es auch gibt. Ein Link auf eine gelöschte Kennung
     * wäre gültig unterschrieben und liefe trotzdem ins Leere — der
     * Empfänger stünde dann vor einer Fehlermeldung statt vor der Zeichnung.
     */
    const dateien = docs.filter((d) => (d as { filename?: string }).filename)
    if (dateien.length === 0) return NextResponse.json({ error: 'nicht-gefunden' }, { status: 404 })

    // Eine Ablaufzeit für alle Dateien dieser Nachricht — siehe `weitergabeLink`
    const bis = weitergabeBis()
    const links = dateien.map((d) => ({
      id: d.id,
      name: String((d as { label?: string; filename?: string }).label || (d as { filename?: string }).filename),
      url: weitergabeLink(d.id, bis),
    }))

    const an = String(b.an ?? '').trim()
    let verschickt = false

    if (an) {
      const einstellungen = await payload
        .findGlobal({ slug: 'site-settings', depth: 0 })
        .catch(() => null)
      const firma = firmenAngaben(einstellungen as never)

      const notiz = String(b.notiz ?? '').trim()
      const zeilen = links
        .map(
          (l) =>
            `<p style="margin:0 0 10px"><a href="${l.url}" style="color:#a86b3d">${l.name}</a></p>`,
        )
        .join('')

      const html = briefbogen(
        `
        <p>Guten Tag,</p>
        <p>anbei die Unterlagen zur Fertigung.</p>
        ${notiz ? `<p>${notiz.replace(/[<>]/g, '')}</p>` : ''}
        ${zeilen}
        <p style="color:#666">Die Links gelten ${WEITERGABE_TAGE} Tage und führen jeweils direkt
           zur Datei — ein Passwort brauchen Sie nicht. Sollte sich an einer Zeichnung noch etwas
           ändern, bleibt der Link derselbe und führt zum neuen Stand.</p>
      `,
        firma,
      )

      try {
        await sendMail(payload, {
          to: an,
          subject: b.betreff?.trim() || 'Unterlagen zur Fertigung',
          html,
          art: 'sonstiges',
        })
        verschickt = true
      } catch (err) {
        payload.logger.error({ err }, 'Weitergabe konnte nicht verschickt werden')
      }
    }

    return NextResponse.json({ ok: true, links, bis: new Date(bis).toISOString(), verschickt })
  } catch (err) {
    console.error('Weitergabe fehlgeschlagen:', err)
    return NextResponse.json({ error: 'fehlgeschlagen' }, { status: 500 })
  }
}
