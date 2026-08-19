import React, { Suspense } from 'react'

import { AuslastungAnsicht } from './Ansicht'

/** Hülle ohne Datenzugriff — siehe belege/page.tsx. */
export default function AuslastungSeite() {
  return (
    <Suspense fallback={null}>
      <AuslastungAnsicht />
    </Suspense>
  )
}
