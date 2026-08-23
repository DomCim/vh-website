import { payloadClient } from '../../../../lib/data'
import { zaehladresse, zaehlskriptMitWache } from '../../../../lib/statistik'

export const dynamic = 'force-dynamic'

/**
 * Das Zählskript — ausgeliefert von der eigenen Adresse.
 *
 * Warum nicht einfach von Plausible? Weil die Statistik gar nicht von außen
 * erreichbar ist: Sie läuft im internen Netz, ohne eigene Adresse und ohne
 * Zertifikat. Der Browser des Besuchers käme dort nicht hin.
 *
 * Und selbst wenn — ein Skript, das `plausible` im Pfad trägt, wird von jeder
 * gängigen Werbeblockerliste geschluckt. Nicht aus Bosheit: Die Listen kennen
 * die Adresse, nicht das Verhalten. Gezählt würde dann nur noch, wer keinen
 * Blocker hat, und das ist keine Statistik, sondern eine Stichprobe mit
 * Schlagseite.
 *
 * Über die eigene Adresse ist es eine Datei wie jede andere. Nebenbei erspart
 * das der Sicherheitsrichtlinie eine Ausnahme: Das Skript kommt von 'self',
 * `CSP_EXTRA_SCRIPT` bleibt leer.
 */

/** So lange wird dasselbe Skript weitergereicht, bevor neu geholt wird */
const FRISCHE_MS = 60 * 60_000

let gemerkt: { zeit: number; text: string } | null = null

export async function GET(): Promise<Response> {
  if (gemerkt && Date.now() - gemerkt.zeit < FRISCHE_MS) return auslieferung(gemerkt.text)

  const payload = await payloadClient()
  const adresse = await zaehladresse(payload)
  /*
   * Ohne hinterlegte Statistik ein leeres Skript statt eines Fehlers: Im
   * Seitenkopf steht das Skript-Tag womöglich schon, und ein 404 in der
   * Konsole des Besuchers sähe nach einem kaputten Shop aus. Ein leeres
   * Skript tut nichts und sagt nichts.
   */
  if (!adresse) return auslieferung('/* keine Zählung eingerichtet */\n', 300)

  try {
    const antwort = await fetch(`${adresse}/js/script.js`, { cache: 'no-store' })
    if (!antwort.ok) throw new Error(`Zählskript antwortet mit ${antwort.status}`)
    /*
     * Die Wache kommt beim Ausliefern dazu und nicht beim Ausführen: So steht
     * sie genau einmal im Zwischenspeicher und gilt für jede Auslieferung —
     * entschieden wird trotzdem erst im Browser, denn nur der weiß, ob er
     * ferngesteuert ist.
     */
    const text = zaehlskriptMitWache(await antwort.text())
    gemerkt = { zeit: Date.now(), text }
    return auslieferung(text)
  } catch (err) {
    payload.logger.warn({ err }, 'Zählskript nicht erreichbar')
    /*
     * Steht die Statistik gerade nicht, wird eben nicht gezählt. Dass der
     * Shop deswegen eine rote Meldung zeigt, wäre die falsche Reihenfolge —
     * ein fehlender Besuchszähler ist kein Grund, den Verkauf zu stören.
     * Kurze Frist, damit es sich von selbst wieder einrenkt.
     */
    return auslieferung('/* Zählung gerade nicht erreichbar */\n', 60)
  }
}

function auslieferung(text: string, sekunden = 3600): Response {
  return new Response(text, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': `public, max-age=${sekunden}`,
    },
  })
}
