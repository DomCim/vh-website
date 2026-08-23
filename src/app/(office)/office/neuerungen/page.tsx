import React, { Suspense } from 'react'

import { NeuerungenAnsicht } from './Ansicht'

/** Hülle ohne Datenzugriff — siehe meldungen/page.tsx. */
export default function NeuerungenSeite() {
  return (
    <Suspense fallback={null}>
      <NeuerungenAnsicht />
    </Suspense>
  )
}
