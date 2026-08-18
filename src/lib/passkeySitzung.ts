import { createHmac, timingSafeEqual } from 'crypto'

/**
 * Sitzung nach einer Anmeldung per Passkey.
 *
 * Payloads eigenes Anmelde-Token entsteht nur aus E-Mail und Passwort — bei
 * Face ID gibt es beides nicht. Deshalb ein eigenes, signiertes Cookie und
 * eine Anmeldestrategie, die es liest (siehe collections/Users.ts). Für den
 * Rest des Systems ist der Benutzer damit ganz normal angemeldet: Admin,
 * Büro und Schnittstellen sehen keinen Unterschied.
 *
 * Bewusst ohne Sitzungstabelle: Das Cookie trägt Benutzer, Ablauf und eine
 * Signatur mit dem Serverschlüssel. Wer das Passwort ändert, ändert damit
 * auch die abgeleitete Signatur — alte Cookies sind dann wertlos, genau wie
 * bei Payloads eigenem Token.
 */

export const PASSKEY_COOKIE = 'vh-passkey'

/** Eine Woche, wie bei der Anmeldung mit Passwort */
export const PASSKEY_GUELTIG_SEKUNDEN = 7 * 24 * 60 * 60

function geheimnis(): string {
  const wert = process.env.PAYLOAD_SECRET
  if (!wert) throw new Error('PAYLOAD_SECRET fehlt')
  return wert
}

function signieren(nutzlast: string): string {
  return createHmac('sha256', geheimnis()).update(nutzlast).digest('hex')
}

/**
 * Der Anker: Ändert sich das Passwort (oder wird das Konto gesperrt), ändert
 * sich dieser Wert — und alle ausgestellten Cookies sind ungültig.
 */
export function sitzungsAnker(benutzer: { hash?: unknown; salt?: unknown; updatedAt?: unknown }): string {
  return createHmac('sha256', geheimnis())
    .update(String(benutzer.salt ?? ''))
    .update(String(benutzer.hash ?? ''))
    .digest('hex')
    .slice(0, 16)
}

export function passkeySitzungErzeugen(
  benutzerId: number | string,
  anker: string,
): { name: string; wert: string; maxAge: number } {
  const ablauf = Date.now() + PASSKEY_GUELTIG_SEKUNDEN * 1000
  const nutzlast = `${benutzerId}|${anker}|${ablauf}`
  return {
    name: PASSKEY_COOKIE,
    wert: `${Buffer.from(nutzlast).toString('base64url')}.${signieren(nutzlast)}`,
    maxAge: PASSKEY_GUELTIG_SEKUNDEN,
  }
}

export type PasskeySitzung = { benutzerId: string; anker: string; ablauf: number }

export function passkeySitzungLesen(cookieWert: string | undefined): PasskeySitzung | null {
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

  const [benutzerId, anker, ablauf] = nutzlast.split('|')
  if (!benutzerId || !anker || !ablauf) return null
  if (Number(ablauf) < Date.now()) return null

  return { benutzerId, anker, ablauf: Number(ablauf) }
}

/** Cookie-Einstellungen — dieselben wie bei Payloads eigenem Anmelde-Cookie */
export function cookieOptionen() {
  return {
    path: '/',
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
  }
}
