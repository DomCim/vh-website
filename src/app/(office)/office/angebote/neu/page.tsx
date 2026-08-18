import React from 'react'

import { AngebotFormular } from '../../../../../components/office/AngebotFormular'
import { bueroBenutzer } from '../../../../../lib/office'

export const dynamic = 'force-dynamic'

export default async function NeuesAngebot() {
  await bueroBenutzer()
  const heute = new Date()
  const in30Tagen = new Date(heute.getTime() + 30 * 24 * 60 * 60 * 1000)

  return (
    <>
      <h1>Neues Angebot</h1>
      <p className="buero-unterzeile">
        Die Nummer wird erst beim Versenden vergeben — ein verworfener Entwurf reißt so keine Lücke
        in die Reihe.
      </p>
      <AngebotFormular
        werte={{
          issueDate: heute.toISOString().slice(0, 10),
          validUntil: in30Tagen.toISOString().slice(0, 10),
        }}
      />
    </>
  )
}
