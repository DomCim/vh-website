'use client'

import { useEffect } from 'react'

/**
 * Blendet die untere Leiste aus, solange die Bildschirmtastatur offen ist.
 *
 * Am Handy klebt die Tableiste am unteren Rand. Geht die Tastatur auf,
 * schrumpft der sichtbare Ausschnitt — die Leiste sitzt dann je nach Browser
 * über der Tastatur oder direkt über dem Feld, in das gerade getippt wird.
 * Beides steht im Weg.
 *
 * Gemessen wird über `visualViewport`: `window.innerHeight` beschreibt den
 * Ausschnitt, den die Seite belegen darf, `visualViewport.height` den, den man
 * tatsächlich sieht. Klafft dazwischen mehr als ein Viertel, ist etwas davor
 * — und das ist praktisch immer die Tastatur.
 *
 * Die Schwelle ist bewusst grob. Auf iOS wächst und schrumpft der Ausschnitt
 * auch beim Ein- und Ausblenden der Adressleiste, aber um deutlich weniger
 * als hundert Pixel; ein feinerer Wert würde die Leiste beim Scrollen
 * flackern lassen.
 *
 * Ohne `visualViewport` — ältere Browser, Firefox unter bestimmten Fassungen —
 * passiert schlicht nichts: Dann bleibt die Leiste stehen, wie sie es vorher
 * immer getan hat.
 */
export function Tastaturwache() {
  useEffect(() => {
    const sicht = window.visualViewport
    if (!sicht) return

    const pruefen = () => {
      const verdeckt = window.innerHeight - sicht.height
      const offen = verdeckt > Math.max(120, window.innerHeight * 0.25)
      document.documentElement.classList.toggle('tastatur-offen', offen)
    }

    pruefen()
    sicht.addEventListener('resize', pruefen)
    sicht.addEventListener('scroll', pruefen)
    return () => {
      sicht.removeEventListener('resize', pruefen)
      sicht.removeEventListener('scroll', pruefen)
      // Beim Seitenwechsel nicht mit ausgeblendeter Leiste zurücklassen
      document.documentElement.classList.remove('tastatur-offen')
    }
  }, [])

  return null
}
