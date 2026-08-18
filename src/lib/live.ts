import { createHmac, timingSafeEqual } from 'crypto'

import type { LiveBereich } from './bereiche'

/**
 * Live-Aktualisierung im Büro.
 *
 * Bisher zeigte jede Seite den Stand ihres Aufrufs: Wer am Rechner einen
 * Auftrag anlegte, sah ihn auf dem Tablet in der Werkstatt erst beim nächsten
 * Antippen. Jetzt hält jede offene Büro-Seite eine WebSocket-Verbindung, und
 * sobald sich etwas ändert, lädt sie genau die betroffene Ansicht nach.
 *
 * Der Aufbau in drei Teilen:
 *
 *   1. Diese Datei — die Sammelstelle. Payload meldet hier jede Änderung.
 *   2. server.mjs — der eigene Server neben Next, der die Verbindungen hält.
 *      Next selbst kann das nicht: Route-Handler beantworten Anfragen, sie
 *      halten keine Leitung offen.
 *   3. components/office/LiveAktualisierung.tsx — die Gegenstelle im Browser.
 *
 * Verbunden sind (1) und (2) über `globalThis`: Beide laufen im selben
 * Node-Prozess, der Server legt die Sammelstelle an, bevor Next startet.
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

/**
 * Ohne laufenden Server (Build, Skripte, Tests) gibt es keine Sammelstelle —
 * dann verpufft die Meldung, und das ist richtig so.
 */
function sammelstelle(): Sammelstelle | null {
  return (globalThis as { __vhLive?: Sammelstelle }).__vhLive ?? null
}

/** Meldet eine Änderung an alle offenen Büro-Seiten. */
export function liveMelden(
  bereich: LiveBereich,
  art: LiveEreignis['art'] = 'geaendert',
  id?: number | string,
): void {
  sammelstelle()?.melde({ bereich, art, id, zeit: Date.now() })
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
