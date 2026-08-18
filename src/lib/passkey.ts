import { createHmac, randomBytes, timingSafeEqual } from 'crypto'

import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server'
import type { Payload } from 'payload'

/**
 * Anmelden mit Face ID, Fingerabdruck oder Geräte-PIN (WebAuthn/Passkeys).
 *
 * Warum überhaupt? Weil die Werkstatt sonst zweimal tippt: langes Passwort
 * plus sechsstelliger Code aus der Authenticator-App, an einem Handy, mit
 * Handschuhen daneben. Ein Passkey ist beides in einem — der Schlüssel liegt
 * im Gerät und wird erst nach Gesicht, Finger oder PIN herausgegeben. Er
 * lässt sich nicht abtippen, nicht abfischen und nicht auf einer falschen
 * Seite eingeben: Der Browser gibt ihn nur an die Adresse heraus, für die er
 * angelegt wurde.
 *
 * Wie die Zwei-Faktor-Anmeldung wird das je Benutzer eingerichtet, und wie
 * dort bleibt der Weg über Passwort offen — ein Gerät kann kaputtgehen.
 */

const NAME = 'Vincent Hellmann'

/** Woher die Anfrage kommen muss — daran bindet der Browser den Schlüssel. */
export function herkunft(): string {
  return (process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000').replace(/\/$/, '')
}

export function rpId(): string {
  try {
    return new URL(herkunft()).hostname
  } catch {
    return 'localhost'
  }
}

// ── Aufgabe zwischenspeichern ───────────────────────────────────────────────

/**
 * Die „Challenge" muss zwischen zwei Aufrufen überleben, ohne dass es dafür
 * eine Tabelle braucht: Sie wandert signiert in ein kurzlebiges Cookie. Fünf
 * Minuten reichen für jeden Fingerabdruck.
 */
export const AUFGABE_COOKIE = 'vh-passkey-aufgabe'
const AUFGABE_GUELTIG_MS = 5 * 60 * 1000

function geheimnis(): string {
  const wert = process.env.PAYLOAD_SECRET
  if (!wert) throw new Error('PAYLOAD_SECRET fehlt')
  return wert
}

export function aufgabeVerpacken(aufgabe: string, zweck: 'anmelden' | 'anlegen'): string {
  const nutzlast = `${zweck}|${aufgabe}|${Date.now() + AUFGABE_GUELTIG_MS}`
  const signatur = createHmac('sha256', geheimnis()).update(nutzlast).digest('hex')
  return `${Buffer.from(nutzlast).toString('base64url')}.${signatur}`
}

export function aufgabeAuspacken(
  wert: string | undefined,
  zweck: 'anmelden' | 'anlegen',
): string | null {
  if (!wert) return null
  const [teil, signatur] = wert.split('.')
  if (!teil || !signatur) return null

  let nutzlast: string
  try {
    nutzlast = Buffer.from(teil, 'base64url').toString()
  } catch {
    return null
  }

  const erwartet = createHmac('sha256', geheimnis()).update(nutzlast).digest('hex')
  if (
    erwartet.length !== signatur.length ||
    !timingSafeEqual(Buffer.from(erwartet), Buffer.from(signatur))
  ) {
    return null
  }

  const [gespeicherterZweck, aufgabe, ablauf] = nutzlast.split('|')
  if (gespeicherterZweck !== zweck || !aufgabe || Number(ablauf) < Date.now()) return null
  return aufgabe
}

// ── Datenmodell ─────────────────────────────────────────────────────────────

export type GespeicherterPasskey = {
  id?: string | null
  credentialId: string
  publicKey: string
  counter?: number | null
  transports?: string | null
  label?: string | null
  lastUsedAt?: string | null
}

type BenutzerMitPasskeys = {
  id: number | string
  email: string
  name?: string | null
  passkeys?: GespeicherterPasskey[] | null
}

// ── Anlegen ─────────────────────────────────────────────────────────────────

export async function anlegenStarten(benutzer: BenutzerMitPasskeys) {
  const optionen = await generateRegistrationOptions({
    rpName: NAME,
    rpID: rpId(),
    // Die Kennung darf sich nie ändern, sonst entstehen doppelte Passkeys
    userID: new TextEncoder().encode(String(benutzer.id)),
    userName: benutzer.email,
    userDisplayName: benutzer.name || benutzer.email,
    attestationType: 'none',
    // Bereits hinterlegte Geräte ausschließen — sonst legt dasselbe Handy
    // stillschweigend einen zweiten Schlüssel an
    excludeCredentials: (benutzer.passkeys ?? []).map((p) => ({ id: p.credentialId })),
    authenticatorSelection: {
      // Der Schlüssel soll im Gerät bleiben (Secure Enclave, TPM, Schlüsselbund)
      residentKey: 'preferred',
      userVerification: 'required',
    },
  })
  return optionen
}

export async function anlegenPruefen(
  payload: Payload,
  benutzer: BenutzerMitPasskeys,
  antwort: Parameters<typeof verifyRegistrationResponse>[0]['response'],
  aufgabe: string,
  bezeichnung?: string,
): Promise<GespeicherterPasskey> {
  const ergebnis = await verifyRegistrationResponse({
    response: antwort,
    expectedChallenge: aufgabe,
    expectedOrigin: herkunft(),
    expectedRPID: rpId(),
    requireUserVerification: true,
  })

  if (!ergebnis.verified || !ergebnis.registrationInfo) {
    throw new Error('nicht-bestaetigt')
  }

  const { credential } = ergebnis.registrationInfo
  const neuer: GespeicherterPasskey = {
    credentialId: credential.id,
    publicKey: Buffer.from(credential.publicKey).toString('base64url'),
    counter: credential.counter,
    transports: credential.transports?.join(',') ?? null,
    label: bezeichnung?.trim() || 'Dieses Gerät',
    lastUsedAt: new Date().toISOString(),
  }

  await payload.update({
    collection: 'users',
    id: benutzer.id,
    overrideAccess: true,
    data: { passkeys: [...(benutzer.passkeys ?? []), neuer] },
  })

  return neuer
}

// ── Anmelden ────────────────────────────────────────────────────────────────

/**
 * Ohne bekannte Adresse werden keine Schlüssel vorgegeben: Das Gerät bietet
 * dann selbst an, welcher Passkey passt („usernameless"). Genau so soll es
 * sich anfühlen — Knopf drücken, Gesicht zeigen, drin sein.
 */
export async function anmeldenStarten(payload: Payload, email?: string | null) {
  let erlaubte: { id: string; transports?: AuthenticatorTransportZulassung[] }[] | undefined

  if (email) {
    const { docs } = await payload.find({
      collection: 'users',
      where: { email: { equals: email.trim().toLowerCase() } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
      showHiddenFields: true,
    })
    const benutzer = docs[0] as BenutzerMitPasskeys | undefined
    erlaubte = (benutzer?.passkeys ?? []).map((p) => ({
      id: p.credentialId,
      transports: p.transports
        ? (p.transports.split(',') as AuthenticatorTransportZulassung[])
        : undefined,
    }))
  }

  return generateAuthenticationOptions({
    rpID: rpId(),
    userVerification: 'required',
    ...(erlaubte?.length ? { allowCredentials: erlaubte } : {}),
  })
}

type AuthenticatorTransportZulassung = 'ble' | 'cable' | 'hybrid' | 'internal' | 'nfc' | 'smart-card' | 'usb'

export async function anmeldenPruefen(
  payload: Payload,
  antwort: Parameters<typeof verifyAuthenticationResponse>[0]['response'],
  aufgabe: string,
): Promise<{ benutzer: Record<string, any>; passkey: GespeicherterPasskey }> {
  const kennung = antwort.id
  if (!kennung) throw new Error('ohne-kennung')

  // Den Benutzer über den verwendeten Schlüssel finden
  const { docs } = await payload.find({
    collection: 'users',
    where: { 'passkeys.credentialId': { equals: kennung } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    showHiddenFields: true,
  })
  const benutzer = docs[0] as (BenutzerMitPasskeys & Record<string, any>) | undefined
  const passkey = benutzer?.passkeys?.find((p) => p.credentialId === kennung)
  if (!benutzer || !passkey) throw new Error('unbekannt')

  const ergebnis = await verifyAuthenticationResponse({
    response: antwort,
    expectedChallenge: aufgabe,
    expectedOrigin: herkunft(),
    expectedRPID: rpId(),
    requireUserVerification: true,
    credential: {
      id: passkey.credentialId,
      publicKey: new Uint8Array(Buffer.from(passkey.publicKey, 'base64url')),
      counter: passkey.counter ?? 0,
      transports: passkey.transports
        ? (passkey.transports.split(',') as AuthenticatorTransportZulassung[])
        : undefined,
    },
  })

  if (!ergebnis.verified) throw new Error('nicht-bestaetigt')

  // Zähler fortschreiben — er verrät geklonte Schlüssel
  await payload.update({
    collection: 'users',
    id: benutzer.id,
    overrideAccess: true,
    data: {
      passkeys: (benutzer.passkeys ?? []).map((p) =>
        p.credentialId === kennung
          ? {
              ...p,
              counter: ergebnis.authenticationInfo.newCounter,
              lastUsedAt: new Date().toISOString(),
            }
          : p,
      ),
    },
  })

  return { benutzer, passkey }
}

/** Zufälliger Name, falls jemand keinen vergibt */
export function geraeteName(kopfzeile: string | null): string {
  const ua = kopfzeile ?? ''
  if (/iPhone/i.test(ua)) return 'iPhone'
  if (/iPad/i.test(ua)) return 'iPad'
  if (/Android/i.test(ua)) return 'Android-Gerät'
  if (/Macintosh/i.test(ua)) return 'Mac'
  if (/Windows/i.test(ua)) return 'Windows-Rechner'
  return `Gerät ${randomBytes(2).toString('hex')}`
}
