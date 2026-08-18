import React from 'react'

import { AuftragFormular } from '../../../../../components/office/AuftragFormular'
import { payloadClient } from '../../../../../lib/data'
import { bueroBenutzer } from '../../../../../lib/office'

export const dynamic = 'force-dynamic'

export default async function NeuerAuftrag() {
  await bueroBenutzer()
  const payload = await payloadClient()

  const { docs: posten } = await payload.find({
    collection: 'inventory-items',
    sort: 'name',
    limit: 300,
    depth: 0,
    overrideAccess: true,
  })

  return (
    <>
      <h1>Neuer Auftrag</h1>
      <p className="buero-unterzeile">Für alles, was nicht aus dem Shop oder einem Angebot kommt.</p>
      <AuftragFormular
        werte={{}}
        posten={posten.map((p) => ({
          id: p.id,
          name: p.name,
          unit: p.unit ?? '',
          quantity: p.quantity ?? 0,
        }))}
      />
    </>
  )
}
