import { APIError, type CollectionBeforeLoginHook, type Payload } from 'payload'

import { codePruefen, hashCode } from './totp'

const COOKIE = 'vh-mfa-code'

/** Liest den Zwei-Faktor-Code aus dem Anmeldeformular bzw. dem Begleit-Cookie. */
function codeAusAnfrage(req: {
  data?: Record<string, unknown>
  headers: { get(name: string): string | null }
}): string | null {
  const ausDaten = req.data?.code ?? req.data?.mfaCode
  if (typeof ausDaten === 'string' && ausDaten.trim()) return ausDaten.trim()

  const cookies = req.headers.get('cookie') ?? ''
  const treffer = cookies.split(';').find((c) => c.trim().startsWith(`${COOKIE}=`))
  if (!treffer) return null
  return decodeURIComponent(treffer.split('=').slice(1).join('=')).trim() || null
}

/**
 * Verlangt beim Anmelden einen Zwei-Faktor-Code, sobald der Benutzer ihn
 * eingerichtet hat. Payload bringt kein MFA mit — deshalb hier über den
 * beforeLogin-Hook.
 */
export const mfaBeimLogin: CollectionBeforeLoginHook = async ({ req, user }) => {
  const konto = user as unknown as {
    id: number | string
    mfaEnabled?: boolean | null
    mfaSecret?: string | null
    mfaBackupCodes?: { hash?: string | null }[] | null
  }
  if (!konto?.mfaEnabled || !konto.mfaSecret) return user

  const code = codeAusAnfrage(req)
  if (!code) {
    throw new APIError('Zwei-Faktor-Code fehlt — bitte den 6-stelligen Code aus der App eingeben.', 401)
  }

  if (codePruefen(konto.mfaSecret, code)) return user

  // Ersatzcode? Wird nach Gebrauch entwertet.
  const gehasht = hashCode(code)
  const rest = (konto.mfaBackupCodes ?? []).filter((c) => c.hash && c.hash !== gehasht)
  if (rest.length !== (konto.mfaBackupCodes ?? []).length) {
    await req.payload.update({
      collection: 'users',
      id: konto.id,
      data: { mfaBackupCodes: rest },
      overrideAccess: true,
    })
    return user
  }

  throw new APIError('Zwei-Faktor-Code ist falsch oder abgelaufen.', 401)
}

/** Ist für mindestens einen Benutzer MFA aktiv? Für Hinweise im Backend. */
export async function mfaIrgendwoAktiv(payload: Payload): Promise<boolean> {
  const { totalDocs } = await payload.count({
    collection: 'users',
    where: { mfaEnabled: { equals: true } },
    overrideAccess: true,
  })
  return totalDocs > 0
}

export const MFA_COOKIE = COOKIE
