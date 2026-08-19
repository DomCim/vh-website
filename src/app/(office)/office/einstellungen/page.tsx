import React, { Suspense } from 'react'

import { EinstellungenAnsicht } from './Ansicht'

/** Hülle ohne Datenzugriff — siehe belege/page.tsx. */
export default function EinstellungenSeite() {
  return (
    <Suspense fallback={null}>
      <EinstellungenAnsicht />
    </Suspense>
  )
}
