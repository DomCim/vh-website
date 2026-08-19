import React, { Suspense } from 'react'

import { WareneingangNeuAnsicht } from './Ansicht'

/** Hülle ohne Datenzugriff — siehe belege/page.tsx. */
export default function WareneingangNeuSeite() {
  return (
    <Suspense fallback={null}>
      <WareneingangNeuAnsicht />
    </Suspense>
  )
}
