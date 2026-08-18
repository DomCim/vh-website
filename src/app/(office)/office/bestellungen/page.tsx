import Link from 'next/link'
import React from 'react'

import { payloadClient } from '../../../../lib/data'
import { bueroBenutzer, datum, euro } from '../../../../lib/office'

export const dynamic = 'force-dynamic'

const STATUS: Record<string, { text: string; art: string }> = {
  pending: { text: 'Unbezahlt', art: 'offen' },
  paid: { text: 'Bezahlt', art: 'gut' },
  inProduction: { text: 'In Fertigung', art: 'offen' },
  shipped: { text: 'Versendet', art: 'gut' },
  cancelled: { text: 'Storniert', art: 'warn' },
}

export default async function BestellungenSeite() {
  await bueroBenutzer()
  const payload = await payloadClient()

  const { docs, totalDocs } = await payload.find({
    collection: 'orders',
    sort: '-createdAt',
    limit: 100,
    depth: 0,
    overrideAccess: true,
  })

  const offen = docs.filter((o) => o.status === 'paid' || o.status === 'inProduction')

  return (
    <>
      <div>
        <h1>Bestellungen</h1>
        <p className="buero-unterzeile">
          {totalDocs} Bestellungen · {offen.length} noch nicht draußen
        </p>
      </div>

      <div className="buero-liste">
        {docs.length === 0 ? (
          <div className="buero-leer">Noch keine Bestellung.</div>
        ) : (
          docs.map((o) => {
            const s = STATUS[o.status] ?? { text: o.status, art: '' }
            return (
              <Link key={o.id} href={`/office/bestellungen/${o.id}`} className="buero-zeile">
                <div className="buero-zeile-haupt">
                  <div className="buero-zeile-titel">
                    {o.orderNumber} · {o.customer?.name ?? 'ohne Namen'}
                  </div>
                  <div className="buero-zeile-neben">
                    {datum(o.createdAt)} · {(o.items ?? []).length} Position
                    {(o.items ?? []).length === 1 ? '' : 'en'}
                    {o.deliveryMethod === 'pickup' ? ' · Abholung' : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}>
                  <span className={`buero-marker ${s.art}`}>{s.text}</span>
                  <span className="buero-betrag">{euro(o.total)}</span>
                </div>
              </Link>
            )
          })
        )}
      </div>
    </>
  )
}
