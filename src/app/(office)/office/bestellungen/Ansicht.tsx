'use client'

import Link from 'next/link'
import React, { useMemo } from 'react'

import { useBestand } from '../../../../lib/buero/bestand'
import { datum, euro } from '../../../../lib/format'
import { BESTELL_STATUS, statusKarte, balkenKlasse } from '../../../../lib/listen'

/** Bestellungen aus dem Shop — gerechnet aus dem Bestand im Gerät. */

const STATUS = statusKarte(BESTELL_STATUS)

type Bestellung = {
  id: number | string
  orderNumber?: string | null
  status?: string | null
  total?: number | null
  createdAt?: string | null
  deliveryMethod?: string | null
  customer?: { name?: string | null } | null
  items?: unknown[] | null
}

export function BestellungenAnsicht() {
  const alle = useBestand<Bestellung>('bestellungen')
  const bestellungen = useMemo(
    () => [...alle].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')),
    [alle],
  )
  const offen = bestellungen.filter(
    (o) => o.status === 'paid' || o.status === 'inProduction',
  ).length

  return (
    <>
      <div>
        <h1>Bestellungen</h1>
        <p className="buero-unterzeile">
          {bestellungen.length} Bestellungen · {offen} noch nicht draußen
        </p>
      </div>

      <div className="buero-liste">
        {bestellungen.length === 0 ? (
          <div className="buero-leer">Noch keine Bestellung.</div>
        ) : (
          bestellungen.map((o) => {
            const s = STATUS[o.status ?? ''] ?? { text: o.status, art: '' }
            const anzahl = (o.items ?? []).length
            return (
              <Link
                key={o.id}
                href={`/office/bestellungen/${o.id}`}
                className={`buero-zeile ${balkenKlasse(STATUS[o.status ?? '']?.art)}`}
              >
                <div className="buero-zeile-haupt">
                  <div className="buero-zeile-titel">
                    {o.orderNumber} · {o.customer?.name ?? 'ohne Namen'}
                  </div>
                  <div className="buero-zeile-neben">
                    {datum(o.createdAt)} · {anzahl} Position{anzahl === 1 ? '' : 'en'}
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
