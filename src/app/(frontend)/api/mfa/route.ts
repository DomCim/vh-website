import { NextResponse } from 'next/server'
import QRCode from 'qrcode'

import { payloadClient } from '../../../../lib/data'
import {
  codePruefen,
  ersatzcodesErzeugen,
  geheimnisErzeugen,
  hashCode,
  otpauthUri,
} from '../../../../lib/totp'

export const dynamic = 'force-dynamic'

type Aktion = 'start' | 'aktivieren' | 'deaktivieren' | 'ersatzcodes'

/**
 * Einrichtung der Zwei-Faktor-Anmeldung für das Admin-Backend.
 * Immer nur für den gerade angemeldeten Benutzer — niemand kann MFA
 * für ein fremdes Konto ändern.
 */
export async function POST(req: Request) {
  try {
    const payload = await payloadClient()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user) return NextResponse.json({ error: 'nicht angemeldet' }, { status: 401 })

    const body = (await req.json()) as { aktion?: Aktion; code?: string }
    const aktion = body.aktion
    const code = body.code?.trim() ?? ''

    const konto = (await payload.findByID({
      collection: 'users',
      id: user.id,
      overrideAccess: true,
      showHiddenFields: true,
      depth: 0,
    })) as Record<string, any>

    if (aktion === 'start') {
      if (konto.mfaEnabled) {
        return NextResponse.json({ error: 'bereits-aktiv' }, { status: 400 })
      }
      const geheim = geheimnisErzeugen()
      await payload.update({
        collection: 'users',
        id: user.id,
        overrideAccess: true,
        data: { mfaPendingSecret: geheim },
      })
      const uri = otpauthUri(geheim, String(user.email))
      const qr = await QRCode.toDataURL(uri, { margin: 1, width: 220 })
      return NextResponse.json({ geheim, uri, qr })
    }

    if (aktion === 'aktivieren') {
      const geheim = konto.mfaPendingSecret
      if (!geheim) return NextResponse.json({ error: 'keine-einrichtung' }, { status: 400 })
      if (!codePruefen(geheim, code)) {
        return NextResponse.json({ error: 'code-falsch' }, { status: 400 })
      }
      const ersatzcodes = ersatzcodesErzeugen()
      await payload.update({
        collection: 'users',
        id: user.id,
        overrideAccess: true,
        data: {
          mfaSecret: geheim,
          mfaPendingSecret: null,
          mfaEnabled: true,
          mfaBackupCodes: ersatzcodes.map((c) => ({ hash: hashCode(c) })),
        },
      })
      return NextResponse.json({ ok: true, ersatzcodes })
    }

    if (aktion === 'ersatzcodes') {
      if (!konto.mfaEnabled || !konto.mfaSecret) {
        return NextResponse.json({ error: 'nicht-aktiv' }, { status: 400 })
      }
      if (!codePruefen(konto.mfaSecret, code)) {
        return NextResponse.json({ error: 'code-falsch' }, { status: 400 })
      }
      const ersatzcodes = ersatzcodesErzeugen()
      await payload.update({
        collection: 'users',
        id: user.id,
        overrideAccess: true,
        data: { mfaBackupCodes: ersatzcodes.map((c) => ({ hash: hashCode(c) })) },
      })
      return NextResponse.json({ ok: true, ersatzcodes })
    }

    if (aktion === 'deaktivieren') {
      if (!konto.mfaEnabled || !konto.mfaSecret) {
        return NextResponse.json({ error: 'nicht-aktiv' }, { status: 400 })
      }
      if (!codePruefen(konto.mfaSecret, code)) {
        return NextResponse.json({ error: 'code-falsch' }, { status: 400 })
      }
      await payload.update({
        collection: 'users',
        id: user.id,
        overrideAccess: true,
        data: {
          mfaEnabled: false,
          mfaSecret: null,
          mfaPendingSecret: null,
          mfaBackupCodes: [],
        },
      })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'unbekannte-aktion' }, { status: 400 })
  } catch (err) {
    console.error('MFA-Einrichtung fehlgeschlagen:', err)
    return NextResponse.json({ error: 'fehlgeschlagen' }, { status: 500 })
  }
}
