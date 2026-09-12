import React, { Suspense } from 'react'

import { KontoAnsicht } from './Ansicht'

/** Hülle ohne Datenzugriff — siehe belege/page.tsx. */
export default function KontoSeite() {
  return (
    <Suspense fallback={null}>
      <KontoAnsicht />
    </Suspense>
  )
}
