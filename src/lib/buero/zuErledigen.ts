'use client'

import { useMemo } from 'react'

import { zuErledigen } from '../zuErledigen'
import { useBestand } from './bestand'

/**
 * Die Zähler an der Navigation, gerechnet aus dem Bestand im Gerät.
 *
 * Die Regeln selbst stehen in `lib/zuErledigen.ts` — ohne React, damit sie
 * ohne Server geprüft werden können und die Übersicht dieselben benutzt.
 *
 * Gerechnet wird in `useMemo` über die Listen: Die Navigation steht auf jeder
 * Seite, und `useBestand` gibt zwischen zwei Abgleichen dieselbe Liste zurück
 * — so läuft die Zählung einmal je Änderung und nicht einmal je Bild.
 */
export function useZuErledigen(): Record<string, number> {
  const anfragen = useBestand<{ status?: string | null }>('anfragen')
  const rechnungen = useBestand<{ status?: string | null; dueDate?: string | null }>('rechnungen')
  const belege = useBestand<{ paid?: boolean | null; dueDate?: string | null }>('belege')
  const inventar = useBestand<{ quantity?: number | null; minQuantity?: number | null }>('inventar')
  const wiedervorlagen = useBestand<{ done?: boolean | null; dueDate?: string | null }>(
    'wiedervorlagen',
  )
  // Neue Post steht als ungelesene Meldung im Gerät — siehe `istNeuePost`
  const meldungen = useBestand<{ tag?: string | null; gelesen?: boolean | null }>('meldungen')

  return useMemo(
    () => zuErledigen({ anfragen, rechnungen, belege, inventar, wiedervorlagen, meldungen }),
    [anfragen, rechnungen, belege, inventar, wiedervorlagen, meldungen],
  )
}
