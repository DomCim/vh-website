'use client'

import { seit } from '../format'
import { useAbgleich } from './bestand'
import { useWarteschlange } from './warteschlange'

/**
 * Der Stand des Abgleichs in einer Form, die zwei Anzeigen teilen.
 *
 * Es gibt ihn an zwei Stellen: als Punkt in der Kopfleiste (immer sichtbar,
 * eine Farbe) und als Meldeleiste über dem Inhalt (nur im Störfall, im
 * Klartext). Beide müssen dasselbe sagen — stünde die Rechnung zweimal im
 * Code, sagte sie irgendwann zweierlei.
 *
 * Der Grundsatz dahinter bleibt: Ein alter Stand ist brauchbar, ein alter
 * Stand, der sich für den aktuellen ausgibt, ist gefährlich.
 */

export type Abgleichart = 'ohneNetz' | 'haengt' | 'wartet' | 'abgelehnt'

export type Abgleichstand = {
  /** Das Schwerwiegendste, was gerade zutrifft — danach richtet sich die Farbe */
  art: Abgleichart
  /** Alles, was zutrifft, im Klartext */
  text: string
}

/*
 * Die Worte für „wie lange her" stehen in lib/format, seit die Meldungen unter
 * der Glocke dieselben brauchen. Zweimal gerechnet hieße irgendwann zweierlei
 * gesagt.
 */
const vorZeit = seit

/** `null` heißt: alles in Ordnung, es gibt nichts zu melden. */
export function useAbgleichstand(): Abgleichstand | null {
  const { erreichbar, stand, fehler, bereit } = useAbgleich()
  const { wartend, fehlerhaft } = useWarteschlange()

  if (!bereit) return null
  if (erreichbar && !fehler && !wartend && !fehlerhaft) return null

  const teile: string[] = []
  if (!erreichbar) teile.push(stand ? `Ohne Netz — Stand ${vorZeit(stand)}` : 'Ohne Netz')
  else if (fehler) teile.push(`Abgleich hakt${stand ? ` — Stand ${vorZeit(stand)}` : ''}`)

  if (wartend > 0) {
    teile.push(
      `${wartend} Änderung${wartend === 1 ? '' : 'en'} ${erreichbar ? 'gehen raus' : 'warten'}`,
    )
  }
  if (fehlerhaft > 0) teile.push(`${fehlerhaft} abgelehnt — bitte nachsehen`)

  /*
   * Die Reihenfolge ist die der Dringlichkeit, nicht die des Auftretens.
   *
   * Abgelehnt steht ganz oben: Da hat der Server etwas zurückgewiesen, und
   * das geht von selbst nicht weg. Ohne Netz ist ein Zustand, kein Fehler —
   * deshalb grau und nicht rot. Was nur noch rausgeht, erledigt sich.
   */
  const art: Abgleichart = fehlerhaft
    ? 'abgelehnt'
    : !erreichbar
      ? 'ohneNetz'
      : fehler
        ? 'haengt'
        : 'wartet'

  return { art, text: teile.join(' · ') }
}
