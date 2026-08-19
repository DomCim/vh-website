import React, { Suspense } from 'react'

import { RechnungenAnsicht } from './Ansicht'

/** Hülle ohne Datenzugriff — siehe belege/page.tsx. */
export default function RechnungenSeite() {
  return (
    <Suspense fallback={null}>
      <RechnungenAnsicht />
    </Suspense>
  )
}
