import React, { Suspense } from 'react'

import { InventarAnsicht } from './Ansicht'

/**
 * Hülle ohne Datenzugriff — siehe belege/page.tsx.
 *
 * `Suspense`, weil die Ansicht die Suche aus der Adresse liest: Ohne die Hülle
 * weigert sich Next, die Seite im Voraus zu erzeugen, und genau das braucht
 * der Service Worker, um sie ohne Netz zu öffnen.
 */
export default function InventarSeite() {
  return (
    <Suspense fallback={null}>
      <InventarAnsicht />
    </Suspense>
  )
}
