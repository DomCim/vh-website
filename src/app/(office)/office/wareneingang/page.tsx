import React, { Suspense } from 'react'

import { WareneingangListe } from './Ansicht'

/** Hülle ohne Datenzugriff — siehe belege/page.tsx. */
export default function WareneingangSeite() {
  return (
    <Suspense fallback={null}>
      <WareneingangListe />
    </Suspense>
  )
}
