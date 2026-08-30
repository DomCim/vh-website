import { randomBytes } from 'crypto'

import type { Payload } from 'payload'

/**
 * Der Zugang zum Kalender von außen — ein Schlüssel je Person.
 *
 * Ein Kalenderabonnement kann sich nicht anmelden. Die Kalender-App am iPhone
 * schickt kein Cookie und kennt keine Zwei-Faktor-Anmeldung; sie ruft eine
 * Adresse ab, sonst nichts. Der Schlüssel steckt deshalb in der Adresse
 * selbst — und ist damit so viel wert wie ein Passwort.
 *
 * Daraus folgt alles Weitere:
 *
 *   - **Je Person ein eigener Schlüssel.** Wer geht, verliert seinen Zugang,
 *     ohne dass alle anderen ihr Abonnement neu einrichten müssen. Ein
 *     gemeinsamer Schlüssel wäre bequemer und beim ersten Ausscheiden ein
 *     Nachmittag Arbeit für alle.
 *   - **Der Schlüssel entsteht erst, wenn jemand ihn anfordert.** Ein Konto
 *     ohne Abonnement hat keinen — was es nicht gibt, kann nicht auslaufen.
 *   - **Er lässt sich zurückziehen.** Ein neuer Schlüssel macht den alten
 *     augenblicklich wertlos; das abonnierte Telefon bekommt danach 404.
 *   - **Die Rechte des Kontos gelten weiter.** Der Schlüssel ist ein Ersatz
 *     für die Anmeldung, kein Freibrief: Wer im Büro keine Aufträge sehen
 *     darf, sieht sie auch im Abonnement nicht.
 *
 * Nicht gespeichert wird er als Streuwert, anders als ein Passwort. Er muss
 * im Klartext wieder herausgegeben werden können, weil die Adresse zum
 * Einrichten am Telefon noch einmal angezeigt werden muss — und ein Streuwert
 * ließe sich dafür nicht zurückrechnen.
 */

/** Ein neuer Schlüssel. 32 Byte, als Adresse tauglich geschrieben. */
export function neuerSchluessel(): string {
  return randomBytes(32).toString('base64url')
}

export type Kalenderkonto = {
  id: number | string
  name?: string | null
  email?: string | null
  rechte: string[]
}

/**
 * Wem gehört dieser Schlüssel?
 *
 * Gibt `null` für alles, was nicht stimmt — abgelaufen, zurückgezogen und nie
 * dagewesen sind dasselbe. Wer eine Kennung errät, soll nicht daran erkennen
 * können, dass es sie gibt (dasselbe Vorgehen wie bei den Übergabemappen).
 */
export async function kontoZuSchluessel(
  payload: Payload,
  schluessel: string,
): Promise<Record<string, any> | null> {
  // Ein zu kurzer Schlüssel ist nie echt — gar nicht erst die Datenbank fragen
  if (!schluessel || schluessel.length < 20) return null

  const treffer = await payload.find({
    collection: 'users',
    overrideAccess: true,
    limit: 1,
    depth: 1,
    where: { kalenderSchluessel: { equals: schluessel } },
  })

  return treffer.docs[0] ?? null
}

/**
 * Die Adresse zum Abonnieren.
 *
 * `webcal://` statt `https://` mit Absicht: Ein Antippen öffnet damit am
 * iPhone unmittelbar die Kalender-App und fragt nach dem Abonnement. Unter
 * `https` lädt Safari stattdessen eine Textdatei herunter, und der Weg von
 * dort in den Kalender ist keiner, den man jemandem erklären möchte.
 */
export function abonnementAdresse(basis: string, schluessel: string): string {
  return `${basis.replace(/^https?:\/\//, 'webcal://')}/api/kalender/${schluessel}.ics`
}

/** Die Adresse für ein CalDAV-Konto — dort trägt man den Server ohne Schema ein. */
export function caldavAdresse(basis: string, schluessel: string): string {
  return `${basis}/api/caldav/${schluessel}`
}
