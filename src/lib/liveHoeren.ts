import type { Payload } from 'payload'

import { LIVE_KANAL, type LiveEreignis, sammelstelle } from './live'

/**
 * Horcht auf Meldungen der anderen Container.
 *
 * Seit Website und Büro getrennt laufen, entsteht eine Änderung oft dort, wo
 * niemand einen Draht offen hält: Eine bezahlte Bestellung legt im
 * Web-Container einen Auftrag an, und das Tablet in der Werkstatt hängt am
 * Büro-Container. Verbunden sind die beiden über das, was sie ohnehin teilen —
 * die Datenbank.
 *
 * Postgres kann das von Haus aus (`LISTEN`/`NOTIFY`), es braucht also weder
 * einen Nachrichtendienst noch eine Verbindung zwischen den Containern. Fällt
 * einer aus, hört der andere ab dem Neustart einfach wieder mit; nichts muss
 * aufgeräumt werden.
 *
 * Was dabei bewusst fehlt: ein Zwischenspeicher für verpasste Meldungen. Wer
 * nicht zuhört, verpasst sie — und holt sich beim nächsten Abgleich ohnehin
 * alles, was sich getan hat. Ein Gedächtnis wäre hier ein zweites, schlechteres
 * Abgleichsverfahren.
 */

/** Nach einem Verbindungsabriss nicht sofort und nicht im Sekundentakt wieder ran. */
const NEUER_VERSUCH_MS = 5_000

type Horcher = {
  query: (text: string) => Promise<unknown>
  on: (name: string, rueckruf: (wert: never) => void) => void
  release: (fehler?: boolean) => void
}

type MitPool = {
  db?: { pool?: { connect: () => Promise<Horcher> } }
}

export async function liveHoerenStarten(payload: Payload): Promise<void> {
  const pool = (payload as unknown as MitPool)?.db?.pool
  if (!pool) {
    payload.logger.warn('Live-Meldungen: kein Datenbank-Pool gefunden, Büro bleibt still')
    return
  }

  // Läuft, solange der Prozess läuft — es gibt nichts, was ihn beenden müsste
  const anhaengen = async () => {
    let horcher: Horcher | null = null
    try {
      horcher = await pool.connect()

      horcher.on('notification', (nachricht: never) => {
        const roh = (nachricht as { payload?: string })?.payload
        if (!roh) return
        try {
          sammelstelle()?.melde(JSON.parse(roh) as LiveEreignis)
        } catch {
          // Unverständliches ignorieren — lieber eine Meldung verlieren als
          // den Horcher an einer kaputten Zeile scheitern lassen
        }
      })

      // Reißt die Verbindung ab, wird sie neu aufgebaut. Ohne das bliebe das
      // Büro nach einem Neustart der Datenbank still — und niemand merkte es,
      // weil alles andere weiterläuft.
      horcher.on('error', () => {
        try {
          horcher?.release(true)
        } catch {
          // Eine kaputte Verbindung lässt sich nicht immer sauber zurückgeben
        }
        setTimeout(anhaengen, NEUER_VERSUCH_MS)
      })

      await horcher.query(`LISTEN ${LIVE_KANAL}`)
      payload.logger.info('Live-Meldungen: Büro hört zu.')
    } catch (err) {
      payload.logger.warn({ err }, 'Live-Meldungen: Verbindung fehlgeschlagen, neuer Versuch folgt')
      try {
        horcher?.release(true)
      } catch {
        // siehe oben
      }
      setTimeout(anhaengen, NEUER_VERSUCH_MS)
    }
  }

  await anhaengen()
}
