import React from 'react'

import { InventarFormular } from '../../../../../components/office/InventarFormular'
import { payloadClient } from '../../../../../lib/data'
import { bueroBenutzer } from '../../../../../lib/office'

export const dynamic = 'force-dynamic'

export default async function NeuerPosten() {
  await bueroBenutzer()
  const payload = await payloadClient()

  const { docs: lieferanten } = await payload.find({
    collection: 'contacts',
    sort: 'name',
    limit: 300,
    depth: 0,
    overrideAccess: true,
  })

  return (
    <>
      <h1>Neuer Posten</h1>
      <p className="buero-unterzeile">Material, Werkzeug oder Maschine — alles, was im Haus ist.</p>
      <InventarFormular
        werte={{}}
        lieferanten={lieferanten.map((l) => ({ id: l.id, name: l.name }))}
      />
    </>
  )
}
