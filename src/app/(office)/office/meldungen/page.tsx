import React, { Suspense } from 'react'

import { MeldungenAnsicht } from './Ansicht'

/** Hülle ohne Datenzugriff — siehe belege/page.tsx. */
export default function MeldungenSeite() {
  return (
    <Suspense fallback={null}>
      <MeldungenAnsicht />
    </Suspense>
  )
}
