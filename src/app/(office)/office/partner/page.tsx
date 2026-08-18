import Link from 'next/link'
import React from 'react'

import { payloadClient } from '../../../../lib/data'
import { bueroBenutzer } from '../../../../lib/office'

export const dynamic = 'force-dynamic'

const ART: Record<string, string> = {
  lieferant: 'Lieferant',
  kunde: 'Kunde',
  dienstleister: 'Dienstleister',
  beides: 'Mehreres',
}

export default async function PartnerSeite() {
  await bueroBenutzer()
  const payload = await payloadClient()

  const { docs, totalDocs } = await payload.find({
    collection: 'contacts',
    sort: 'name',
    limit: 300,
    depth: 0,
    overrideAccess: true,
  })

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
            {totalDocs} Einträge — Lieferanten, Kunden und die Betriebe, die zuarbeiten.
          </p>
        </div>
        <Link href="/office/partner/neu" className="buero-knopf">
          Partner anlegen
        </Link>
      </div>

      <div className="buero-liste">
        {docs.length === 0 ? (
          <div className="buero-leer">Noch niemand erfasst.</div>
        ) : (
          docs.map((k) => (
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
