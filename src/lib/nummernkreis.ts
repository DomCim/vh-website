import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'

/**
 * Vergibt die nächste Nummer eines Nummernkreises.
 *
 * Das Hochzählen passiert in einer einzigen SQL-Anweisung. Damit können zwei
 * gleichzeitige Bestellungen nicht dieselbe Nummer bekommen — beim früheren
 * „Anzahl der Datensätze + 1" war genau das möglich, und nach dem Löschen
 * einer Bestellung wurde eine Nummer sogar sicher doppelt vergeben.
 *
 * Wichtig fürs Finanzamt: Die Nummer wird erst vergeben, wenn wirklich
 * abgerechnet wird — nicht schon beim Anlegen eines Entwurfs. Sonst reißen
 * abgebrochene Vorgänge Lücken in die Reihe.
 */
export async function naechsteNummer(payload: Payload, schluessel: string): Promise<number> {
  const db = payload.db as unknown as { drizzle: { execute: (q: unknown) => Promise<unknown> } }

  const ergebnis = (await db.drizzle.execute(sql`
    INSERT INTO counters ("key", last_number, updated_at, created_at)
    VALUES (${schluessel}, 1, now(), now())
    ON CONFLICT ("key") DO UPDATE SET last_number = counters.last_number + 1, updated_at = now()
    RETURNING last_number
  `)) as { rows?: { last_number: number | string }[] }

  const wert = ergebnis?.rows?.[0]?.last_number
  if (wert === undefined || wert === null) {
    throw new Error(`Nummernkreis "${schluessel}" konnte nicht hochgezählt werden`)
  }
  return Number(wert)
}

/** Bestellnummer, z.B. VH-2026-0042 */
export async function naechsteBestellnummer(payload: Payload): Promise<string> {
  const jahr = new Date().getFullYear()
  const nummer = await naechsteNummer(payload, `bestellung-${jahr}`)
  return `VH-${jahr}-${String(nummer).padStart(4, '0')}`
}

/** Rechnungsnummer fürs Projektgeschäft, z.B. RE-2026-0007 */
export async function naechsteRechnungsnummer(payload: Payload): Promise<string> {
  const jahr = new Date().getFullYear()
  const nummer = await naechsteNummer(payload, `rechnung-${jahr}`)
  return `RE-${jahr}-${String(nummer).padStart(4, '0')}`
}

/** Angebotsnummer, z.B. AN-2026-0003 */
export async function naechsteAngebotsnummer(payload: Payload): Promise<string> {
  const jahr = new Date().getFullYear()
  const nummer = await naechsteNummer(payload, `angebot-${jahr}`)
  return `AN-${jahr}-${String(nummer).padStart(4, '0')}`
}

/** Auftragsnummer, z.B. AU-2026-0012 */
export async function naechsteAuftragsnummer(payload: Payload): Promise<string> {
  const jahr = new Date().getFullYear()
  const nummer = await naechsteNummer(payload, `auftrag-${jahr}`)
  return `AU-${jahr}-${String(nummer).padStart(4, '0')}`
}
