import React from 'react'

import { InventurFormular } from '../../../../../components/office/InventurFormular'
import { payloadClient } from '../../../../../lib/data'
import { bueroBenutzer } from '../../../../../lib/office'

export const dynamic = 'force-dynamic'

export default async function NeueInventur() {
  await bueroBenutzer()
  const payload = await payloadClient()

  const { docs } = await payload.find({
    collection: 'inventory-items',
    sort: 'name',
    limit: 500,
    depth: 0,
    overrideAccess: true,
  })

  const heute = new Date()

  return (
    <>
      <h1>Neue Inventur</h1>
      <p className="buero-unterzeile">
        Die Zählliste steht schon: alle Posten mit ihrem Soll-Bestand. Eintragen, was wirklich da
        ist — der Rest ergibt sich.
      </p>
      <InventurFormular
        werte={{
          title: `Inventur ${heute.getFullYear()}`,
          date: heute.toISOString().slice(0, 10),
          status: 'offen',
          lines: docs.map((i) => ({
            item: i.id as number,
            name: i.name,
            einheit: i.unit ?? '',
            expected: i.quantity ?? 0,
            counted: i.quantity ?? 0,
            unitValue: i.unitValue ?? 0,
          })),
        }}
      />
    </>
  )
}
