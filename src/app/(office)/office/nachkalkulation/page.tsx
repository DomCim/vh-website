import React, { Suspense } from 'react'

import { NachkalkulationAnsicht } from './Ansicht'

/** Hülle ohne Datenzugriff — siehe belege/page.tsx. */
export default function NachkalkulationSeite() {
  return (
    <Suspense fallback={null}>
      <NachkalkulationAnsicht />
    </Suspense>
  )
}
