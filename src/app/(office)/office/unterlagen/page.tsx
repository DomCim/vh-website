import React, { Suspense } from 'react'

import { UnterlagenAnsicht } from './Ansicht'

/** Hülle ohne Datenzugriff — die Ansicht rechnet aus dem Bestand im Gerät. */
export default function UnterlagenSeite() {
  return (
    <Suspense fallback={null}>
      <UnterlagenAnsicht />
    </Suspense>
  )
}
