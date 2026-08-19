import React, { Suspense } from 'react'

import { WiedervorlagenAnsicht } from './Ansicht'

/** Hülle ohne Datenzugriff — siehe belege/page.tsx. */
export default function WiedervorlagenSeite() {
  return (
    <Suspense fallback={null}>
      <WiedervorlagenAnsicht />
    </Suspense>
  )
}
