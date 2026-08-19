'use client'

import { useAbgleich } from '../../lib/buero/bestand'
import { useWarteschlange } from '../../lib/buero/warteschlange'

/**
 * Sagt, wenn die Zahlen nicht mehr von jetzt sind — und wenn eigene Eingaben
 * noch darauf warten, beim Server anzukommen.
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
  const { wartend, fehlerhaft } = useWarteschlange()

  if (!bereit) return null
  if (online && !fehler && !wartend && !fehlerhaft) return null

  const teile: string[] = []
  if (!online) teile.push(stand ? `Ohne Netz — Stand ${vorZeit(stand)}` : 'Ohne Netz')
  else if (fehler) teile.push(`Abgleich hakt${stand ? ` — Stand ${vorZeit(stand)}` : ''}`)

  if (wartend > 0) {
    teile.push(`${wartend} Änderung${wartend === 1 ? '' : 'en'} ${online ? 'gehen raus' : 'warten'}`)
  }
  if (fehlerhaft > 0) {
    teile.push(`${fehlerhaft} abgelehnt — bitte nachsehen`)
  }

  return (
    <div className={`buero-abgleich${fehlerhaft ? ' streng' : ''}`} role="status">
      {teile.join(' · ')}
    </div>
  )
}
