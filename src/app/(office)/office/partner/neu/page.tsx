import React from 'react'

import { PartnerFormular } from '../../../../../components/office/PartnerFormular'
import { AUSGABEN_KATEGORIEN } from '../../../../../lib/listen'

/**
 * Neuer Geschäftspartner.
 *
 * Braucht nichts vom Server: Das Formular ist ohnehin eine Client-Komponente,
 * und die Kategorien sind eine feste Liste.
 */
export default function NeuerPartnerSeite() {
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
