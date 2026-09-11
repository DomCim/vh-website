import { NextResponse } from 'next/server'

import { payloadClient } from '../../../../../lib/data'
import { zustandLesen } from '../../../../../lib/sicherung'

export const dynamic = 'force-dynamic'

/**
 * Lebt der Takt noch?
 *
 * **Warum es das braucht.** Solange der Takt im Web-Container saß, fiel sein
 * Ausfall von selbst auf: War er weg, war die Website weg. Seit er in einem
 * eigenen Prozess läuft, stirbt er still — keine nächtliche Sicherung, keine
 * Erinnerungen, keine Meldung über neue Post, und niemand merkt es. Genau das
 * steht als Warnung in den Takt-Einstellungen, und genau dagegen ist das hier.
 *
 * **Warum ausgerechnet über die Datenbank.** Der Takt-Container hat keine
 * Traefik-Regel — von außen führt kein Weg zu ihm, und das ist richtig so, er
 * bedient ja niemanden. Sein Lebenszeichen legt er aber in `system-state` ab,
 * und dort kommt jeder Container heran. Diese Antwort gibt deshalb der
 * Web-Container, über die gewöhnliche Adresse: Home Assistant fragt
 * `/api/takt/healthz` genauso wie `/api/healthz`.
 *
 * **Die Frist.** Der Takt schlägt jede Minute. Fünf Minuten Nachsicht
 * überbrücken ein Ausrollen und einen hängenden Schlag; darüber hinaus steht
 * er wirklich still. Kürzer wäre Lärm, länger wäre Nachlässigkeit — eine
 * ausgefallene Nachtsicherung fällt so noch am selben Vormittag auf.
 */

/** So lange darf der letzte Schlag her sein, bevor es als Störung gilt. */
const FRIST_MS = 5 * 60_000

export async function GET() {
  try {
    const payload = await payloadClient()
    const zustand = await zustandLesen(payload, 'takt')

    if (!zustand?.lastRun) {
      /*
       * Kein Lebenszeichen heißt nicht „kaputt", sondern „noch nie gelaufen" —
       * etwa unmittelbar nach dem ersten Start mit dieser Fassung. Als Störung
       * gilt es trotzdem: Ein Takt, von dem nichts bekannt ist, arbeitet auch
       * nicht.
       */
      return NextResponse.json(
        { status: 'error', takt: false, grund: 'kein Lebenszeichen' },
        { status: 503 },
      )
    }

    const alter = Date.now() - new Date(zustand.lastRun).getTime()
    const sekunden = Math.round(alter / 1000)

    if (alter > FRIST_MS) {
      return NextResponse.json(
        { status: 'error', takt: false, letzterSchlagVorSekunden: sekunden },
        { status: 503 },
      )
    }

    return NextResponse.json({ status: 'ok', takt: true, letzterSchlagVorSekunden: sekunden })
  } catch {
    // Kein Durchkommen zur Datenbank — dann ist die Aussage über den Takt
    // wertlos, und das gehört gesagt statt geraten.
    return NextResponse.json({ status: 'error', takt: false, db: false }, { status: 503 })
  }
}
