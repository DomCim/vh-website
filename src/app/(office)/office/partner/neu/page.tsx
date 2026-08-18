import React from 'react'

import { PartnerFormular } from '../../../../../components/office/PartnerFormular'
import { AUSGABEN_KATEGORIEN } from '../../../../../collections/Expenses'
import { bueroBenutzer } from '../../../../../lib/office'

export const dynamic = 'force-dynamic'

export default async function NeuerPartner() {
  await bueroBenutzer()

  return (
    <>
      <h1>Neuer Geschäftspartner</h1>
      <p className="buero-unterzeile">Eine Kartei für Lieferanten, Kunden und Dienstleister.</p>
      <PartnerFormular
        werte={{}}
        kategorien={AUSGABEN_KATEGORIEN.map((k) => ({ wert: k.value, text: k.label }))}
      />
    </>
  )
}
