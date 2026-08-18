import Link from 'next/link'
import React from 'react'

import { payloadClient } from '../../../../lib/data'
import { bueroBenutzer, euro } from '../../../../lib/office'

export const dynamic = 'force-dynamic'

const ART: Record<string, string> = {
  material: 'Material',
  werkzeug: 'Werkzeug',
  maschine: 'Maschine',
  fertigware: 'Fertiges Stück',
  sonstiges: 'Sonstiges',
}

export default async function InventarSeite() {
  await bueroBenutzer()
  const payload = await payloadClient()

  const { docs, totalDocs } = await payload.find({
    collection: 'inventory-items',
    sort: 'name',
    limit: 300,
    depth: 0,
    overrideAccess: true,
  })

  const wert = Math.round(docs.reduce((s, i) => s + (i.quantity ?? 0) * (i.unitValue ?? 0), 0) * 100) / 100
  const knapp = docs.filter(
    (i) => typeof i.minQuantity === 'number' && (i.quantity ?? 0) < i.minQuantity,
  )

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h1>Inventar</h1>
          <p className="buero-unterzeile">
            {totalDocs} Posten · Bestandswert {euro(wert)}
          </p>
        </div>
        <Link href="/office/inventar/neu" className="buero-knopf">
          Posten anlegen
        </Link>
      </div>

      {knapp.length > 0 && (
        <p className="buero-hinweis">
          {knapp.length} Posten liegen unter dem Mindestbestand: {knapp.map((k) => k.name).join(', ')}
        </p>
      )}

      <div className="buero-liste">
        {docs.length === 0 ? (
          <div className="buero-leer">Noch nichts erfasst.</div>
        ) : (
          docs.map((i) => {
            const wenig = typeof i.minQuantity === 'number' && (i.quantity ?? 0) < i.minQuantity
            return (
              <Link
                key={i.id}
                href={`/office/inventar/${i.id}`}
                className="buero-zeile"
              >
                <div className="buero-zeile-haupt">
                  <div className="buero-zeile-titel">{i.name}</div>
                  <div className="buero-zeile-neben">
                    {ART[i.type] ?? i.type}
                    {i.location ? ` · ${i.location}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}>
                  {wenig && <span className="buero-marker warn">knapp</span>}
                  <span className="buero-betrag">
                    {i.quantity ?? 0} {i.unit ?? ''}
                  </span>
                </div>
              </Link>
            )
          })
        )}
      </div>
    </>
  )
}
