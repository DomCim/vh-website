'use client'

import { useAbgleich } from '../../lib/buero/bestand'

/**
 * Sagt, wenn die Zahlen nicht mehr von jetzt sind.
 *
 * Der Grundsatz dahinter: Ein alter Stand ist brauchbar, ein alter Stand, der
 * sich für den aktuellen ausgibt, ist gefährlich. Wer in der Werkstatt ohne
 * Netz auf eine Bestellliste schaut, soll das sehen — dann kann er selbst
 * entscheiden, ob er sich darauf verlässt.
 *
 * Im Normalfall steht hier nichts.
 */

function vorZeit(zeitpunkt: number): string {
  const sekunden = Math.round((Date.now() - zeitpunkt) / 1000)
  if (sekunden < 90) return 'gerade eben'
  const minuten = Math.round(sekunden / 60)
  if (minuten < 60) return `vor ${minuten} Minuten`
  const stunden = Math.round(minuten / 60)
  if (stunden < 24) return `vor ${stunden} Stunden`
  return `vor ${Math.round(stunden / 24)} Tagen`
}

export function AbgleichLeiste() {
  const { online, stand, fehler, bereit } = useAbgleich()

  // Am Netz und ohne Ärger: kein Grund, Platz wegzunehmen
  if (online && !fehler) return null
  if (!bereit) return null

  const text = !online
    ? stand
      ? `Ohne Netz — Stand ${vorZeit(stand)}`
      : 'Ohne Netz'
    : `Abgleich hakt${stand ? ` — Stand ${vorZeit(stand)}` : ''}`

  return (
    <div className="buero-abgleich" role="status">
      {text}
    </div>
  )
}
