import { createHmac, randomInt, timingSafeEqual } from 'crypto'
import type { Payload } from 'payload'

import { hashCode } from './totp'

const COOKIE = 'vh-konto'
const GUELTIG_TAGE = 30
const CODE_GUELTIG_MS = 10 * 60 * 1000
const MAX_VERSUCHE = 5

function geheimnis(): string {
  return process.env.PAYLOAD_SECRET || 'unsicher-nur-fuer-entwicklung'
}

function signieren(nutzlast: string): string {
  return createHmac('sha256', geheimnis()).update(nutzlast).digest('hex')
}

/** Signiertes Sitzungs-Cookie für das Kundenportal — ohne Sitzungstabelle */
export function sitzungErzeugen(email: string): { name: string; wert: string; maxAge: number } {
  const ablauf = Date.now() + GUELTIG_TAGE * 86400_000
  const nutzlast = `${email.toLowerCase()}|${ablauf}`
  return {
    name: COOKIE,
    wert: `${Buffer.from(nutzlast).toString('base64url')}.${signieren(nutzlast)}`,
    maxAge: GUELTIG_TAGE * 86400,
  }
}

/** Liefert die angemeldete E-Mail-Adresse oder null */
export function sitzungLesen(cookieWert: string | undefined): string | null {
  if (!cookieWert) return null
  const [teil, signatur] = cookieWert.split('.')
  if (!teil || !signatur) return null
  let nutzlast: string
  try {
    nutzlast = Buffer.from(teil, 'base64url').toString()
  } catch {
    return null
  }
  const erwartet = signieren(nutzlast)
  if (
    erwartet.length !== signatur.length ||
    !timingSafeEqual(Buffer.from(erwartet), Buffer.from(signatur))
  ) {
    return null
  }
  const [email, ablauf] = nutzlast.split('|')
  if (!email || !ablauf || Number(ablauf) < Date.now()) return null
  return email
}

export const SITZUNGS_COOKIE = COOKIE

/**
 * Legt einen sechsstelligen Anmeldecode an und gibt ihn im Klartext zurück
 * (nur zum Versenden — gespeichert wird ausschließlich der Hash).
 *
 * Bewusst kein Magic Link: Outlook/Safe Links ruft Links in E-Mails vorab auf
 * und würde einen Einmal-Link verbrauchen, bevor der Kunde ihn anklickt.
 */
export async function codeAnlegen(payload: Payload, email: string): Promise<string> {
  const adresse = email.toLowerCase().trim()

  // Alte und abgelaufene Codes derselben Adresse entwerten
  const { docs: alte } = await payload.find({
    collection: 'login-codes',
    where: { email: { equals: adresse } },
    limit: 20,
    depth: 0,
    overrideAccess: true,
  })
  for (const alt of alte) {
    await payload.delete({ collection: 'login-codes', id: alt.id, overrideAccess: true })
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
  await payload.create({
    collection: 'login-codes',
    overrideAccess: true,
    data: {
      email: adresse,
      codeHash: hashCode(code),
      expiresAt: new Date(Date.now() + CODE_GUELTIG_MS).toISOString(),
      attempts: 0,
    },
  })
  return code
}

export type CodePruefung = 'ok' | 'falsch' | 'abgelaufen' | 'gesperrt'

export async function codeEinloesen(
  payload: Payload,
  email: string,
  code: string,
): Promise<CodePruefung> {
  const adresse = email.toLowerCase().trim()
  const { docs } = await payload.find({
    collection: 'login-codes',
    where: { email: { equals: adresse } },
    sort: '-createdAt',
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const eintrag = docs[0]
  if (!eintrag) return 'abgelaufen'

  if (new Date(eintrag.expiresAt).getTime() < Date.now()) {
    await payload.delete({ collection: 'login-codes', id: eintrag.id, overrideAccess: true })
    return 'abgelaufen'
  }
  if ((eintrag.attempts ?? 0) >= MAX_VERSUCHE) return 'gesperrt'

  if (eintrag.codeHash !== hashCode(code)) {
    await payload.update({
      collection: 'login-codes',
      id: eintrag.id,
      overrideAccess: true,
      data: { attempts: (eintrag.attempts ?? 0) + 1 },
    })
    return 'falsch'
  }

  await payload.delete({ collection: 'login-codes', id: eintrag.id, overrideAccess: true })
  return 'ok'
}
