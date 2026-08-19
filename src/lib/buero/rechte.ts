'use client'

import { useCallback } from 'react'

import { useRahmen } from './bestand'

/**
 * Darf der angemeldete Mensch das — für die Oberfläche.
 *
 * Der Schutz sitzt an den Schnittstellen (`lib/wache.ts`); hier geht es um
 * Ordnung. Eine Werkstattrolle, die den Menüpunkt „Steuer" nicht sieht, aber
 * auf der Startseite die Jahresumsätze abliest, ist keine Rolle, sondern ein
 * Versehen.
 *
 * Solange der Rahmen noch nicht im Gerät liegt — der allererste Aufruf, bevor
 * der Abgleich durch ist —, wird nichts versteckt. Eine Seite, die beim Laden
 * zusammenschrumpft und dann wieder wächst, sieht kaputt aus; und ohne
 * Abgleich stehen ohnehin keine Zahlen da, die man verbergen müsste.
 */
export function useDarf(): (recht: string) => boolean {
  const rahmen = useRahmen()
  return useCallback(
    (recht: string) => {
      // `?? []` als doppelter Boden: Ein Rahmen aus einer älteren Fassung im
      // Gerät kennt das Feld womöglich nicht, und ein Absturz hier reißt die
      // ganze Seite mit.
      const rechte = rahmen.rechte ?? []
      return rechte.length === 0 || rechte.includes(recht)
    },
    [rahmen.rechte],
  )
}
