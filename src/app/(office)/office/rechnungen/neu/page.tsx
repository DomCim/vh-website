import React from 'react'

import { RechnungFormular } from '../../../../../components/office/RechnungFormular'
import { bueroBenutzer } from '../../../../../lib/office'

export const dynamic = 'force-dynamic'

export default async function NeueRechnung() {
  await bueroBenutzer()
  return (
    <>
      <h1>Rechnung schreiben</h1>
      <p className="buero-unterzeile">
        Preise netto eingeben. Die Nummer wird erst beim Festschreiben vergeben.
      </p>
      <RechnungFormular werte={{ issueDate: new Date().toISOString().slice(0, 10) }} />
    </>
  )
}
