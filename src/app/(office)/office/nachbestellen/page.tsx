import React, { Suspense } from 'react'

import { NachbestellenAnsicht } from './Ansicht'

/** Hülle ohne Datenzugriff — siehe belege/page.tsx. */
export default function NachbestellenSeite() {
  return (
    <Suspense fallback={null}>
      <NachbestellenAnsicht />
    </Suspense>
  )
}
