import { createHmac, timingSafeEqual } from 'crypto'

import type { LiveBereich } from './bereiche'

/**
 * Live-Aktualisierung im Büro.
 *
 * Bisher zeigte jede Seite den Stand ihres Aufrufs: Wer am Rechner einen
 * Auftrag anlegte, sah ihn auf dem Tablet in der Werkstatt erst beim nächsten
 * Antippen. Jetzt hält jede offene Büro-Seite eine WebSocket-Verbindung, und
 * sobald sich etwas ändert, gleicht sie den betroffenen Bereich nach.
 *
 * Der Weg einer Meldung, seit Website und Büro in getrennten Containern
 * laufen:
 *
 *   1. Irgendwo ändert sich etwas — im Büro, im Admin-Panel, durch eine
 *      bezahlte Bestellung im Shop oder über den KI-Zugang.
 *   2. `liveMelden` schickt die Meldung als `pg_notify` an die Datenbank.
 *      Das ist der entscheidende Punkt: Die Datenbank teilen sich beide
 *      Container ohnehin, also braucht es keinen zusätzlichen Dienst und
 *      keine Verbindung zwischen ihnen. Wer gerade läuft, hört es; wer
 *      neu startet, hört es ab dann wieder.
 *   3. Der Büro-Container horcht auf diesem Kanal (liveHoeren.ts) und reicht
 *      die Meldung an seine Sammelstelle weiter.
 *   4. server.mjs verteilt sie an die offenen Drähte.
 *   5. components/office/BestandAnbieter.tsx gleicht den Bereich nach.
 *
 * Bewusst nur ein Weg, auch wenn ein Prozess alles macht: Meldete er
 * zusätzlich direkt an die eigene Sammelstelle, käme dieselbe Änderung
 * zweimal an.
 */

export type { LiveBereich } from './bereiche'

export type LiveEreignis = {
  bereich: LiveBereich
  /** Was passiert ist — nur zur Anzeige, die Seite lädt ohnehin neu */
  art?: 'neu' | 'geaendert' | 'geloescht'
  id?: number | string
  zeit: number
}

type Sammelstelle = {
  melde: (ereignis: LiveEreignis) => void
}

/** Der Kanal, auf dem die Container einander Bescheid geben. */
export const LIVE_KANAL = 'vh_live'

/**
 * Ohne laufenden Server (Build, Skripte, Tests) gibt es keine Sammelstelle —
 * dann verpufft die Meldung, und das ist richtig so.
 */
export function sammelstelle(): Sammelstelle | null {
  return (globalThis as { __vhLive?: Sammelstelle }).__vhLive ?? null
}

type MitPool = { db?: { pool?: { query: (text: string, werte: unknown[]) => Promise<unknown> } } }

/**
 * Meldet eine Änderung an alle offenen Büro-Seiten — auch im anderen
 * Container.
 *
 * Absichtlich ohne `await` beim Aufrufer und mit verschlucktem Fehler: Eine
 * Meldung ist eine Annehmlichkeit, kein Teil des Vorgangs. Dass eine
 * Benachrichtigung nicht hinausgeht, darf niemals dazu führen, dass ein Beleg
 * nicht gespeichert wird.
 */
export function liveMelden(
  payload: unknown,
  bereich: LiveBereich,
  art: LiveEreignis['art'] = 'geaendert',
  id?: number | string,
): void {
  const pool = (payload as MitPool)?.db?.pool
  if (!pool) return

  const ereignis: LiveEreignis = { bereich, art, id, zeit: Date.now() }
  void pool
    .query('SELECT pg_notify($1, $2)', [LIVE_KANAL, JSON.stringify(ereignis)])
    .catch(() => undefined)
}

// ── Eintrittskarte ──────────────────────────────────────────────────────────

/**
 * Der Server, der die Verbindungen hält, kennt Payload nicht — er kann eine
 * Anmeldung also nicht selbst prüfen. Deshalb holt sich die Seite vorher eine
 * kurzlebige, signierte Eintrittskarte über einen ganz normalen (und damit
 * geprüften) Aufruf und legt sie beim Verbinden vor.
 */
const KARTE_GUELTIG_MS = 60_000

function geheimnis(): string {
  const wert = process.env.PAYLOAD_SECRET
  if (!wert) throw new Error('PAYLOAD_SECRET fehlt')
  return wert
}

export function liveKarteErzeugen(benutzerId: number | string): string {
  const nutzlast = `${benutzerId}|${Date.now() + KARTE_GUELTIG_MS}`
  const signatur = createHmac('sha256', geheimnis()).update(nutzlast).digest('hex')
  return `${Buffer.from(nutzlast).toString('base64url')}.${signatur}`
}

/** Wird auch in server.mjs gebraucht — dort noch einmal in schlichtem JS. */
export function liveKartePruefen(karte: string | undefined): string | null {
  if (!karte) return null
  const [teil, signatur] = karte.split('.')
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

  const [benutzerId, ablauf] = nutzlast.split('|')
  if (!benutzerId || Number(ablauf) < Date.now()) return null
  return benutzerId
}
