import { NextResponse } from 'next/server'

import { payloadClient } from '../../../../../lib/data'

export const dynamic = 'force-dynamic'

/**
 * Benutzerverwaltung im Büro.
 *
 * Konten anlegen, Rollen setzen, Passwörter zurücksetzen, Passkeys abmelden —
 * bisher alles nur im Admin-Panel. Es gehört aber zum Betrieb und nicht zur
 * Website.
 *
 * Zwei Sperren sind eingebaut, und beide schützen vor demselben Missgeschick:
 * Man kann sich nicht selbst löschen, und der letzte Inhaber bleibt Inhaber.
 * Ohne das wäre man mit einem Klick aus dem eigenen Haus ausgesperrt — und
 * niemand könnte einen wieder hereinlassen.
 */

type Aktion = 'anlegen' | 'aendern' | 'passwort' | 'loeschen' | 'passkey-entfernen'

async function wache(req: Request) {
  const payload = await payloadClient()
  const { user } = await payload.auth({ headers: req.headers })
  if (!user || (user as { role?: string }).role !== 'inhaber') return { payload, user: null }
  return { payload, user }
}

/** Wie viele Inhaber gibt es noch außer diesem einen? */
async function andereInhaber(
  payload: Awaited<ReturnType<typeof payloadClient>>,
  ausser: string | number,
): Promise<number> {
  const { totalDocs } = await payload.find({
    collection: 'users',
    where: { and: [{ role: { equals: 'inhaber' } }, { id: { not_equals: ausser } }] },
    limit: 0,
    depth: 0,
    overrideAccess: true,
  })
  return totalDocs
}

export async function GET(req: Request) {
  const { payload, user } = await wache(req)
  if (!user) return NextResponse.json({ error: 'nicht-erlaubt' }, { status: 403 })

  const { docs } = await payload.find({
    collection: 'users',
    sort: 'email',
    limit: 100,
    depth: 0,
    overrideAccess: true,
  })

  return NextResponse.json({
    ich: user.id,
    benutzer: docs.map((k) => {
      const konto = k as unknown as Record<string, unknown>
      return {
        id: konto.id,
        email: konto.email,
        name: konto.name ?? '',
        role: konto.role ?? 'redaktion',
        mfaEnabled: Boolean(konto.mfaEnabled),
        passkeys: ((konto.passkeys as { credentialId: string; label?: string }[]) ?? []).map(
          (p) => ({ credentialId: p.credentialId, label: p.label ?? 'Gerät' }),
        ),
      }
    }),
  })
}

export async function POST(req: Request) {
  const { payload, user } = await wache(req)
  if (!user) return NextResponse.json({ error: 'nicht-erlaubt' }, { status: 403 })

  try {
    const b = (await req.json()) as {
      aktion?: Aktion
      id?: string | number
      email?: string
      name?: string
      role?: string
      passwort?: string
      mfaEnabled?: boolean
      credentialId?: string
    }

    if (b.aktion === 'anlegen') {
      if (!b.email?.trim() || !b.passwort || b.passwort.length < 8) {
        return NextResponse.json({ error: 'unvollstaendig' }, { status: 400 })
      }
      const doc = await payload.create({
        collection: 'users',
        overrideAccess: true,
        data: {
          email: b.email.trim(),
          password: b.passwort,
          name: b.name?.trim() || undefined,
          role: (b.role as 'inhaber' | 'redaktion') || 'redaktion',
        },
      })
      return NextResponse.json({ ok: true, id: doc.id })
    }

    if (!b.id) return NextResponse.json({ error: 'unvollstaendig' }, { status: 400 })
    const eigenes = String(b.id) === String(user.id)

    if (b.aktion === 'loeschen') {
      if (eigenes) return NextResponse.json({ error: 'nicht-sich-selbst' }, { status: 400 })
      if (!(await andereInhaber(payload, b.id))) {
        return NextResponse.json({ error: 'letzter-inhaber' }, { status: 400 })
      }
      await payload.delete({ collection: 'users', id: b.id, overrideAccess: true })
      return NextResponse.json({ ok: true })
    }

    if (b.aktion === 'passwort') {
      if (!b.passwort || b.passwort.length < 8) {
        return NextResponse.json({ error: 'passwort-zu-kurz' }, { status: 400 })
      }
      await payload.update({
        collection: 'users',
        id: b.id,
        overrideAccess: true,
        data: { password: b.passwort },
      })
      return NextResponse.json({ ok: true })
    }

    if (b.aktion === 'passkey-entfernen') {
      const konto = (await payload.findByID({
        collection: 'users',
        id: b.id,
        depth: 0,
        overrideAccess: true,
        showHiddenFields: true,
      })) as Record<string, any>
      const rest = (konto.passkeys ?? []).filter(
        (p: { credentialId: string }) => p.credentialId !== b.credentialId,
      )
      await payload.update({
        collection: 'users',
        id: b.id,
        overrideAccess: true,
        data: { passkeys: rest },
      })
      return NextResponse.json({ ok: true })
    }

    if (b.aktion === 'aendern') {
      // Sich selbst die Inhaberrolle zu nehmen, während man der letzte ist,
      // sperrt das Haus zu — dasselbe gilt für einen fremden letzten Inhaber.
      if (b.role && b.role !== 'inhaber' && !(await andereInhaber(payload, b.id))) {
        return NextResponse.json({ error: 'letzter-inhaber' }, { status: 400 })
      }

      const daten: Record<string, unknown> = {}
      if (typeof b.name === 'string') daten.name = b.name.trim() || null
      if (b.role) daten.role = b.role
      if (typeof b.mfaEnabled === 'boolean' && b.mfaEnabled === false) {
        // Abschalten geht von hier — einschalten muss der Betroffene selbst,
        // dafür braucht es sein Gerät.
        daten.mfaEnabled = false
        daten.mfaSecret = null
        daten.mfaPendingSecret = null
        daten.mfaBackupCodes = []
      }

      await payload.update({ collection: 'users', id: b.id, overrideAccess: true, data: daten })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'unbekannte-aktion' }, { status: 400 })
  } catch (err) {
    console.error('Benutzerverwaltung fehlgeschlagen:', err)
    const text = err instanceof Error ? err.message : ''
    return NextResponse.json(
      { error: /email/i.test(text) ? 'email-vergeben' : 'fehlgeschlagen' },
      { status: 500 },
    )
  }
}
