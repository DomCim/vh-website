import React, { Suspense } from 'react'

import { KalenderAnsicht } from './Ansicht'

/** Hülle ohne Datenzugriff — siehe belege/page.tsx. */
export default function KalenderSeite() {
  return (
    <Suspense fallback={null}>
      <KalenderAnsicht />
    </Suspense>
  )
}
