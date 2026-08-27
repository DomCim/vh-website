import React, { Suspense } from 'react'

import { LaufmarkenAnsicht } from './Ansicht'

/** Hülle ohne Datenzugriff — siehe belege/page.tsx. */
export default function LaufmarkenSeite() {
  return (
    <Suspense fallback={null}>
      <LaufmarkenAnsicht />
    </Suspense>
  )
}
