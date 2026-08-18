import { NextResponse } from 'next/server'

import { payloadClient } from '../../../../lib/data'
import {
  anlegenPruefen,
  anlegenStarten,
  anmeldenPruefen,
  anmeldenStarten,
  aufgabeAuspacken,
  AUFGABE_COOKIE,
  aufgabeVerpacken,
  geraeteName,
} from '../../../../lib/passkey'
import { cookieOptionen, passkeySitzungErzeugen, sitzungsAnker } from '../../../../lib/passkeySitzung'
import { ipAus, zuVieleAnfragen } from '../../../../lib/rateLimit'

export const dynamic = 'force-dynamic'

/**
 * Anmelden und Einrichten per Passkey (Face ID, Fingerabdruck, Geräte-PIN).
 *
 * Vier Schritte, zwei Vorgänge: Anlegen geht nur angemeldet, Anmelden nur
 * mit einem Schlüssel, der zu einem hinterlegten Gerät passt. Die Aufgabe
 * („Challenge") reist zwischen beiden Schritten in einem kurzlebigen,
 * signierten Cookie — dafür braucht es keine Tabelle.
 */
export async function POST(req: Request) {
  try {
    const payload = await payloadClient()
    const koerper = (await req.json()) as {
      aktion?: 'anlegen-start' | 'anlegen-fertig' | 'anmelden-start' | 'anmelden-fertig' | 'entfernen'
      email?: string
      antwort?: never
      bezeichnung?: string
      credentialId?: string
    }

    const kekse = req.headers.get('cookie') ?? ''
    const aufgabenCookie = new RegExp(`(?:^|;\\s*)${AUFGABE_COOKIE}=([^;]+)`).exec(kekse)?.[1]

    // ── Einrichten (nur angemeldet) ─────────────────────────────────────────
    if (koerper.aktion === 'anlegen-start' || koerper.aktion === 'anlegen-fertig') {
      const { user } = await payload.auth({ headers: req.headers })
      if (!user) return NextResponse.json({ error: 'nicht-angemeldet' }, { status: 401 })

      const benutzer = (await payload.findByID({
        collection: 'users',
        id: user.id,
        depth: 0,
        overrideAccess: true,
      })) as Record<string, any>

      if (koerper.aktion === 'anlegen-start') {
        const optionen = await anlegenStarten(benutzer as never)
        const antwort = NextResponse.json({ ok: true, optionen })
        antwort.cookies.set(AUFGABE_COOKIE, aufgabeVerpacken(optionen.challenge, 'anlegen'), {
          ...cookieOptionen(),
          maxAge: 300,
        })
        return antwort
      }

      const aufgabe = aufgabeAuspacken(
        aufgabenCookie ? decodeURIComponent(aufgabenCookie) : undefined,
        'anlegen',
      )
      if (!aufgabe) return NextResponse.json({ error: 'aufgabe-abgelaufen' }, { status: 400 })

      const neuer = await anlegenPruefen(
        payload,
        benutzer as never,
        koerper.antwort as never,
        aufgabe,
        koerper.bezeichnung || geraeteName(req.headers.get('user-agent')),
      )

      const antwort = NextResponse.json({ ok: true, passkey: { label: neuer.label } })
      antwort.cookies.delete(AUFGABE_COOKIE)
      return antwort
    }

    // ── Entfernen (nur angemeldet) ──────────────────────────────────────────
    if (koerper.aktion === 'entfernen') {
      const { user } = await payload.auth({ headers: req.headers })
      if (!user) return NextResponse.json({ error: 'nicht-angemeldet' }, { status: 401 })

      const benutzer = (await payload.findByID({
        collection: 'users',
        id: user.id,
        depth: 0,
        overrideAccess: true,
      })) as Record<string, any>

      await payload.update({
        collection: 'users',
        id: user.id,
        overrideAccess: true,
        data: {
          passkeys: (benutzer.passkeys ?? []).filter(
            (p: { credentialId: string }) => p.credentialId !== koerper.credentialId,
          ),
        },
      })
      return NextResponse.json({ ok: true })
    }

    // ── Anmelden ────────────────────────────────────────────────────────────
    if (zuVieleAnfragen(`passkey:${ipAus(req)}`, 20, 10 * 60_000)) {
      return NextResponse.json({ error: 'zu-viele-versuche' }, { status: 429 })
    }

    if (koerper.aktion === 'anmelden-start') {
      const optionen = await anmeldenStarten(payload, koerper.email)
      const antwort = NextResponse.json({ ok: true, optionen })
      antwort.cookies.set(AUFGABE_COOKIE, aufgabeVerpacken(optionen.challenge, 'anmelden'), {
        ...cookieOptionen(),
        maxAge: 300,
      })
      return antwort
    }

    if (koerper.aktion === 'anmelden-fertig') {
      const aufgabe = aufgabeAuspacken(
        aufgabenCookie ? decodeURIComponent(aufgabenCookie) : undefined,
        'anmelden',
      )
      if (!aufgabe) return NextResponse.json({ error: 'aufgabe-abgelaufen' }, { status: 400 })

      const { benutzer } = await anmeldenPruefen(payload, koerper.antwort as never, aufgabe)

      // Der Passkey ist bereits zwei Faktoren in einem: das Gerät und das
      // Gesicht (oder der Finger). Ein zusätzlicher Code aus der
      // Authenticator-App brächte keine Sicherheit, nur Verdruss.
      const vollstaendig = (await payload.findByID({
        collection: 'users',
        id: benutzer.id,
        depth: 0,
        overrideAccess: true,
        showHiddenFields: true,
      })) as Record<string, any>

      const sitzung = passkeySitzungErzeugen(benutzer.id, sitzungsAnker(vollstaendig))
      const antwort = NextResponse.json({
        ok: true,
        benutzer: { email: benutzer.email, name: benutzer.name, role: benutzer.role },
      })
      antwort.cookies.set(sitzung.name, sitzung.wert, {
        ...cookieOptionen(),
        maxAge: sitzung.maxAge,
      })
      antwort.cookies.delete(AUFGABE_COOKIE)
      return antwort
    }

    return NextResponse.json({ error: 'unbekannte-aktion' }, { status: 400 })
  } catch (err) {
    const grund = err instanceof Error ? err.message : 'fehlgeschlagen'
    // „unbekannt" und „nicht-bestaetigt" sind erwartbare Ausgänge, kein Fehler
    if (!['unbekannt', 'nicht-bestaetigt', 'ohne-kennung'].includes(grund)) {
      console.error('Passkey fehlgeschlagen:', err)
    }
    return NextResponse.json({ error: grund }, { status: 400 })
  }
}
