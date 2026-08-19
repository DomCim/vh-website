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
  const { rechte } = useRahmen()
  return useCallback((recht: string) => rechte.length === 0 || rechte.includes(recht), [rechte])
}
