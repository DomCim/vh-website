import React, { Suspense } from 'react'

import { BelegeAnsicht } from './Ansicht'

/**
 * Bewusst ohne Datenzugriff auf dem Server.
 *
 * Die Seite ist nur noch eine Hülle: Sie lässt sich damit im Voraus erzeugen,
 * vom Service Worker zwischenspeichern und in der Werkstatt ohne Netz öffnen.
 * Die Belege kommen aus dem Bestand im Gerät, den Wächter über die Daten
 * spielt der Server an der Schnittstelle.
 */
export default function BelegeSeite() {
  return (
    <Suspense fallback={null}>
      <BelegeAnsicht />
    </Suspense>
  )
}
