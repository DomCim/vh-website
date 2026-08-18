import Link from 'next/link'
import { notFound } from 'next/navigation'
import React from 'react'

import { BestellungFormular } from '../../../../../components/office/BestellungFormular'
import { payloadClient } from '../../../../../lib/data'
import { bedarfFuerBestellung } from '../../../../../lib/material'
import { bueroBenutzer, datum, euro } from '../../../../../lib/office'

export const dynamic = 'force-dynamic'

export default async function BestellungAnsehen({ params }: { params: Promise<{ id: string }> }) {
  await bueroBenutzer()
  const { id } = await params
  const payload = await payloadClient()

  const o = await payload
    .findByID({ collection: 'orders', id, depth: 0, overrideAccess: true })
    .catch(() => null)
  if (!o) notFound()

  const [{ docs: auftraege }, bedarf] = await Promise.all([
    payload.find({
      collection: 'jobs',
      where: { order: { equals: o.id } },
      limit: 5,
      depth: 0,
      overrideAccess: true,
    }),
    bedarfFuerBestellung(payload, o),
  ])
  const fehlend = bedarf.filter((b) => b.fehlt > 0)

  const anschrift = o.shippingAddress
  const kunde = o.customer

  return (
    <>
      <h1>{o.orderNumber}</h1>
      <p className="buero-unterzeile">
        {datum(o.createdAt)} · {kunde?.name ?? 'ohne Namen'}
        {kunde?.email ? ` · ${kunde.email}` : ''}
      </p>

      {fehlend.length > 0 && (
        <p className="buero-hinweis">
          Material fehlt: {fehlend.map((f) => `${f.name} (${f.fehlt} ${f.einheit})`).join(', ')}
        </p>
      )}

      {auftraege.length > 0 && (
        <p className="buero-unterzeile">
          Fertigung:{' '}
          {auftraege.map((j) => (
            <Link
              key={j.id}
              href={`/office/auftraege/${j.id}`}
              style={{ textDecoration: 'underline' }}
            >
              {j.jobNumber}{' '}
            </Link>
          ))}
        </p>
      )}

      <h2>Positionen</h2>
      <div className="buero-liste">
        {(o.items ?? []).map((p, i) => (
          <div key={i} className="buero-zeile">
            <div className="buero-zeile-haupt">
              <div className="buero-zeile-titel">
                {[p.titleSnapshot, p.variantTitle, p.color].filter(Boolean).join(' · ')}
              </div>
              <div className="buero-zeile-neben">
                {p.quantity} × {euro(p.unitPrice)}
              </div>
            </div>
            <span className="buero-betrag">{euro((p.quantity ?? 0) * (p.unitPrice ?? 0))}</span>
          </div>
        ))}
        <div className="buero-zeile">
          <div className="buero-zeile-haupt">
            <div className="buero-zeile-titel">Gesamt</div>
            <div className="buero-zeile-neben">
              {o.deliveryMethod === 'pickup' ? 'Abholung' : `Versand ${euro(o.shippingTotal)}`}
              {o.discount ? ` · Rabatt ${euro(o.discount)}` : ''}
            </div>
          </div>
          <span className="buero-betrag">{euro(o.total)}</span>
        </div>
      </div>

      {anschrift?.line1 && (
        <>
          <h2>Lieferadresse</h2>
          <div className="buero-karte">
            {kunde?.name}
            <br />
            {anschrift.line1}
            {anschrift.line2 ? (
              <>
                <br />
                {anschrift.line2}
              </>
            ) : null}
            <br />
            {[anschrift.postalCode, anschrift.city].filter(Boolean).join(' ')}
            <br />
            {anschrift.country}
            {kunde?.phone ? (
              <>
                <br />
                {kunde.phone}
              </>
            ) : null}
          </div>
        </>
      )}

      <h2>Stand</h2>
      <BestellungFormular
        werte={{
          id: o.id,
          status: o.status,
          trackingNumber: o.trackingNumber,
          trackingUrl: o.trackingUrl,
          expectedReady: o.expectedReady,
        }}
      />
    </>
  )
}
