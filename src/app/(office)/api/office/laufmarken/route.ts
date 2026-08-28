import { NextResponse } from 'next/server'

import { payloadClient } from '../../../../../lib/data'
import { naechsterMarkenCode } from '../../../../../lib/nummernkreis'
import { schrittzeitEinstellung } from '../../../../../lib/laufmarken'
import { darf } from '../../../../../lib/wache'

export const dynamic = 'force-dynamic'

/**
 * Laufmarken verwalten: anlegen, an einen Auftrag koppeln, wieder freigeben.
 *
 * Koppeln und Entkoppeln schreiben auch den Verlauf — als Abschrift der
 * Auftragsnummer, damit die Geschichte einen später gelöschten Auftrag
 * übersteht. Der Verlauf bleibt im Haus; die Scan-API gibt ihn nie heraus.
 */
/**
 * Was die Scan-Seite über die Zeitbuchung wissen muss.
 *
 * Die zwei Schalter stehen in den Einstellungen (Gruppe `schrittzeit`), und
 * die Scan-Seite muss sie lesen — sie liegen aber hinter dem Recht
 * `einstellungen.aendern`, das ein Werkstatt-Konto zu Recht nicht hat.
 * Deshalb kommen sie hier heraus, mit demselben Recht, das den Scan erlaubt:
 * Zwei Wahrheitswerte sind nichts, was verborgen bleiben müsste.
 */
export async function GET(req: Request) {
  try {
    const payload = await payloadClient()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || !(await darf(payload, user, 'auftraege.bearbeiten'))) {
      return NextResponse.json({ error: 'nicht-erlaubt' }, { status: 403 })
    }
    return NextResponse.json({ schrittzeit: await schrittzeitEinstellung(payload) })
  } catch {
    // Fällt das aus, arbeitet die Scan-Seite mit ihren Vorgaben weiter
    return NextResponse.json({ error: 'fehlgeschlagen' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const payload = await payloadClient()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || !(await darf(payload, user, 'auftraege.bearbeiten'))) {
      return NextResponse.json({ error: 'nicht-erlaubt' }, { status: 403 })
    }

    const b = (await req.json()) as {
      aktion?: string
      anzahl?: number
      code?: string
      auftragId?: number
    }

    // ── Marken anlegen — je eine, fortlaufend nummeriert ───────────────────
    if (b.aktion === 'anlegen') {
      const anzahl = Math.min(50, Math.max(1, Number(b.anzahl) || 1))
      const codes: string[] = []
      for (let i = 0; i < anzahl; i += 1) {
        const code = await naechsterMarkenCode(payload)
        await payload.create({
          collection: 'job-tags',
          overrideAccess: true,
          data: { code },
        })
        codes.push(code)
      }
      return NextResponse.json({ ok: true, codes })
    }

    const marke = b.code
      ? (
          await payload.find({
            collection: 'job-tags',
            where: { code: { equals: b.code } },
            limit: 1,
            depth: 0,
            overrideAccess: true,
          })
        ).docs[0]
      : null

    // ── An einen Auftrag heften ────────────────────────────────────────────
    if (b.aktion === 'koppeln') {
      if (!marke || !b.auftragId) {
        return NextResponse.json({ error: 'unvollstaendig' }, { status: 400 })
      }
      /*
       * Eine Marke, ein Auftrag: Hinge sie an zweien, wüsste der Scan nicht,
       * wessen Schritt gemeint ist. Umgekehrt sind mehrere Marken je Auftrag
       * erlaubt — zwei Teile eines Auftrags können getrennt wandern.
       */
      if (marke.auftrag) {
        return NextResponse.json({ error: 'schon-vergeben' }, { status: 409 })
      }
      const auftrag = await payload
        .findByID({ collection: 'jobs', id: b.auftragId, depth: 0, overrideAccess: true })
        .catch(() => null)
      if (!auftrag) return NextResponse.json({ error: 'auftrag-fehlt' }, { status: 400 })

      const jetzt = new Date().toISOString()
      await payload.update({
        collection: 'job-tags',
        id: marke.id,
        overrideAccess: true,
        data: {
          auftrag: auftrag.id,
          gekoppeltAm: jetzt,
          verlauf: [
            ...((marke.verlauf ?? []) as { id?: string }[]),
            { jobNumber: auftrag.jobNumber ?? String(auftrag.id), gekoppeltAm: jetzt },
          ] as never,
        },
      })
      return NextResponse.json({ ok: true, code: marke.code, auftrag: auftrag.id })
    }

    // ── Wieder freigeben — die Marke hängt zurück an die Tafel ────────────
    if (b.aktion === 'entkoppeln') {
      if (!marke) return NextResponse.json({ error: 'unvollstaendig' }, { status: 400 })
      const verlauf = ((marke.verlauf ?? []) as Record<string, unknown>[]).map((z, i, alle) =>
        i === alle.length - 1 && !z.entkoppeltAm
          ? { ...z, entkoppeltAm: new Date().toISOString() }
          : z,
      )
      await payload.update({
        collection: 'job-tags',
        id: marke.id,
        overrideAccess: true,
        data: { auftrag: null, gekoppeltAm: null, verlauf: verlauf as never },
      })
      return NextResponse.json({ ok: true, code: marke.code })
    }

    return NextResponse.json({ error: 'unbekannte-aktion' }, { status: 400 })
  } catch (err) {
    console.error('Laufmarken-Verwaltung fehlgeschlagen:', err)
    return NextResponse.json({ error: 'fehlgeschlagen' }, { status: 500 })
  }
}
