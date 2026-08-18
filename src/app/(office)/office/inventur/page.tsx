import Link from 'next/link'
import React from 'react'

import { payloadClient } from '../../../../lib/data'
import { bueroBenutzer, datum, euro } from '../../../../lib/office'

export const dynamic = 'force-dynamic'

export default async function InventurSeite() {
  await bueroBenutzer()
  const payload = await payloadClient()

  const { docs } = await payload.find({
    collection: 'stocktakes',
    sort: '-date',
    limit: 50,
    depth: 0,
    overrideAccess: true,
  })

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h1>Inventur</h1>
          <p className="buero-unterzeile">
            Der gezählte Bestand zum Stichtag — das braucht der Steuerberater zum Jahresabschluss.
          </p>
        </div>
        <Link href="/admin/collections/stocktakes/create" className="buero-knopf">
          Inventur anlegen
        </Link>
      </div>

      <p className="buero-hinweis">
        Beim Abschließen werden die gezählten Mengen ins Inventar übernommen und der Wert
        eingefroren. Danach lässt sich der Lauf nicht mehr ändern.
      </p>

      <div className="buero-liste">
        {docs.length === 0 ? (
          <div className="buero-leer">Noch keine Inventur erfasst.</div>
        ) : (
          docs.map((s) => (
            <Link key={s.id} href={`/admin/collections/stocktakes/${s.id}`} className="buero-zeile">
              <div className="buero-zeile-haupt">
                <div className="buero-zeile-titel">{s.title}</div>
                <div className="buero-zeile-neben">
                  Stichtag {datum(s.date)} · {(s.lines ?? []).length} Posten gezählt
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}>
                <span className={`buero-marker ${s.status === 'abgeschlossen' ? 'gut' : 'offen'}`}>
                  {s.status === 'abgeschlossen' ? 'abgeschlossen' : 'offen'}
                </span>
                <span className="buero-betrag">{euro(s.totalValue)}</span>
              </div>
            </Link>
          ))
        )}
      </div>
    </>
  )
}
