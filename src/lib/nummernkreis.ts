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

/**
 * Die gemeinsame Nummer eines gestuften Auftrags, z.B. RE-2026-0042.
 *
 * Alle Rechnungen zu einem Auftrag teilen sich diese Nummer und
 * unterscheiden sich nur im Zusatz: `RE-2026-0042-1/3`, `-2/3`, `-3/3`. Wer
 * eine davon in der Hand hält, sieht sofort, wozu sie gehört und wie viele
 * es insgesamt sind — bei drei fortlaufenden Nummern quer durchs Jahr sieht
 * man das nicht.
 *
 * Die drei verbrauchen zusammen **eine** Nummer aus der laufenden Reihe. Das
 * ist die Absicht: Die Reihe bleibt lückenlos, und jede einzelne Rechnung
 * bleibt trotzdem eindeutig bezeichnet.
 */
export const naechsteRechnungsBasis = naechsteRechnungsnummer

/**
 * Die Nummer einer einzelnen Stufe.
 *
 * Der Nenner steht fest, sobald die erste Stufe gestellt ist — er darf sich
 * danach nicht mehr ändern. Eine Rechnung, die beim Kunden liegt, behält ihre
 * Nummer; würde aus `-1/2` nachträglich `-1/3`, gäbe es zwei Papiere mit
 * verschiedenen Nummern für denselben Vorgang, und beim Prüfen fehlt dann
 * eines von beiden.
 */
export function stufenNummer(basis: string, nummer: number, gesamt: number): string {
  return `${basis}-${nummer}/${gesamt}`
}

/**
 * Dieselbe Nummer, aber als Dateiname brauchbar.
 *
 * Der Schrägstrich gehört auf das Blatt und darf nicht in einen Dateinamen:
 * Dort trennt er Verzeichnisse. Aus `RE-2026-0042-1/3.pdf` würde sonst der
 * Versuch, in ein Verzeichnis `RE-2026-0042-1` zu schreiben, das es nicht
 * gibt — und im günstigen Fall scheitert das, im ungünstigen landet die Datei
 * irgendwo anders.
 */
export function alsDateiname(nummer: string): string {
  return nummer.replace(/\//g, '-von-')
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

/** Wareneingangsnummer, z.B. WE-2026-0007 */
export async function naechsteWareneingangsnummer(payload: Payload): Promise<string> {
  const jahr = new Date().getFullYear()
  const nummer = await naechsteNummer(payload, `wareneingang-${jahr}`)
  return `WE-${jahr}-${String(nummer).padStart(4, '0')}`
}
