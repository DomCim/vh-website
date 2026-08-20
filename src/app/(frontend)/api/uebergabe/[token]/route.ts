import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

import { payloadClient } from '../../../../../lib/data'
import { benutzungVermerken, dateienFuerKunden, zugriffZuToken } from '../../../../../lib/mappenZugang'
import { ipAus, zuVieleAnfragen } from '../../../../../lib/rateLimit'
import {
  mappenSitzung,
  mappenSitzungLesen,
  ordnerName,
  passwortStimmt,
  UEBERGABE_COOKIE,
} from '../../../../../lib/uebergabe'

export const dynamic = 'force-dynamic'

/**
 * Die Übergabemappe von außen — anmelden und nachsehen.
 *
 * Was hier gilt und in jeder Antwort gleich aussehen muss: **abgelaufen,
 * zurückgezogen und nie dagewesen sind dasselbe.** Wer eine Kennung errät,
 * soll nicht daran erkennen können, dass es sie gibt.
 *
 * Nach dem Passwort steht ein signiertes Cookie für genau diese Mappe. Es
 * läuft nie länger als der Zugang selbst — ein abgelaufener Link darf nicht
 * über ein Cookie weiterleben.
 */

/** Der Zugang gilt und der Besucher hat sich angemeldet — sonst `null`. */
async function angemeldet(token: string) {
  const payload = await payloadClient()
  const zugriff = await zugriffZuToken(payload, token)
  if (!zugriff) return null
  const sitzung = mappenSitzungLesen((await cookies()).get(UEBERGABE_COOKIE)?.value)
  if (sitzung !== token) return null
  return { payload, ...zugriff }
}

/** Was der Auftraggeber von seiner Mappe zu sehen bekommt. */
async function mappenBild(payload: Awaited<ReturnType<typeof payloadClient>>, mappe: never) {
  const m = mappe as {
    id: number | string
    title?: string | null
    folders?: { name?: string | null }[] | null
    geschlossen?: boolean | null
  }
  const dateien = await dateienFuerKunden(payload, m.id)
  return {
    titel: m.title ?? 'Übergabemappe',
    geschlossen: Boolean(m.geschlossen),
    ordner: (m.folders ?? []).map((o) => String(o.name ?? '')).filter(Boolean),
    dateien: dateien.map((d) => ({
      id: d.id,
      ordner: d.folder ?? '',
      name: d.label || d.filename || 'Datei',
      groesse: d.filesize ?? 0,
      // „Von uns" heißt: Vincent hat sie bereitgestellt — das ist der
      // Unterschied, auf den es beim Nachsehen ankommt
      vonUns: d.herkunft !== 'kunde',
      bemerkung: d.note ?? null,
      am: d.createdAt ?? null,
    })),
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params
    const sitzung = await angemeldet(token)
    if (!sitzung) return NextResponse.json({ error: 'kein-zugang' }, { status: 401 })
    return NextResponse.json(await mappenBild(sitzung.payload, sitzung.mappe as never))
  } catch (err) {
    console.error('Übergabemappe lesen fehlgeschlagen:', err)
    return NextResponse.json({ error: 'fehlgeschlagen' }, { status: 500 })
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params
    const b = (await req.json()) as Record<string, unknown>

    // ── Anmelden ──────────────────────────────────────────────────────────
    if (b.aktion === 'anmelden') {
      /*
       * Zehn Versuche je Viertelstunde, gezählt an Kennung **und** Adresse.
       *
       * Acht Stellen aus 31 Zeichen sind rund 10^12 Möglichkeiten; mit dieser
       * Bremse käme ein Angreifer in einem Jahr auf einige Hunderttausend
       * Versuche. Der Zugang gilt sieben Tage.
       */
      if (zuVieleAnfragen(`uebergabe:${token}:${ipAus(req)}`, 10, 15 * 60 * 1000)) {
        return NextResponse.json({ error: 'zu-viele-versuche' }, { status: 429 })
      }

      const payload = await payloadClient()
      const zugriff = await zugriffZuToken(payload, token)
      if (!zugriff || !passwortStimmt(String(b.passwort ?? ''), zugriff.zugang.passwort)) {
        // Ein einziger Fehlertext für „Kennung gibt es nicht", „abgelaufen"
        // und „Passwort falsch" — siehe oben
        return NextResponse.json({ error: 'kein-zugang' }, { status: 401 })
      }

      await benutzungVermerken(payload, zugriff.mappe, token)

      const keks = mappenSitzung(token, zugriff.zugang.gueltigBis ?? new Date().toISOString())
      const antwort = NextResponse.json(await mappenBild(payload, zugriff.mappe as never))
      antwort.cookies.set(keks.name, keks.wert, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: keks.maxAge,
      })
      return antwort
    }

    const sitzung = await angemeldet(token)
    if (!sitzung) return NextResponse.json({ error: 'kein-zugang' }, { status: 401 })

    // ── Einen Ordner anlegen ──────────────────────────────────────────────
    if (b.aktion === 'ordner-anlegen') {
      const mappe = sitzung.mappe as { id: number | string; folders?: { name?: string | null }[] | null; geschlossen?: boolean | null }
      if (mappe.geschlossen) return NextResponse.json({ error: 'geschlossen' }, { status: 400 })

      const bisher = (mappe.folders ?? []).map((o) => ({ name: String(o.name ?? '') }))
      const name = ordnerName(b.name)
      if (!name) return NextResponse.json({ error: 'kein-name' }, { status: 400 })
      // Ein Ordner mehr ist harmlos, hundert sind eine Ablage, die niemand
      // mehr überblickt — und ein bequemer Weg, die Mappe zuzumüllen
      if (bisher.length >= 30) return NextResponse.json({ error: 'zu-viele' }, { status: 400 })
      if (bisher.some((o) => o.name === name)) {
        return NextResponse.json({ error: 'gibt-es-schon' }, { status: 400 })
      }
      await sitzung.payload.update({
        collection: 'customer-uploads',
        id: mappe.id,
        overrideAccess: true,
        data: { folders: [...bisher, { name }] },
      })
      return NextResponse.json({ ok: true, name })
    }

    return NextResponse.json({ error: 'unbekannte-aktion' }, { status: 400 })
  } catch (err) {
    console.error('Übergabemappe fehlgeschlagen:', err)
    return NextResponse.json({ error: 'fehlgeschlagen' }, { status: 500 })
  }
}
