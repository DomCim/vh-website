import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto'

/**
 * TOTP nach RFC 6238 (SHA-1, 6 Stellen, 30 Sekunden) — kompatibel mit
 * Google Authenticator, Microsoft Authenticator, 1Password, Aegis usw.
 * Bewusst ohne zusätzliche Abhängigkeit, es sind nur wenige Zeilen.
 */

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const STELLEN = 6
const FENSTER_SEKUNDEN = 30

export function geheimnisErzeugen(bytes = 20): string {
  const roh = randomBytes(bytes)
  let bits = ''
  for (const b of roh) bits += b.toString(2).padStart(8, '0')
  let out = ''
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    out += BASE32[parseInt(bits.slice(i, i + 5), 2)]
  }
  return out
}

function base32Dekodieren(geheim: string): Buffer {
  const sauber = geheim.toUpperCase().replace(/[^A-Z2-7]/g, '')
  let bits = ''
  for (const zeichen of sauber) {
    const wert = BASE32.indexOf(zeichen)
    if (wert < 0) continue
    bits += wert.toString(2).padStart(5, '0')
  }
  const bytes: number[] = []
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2))
  }
  return Buffer.from(bytes)
}

function codeFuerZaehler(geheim: string, zaehler: number): string {
  const puffer = Buffer.alloc(8)
  puffer.writeBigUInt64BE(BigInt(zaehler))
  const hmac = createHmac('sha1', base32Dekodieren(geheim)).update(puffer).digest()
  const versatz = hmac[hmac.length - 1] & 0x0f
  const zahl =
    ((hmac[versatz] & 0x7f) << 24) |
    ((hmac[versatz + 1] & 0xff) << 16) |
    ((hmac[versatz + 2] & 0xff) << 8) |
    (hmac[versatz + 3] & 0xff)
  return String(zahl % 10 ** STELLEN).padStart(STELLEN, '0')
}

/**
 * Prüft einen eingegebenen Code. Das Toleranzfenster von ±1 Schritt fängt
 * abweichende Uhren und langsames Tippen ab.
 */
export function codePruefen(geheim: string, eingabe: string, toleranz = 1): boolean {
  const code = eingabe.replace(/\D/g, '')
  if (code.length !== STELLEN) return false
  const jetzt = Math.floor(Date.now() / 1000 / FENSTER_SEKUNDEN)
  for (let v = -toleranz; v <= toleranz; v++) {
    const erwartet = codeFuerZaehler(geheim, jetzt + v)
    if (
      erwartet.length === code.length &&
      timingSafeEqual(Buffer.from(erwartet), Buffer.from(code))
    ) {
      return true
    }
  }
  return false
}

/** otpauth-URI zum Einscannen in der Authenticator-App */
export function otpauthUri(geheim: string, konto: string, herausgeber = 'Vincent Hellmann'): string {
  const label = encodeURIComponent(`${herausgeber}:${konto}`)
  const params = new URLSearchParams({
    secret: geheim,
    issuer: herausgeber,
    algorithm: 'SHA1',
    digits: String(STELLEN),
    period: String(FENSTER_SEKUNDEN),
  })
  return `otpauth://totp/${label}?${params.toString()}`
}

/** Ersatzcodes für den Fall, dass das Handy weg ist */
export function ersatzcodesErzeugen(anzahl = 8): string[] {
  return Array.from({ length: anzahl }, () =>
    randomBytes(5)
      .toString('hex')
      .toUpperCase()
      .replace(/(.{5})/, '$1-'),
  )
}

export const hashCode = (code: string): string =>
  createHash('sha256').update(code.trim().toUpperCase()).digest('hex')
