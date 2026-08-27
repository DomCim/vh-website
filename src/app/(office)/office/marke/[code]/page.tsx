import React, { Suspense } from 'react'

import { MarkeAnsicht } from './Ansicht'

/** Hülle ohne Datenzugriff — siehe belege/page.tsx. */
export default function MarkeSeite() {
  return (
    <Suspense fallback={null}>
      <MarkeAnsicht />
    </Suspense>
  )
}
