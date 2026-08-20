'use client'

import { useAbgleichstand } from '../../lib/buero/abgleichstand'

/**
 * Sagt im Klartext, wenn die Zahlen nicht mehr von jetzt sind — und wenn
 * eigene Eingaben noch darauf warten, beim Server anzukommen.
 *
 * Gerechnet wird das in `useAbgleichstand`; dieselbe Rechnung färbt den Punkt
 * in der Kopfleiste. Hier steht nur, wie es aussieht.
 *
 * Im Normalfall steht hier nichts.
 */
export function AbgleichLeiste() {
  const stand = useAbgleichstand()
  if (!stand) return null

  return (
    <div className={`buero-abgleich${stand.art === 'abgelehnt' ? ' streng' : ''}`} role="status">
      {stand.text}
    </div>
  )
}
