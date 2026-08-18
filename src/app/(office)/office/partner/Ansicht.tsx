'use client'

import Link from 'next/link'
import React, { useMemo } from 'react'

import { useBestand } from '../../../../lib/buero/bestand'

/** Geschäftspartner — sortiert aus dem Bestand im Gerät. */

const ART: Record<string, string> = {
  lieferant: 'Lieferant',
  kunde: 'Kunde',
  dienstleister: 'Dienstleister',
  beides: 'Mehreres',
}

type Partner = {
  id: number | string
  name?: string | null
  city?: string | null
  email?: string | null
  phone?: string | null
  role?: string | null
}

export function PartnerAnsicht() {
  const alle = useBestand<Partner>('partner')
  const partner = useMemo(
    () => [...alle].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'de')),
    [alle],
  )

  return (
    <>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1>Geschäftspartner</h1>
          <p className="buero-unterzeile">
            {partner.length} Einträge — Lieferanten, Kunden und die Betriebe, die zuarbeiten.
          </p>
        </div>
        <Link href="/office/partner/neu" className="buero-knopf">
          Partner anlegen
        </Link>
      </div>

      <div className="buero-liste">
        {partner.length === 0 ? (
          <div className="buero-leer">Noch niemand erfasst.</div>
        ) : (
          partner.map((k) => (
            <Link key={k.id} href={`/office/partner/${k.id}`} className="buero-zeile">
              <div className="buero-zeile-haupt">
                <div className="buero-zeile-titel">{k.name}</div>
                <div className="buero-zeile-neben">
                  {[k.city, k.email, k.phone].filter(Boolean).join(' · ') || 'ohne Kontaktdaten'}
                </div>
              </div>
              <span className="buero-marker">{ART[k.role ?? 'beides'] ?? k.role}</span>
            </Link>
          ))
        )}
      </div>
    </>
  )
}
