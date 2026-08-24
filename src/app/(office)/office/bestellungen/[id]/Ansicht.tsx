'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import React, { useMemo } from 'react'

import { BestellungFormular } from '../../../../../components/office/BestellungFormular'
import {
  RueckgabeFormular,
  type RueckgabeWerte,
} from '../../../../../components/office/RueckgabeFormular'
import { useAbgleich, useBestand, useDatensatz } from '../../../../../lib/buero/bestand'
import { bedarfFuerBestellung, type Artikel, type Posten } from '../../../../../lib/buero/material'
import { datum, euro } from '../../../../../lib/format'

/** Eine Shop-Bestellung im Ganzen. */

type Position = {
  titleSnapshot?: string | null
  variantTitle?: string | null
  color?: string | null
  quantity?: number | null
  unitPrice?: number | null
  product?: unknown
}

type Bestellung = {
  id: number | string
  orderNumber?: string | null
  createdAt?: string | null
  items?: Position[] | null
  customer?: { name?: string | null; email?: string | null; phone?: string | null } | null
  shippingAddress?: {
    line1?: string | null
    line2?: string | null
    postalCode?: string | null
    city?: string | null
    country?: string | null
  } | null
  [feld: string]: unknown
}

type Auftrag = { id: number | string; order?: unknown; jobNumber?: string | null }

export function BestellungAnsicht() {
  const { id } = useParams<{ id: string }>()
  const o = useDatensatz<Bestellung>('bestellungen', id)
  const alleAuftraege = useBestand<Auftrag>('auftraege')
  const artikel = useBestand<Artikel>('artikel')
  const inventar = useBestand<Posten>('inventar')
  const { bereit } = useAbgleich()

  const auftraege = useMemo(
    () =>
      alleAuftraege
        .filter((j) => j.order != null && String(j.order) === String(id))
        .slice(0, 5),
    [alleAuftraege, id],
  )

  const fehlend = useMemo(
    () => (o ? bedarfFuerBestellung(o, artikel, inventar).filter((b) => b.fehlt > 0) : []),
    [o, artikel, inventar],
  )

  if (!o) {
    return (
      <>
        <h1>Bestellung</h1>
        <div className="buero-leer">
          {bereit ? 'Diese Bestellung gibt es nicht (mehr).' : 'wird geholt …'}
        </div>
      </>
    )
  }

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
              {o.deliveryMethod === 'pickup'
                ? 'Abholung'
                : `Versand ${euro(o.shippingTotal as number)}`}
              {o.discount ? ` · Rabatt ${euro(o.discount as number)}` : ''}
            </div>
          </div>
          <span className="buero-betrag">{euro(o.total as number)}</span>
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

      <h2>Rückabwicklung</h2>
      <RueckgabeFormular
        id={o.id as number}
        gesamt={o.total as number}
        werte={(o.rueckgabe ?? {}) as RueckgabeWerte}
      />

      <h2>Stand</h2>
      <BestellungFormular
        werte={{
          id: o.id,
          status: o.status as string,
          trackingNumber: o.trackingNumber as string,
          trackingUrl: o.trackingUrl as string,
          expectedReady: o.expectedReady as string,
        }}
      />
    </>
  )
}
