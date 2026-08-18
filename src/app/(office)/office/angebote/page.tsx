import Link from 'next/link'
import React from 'react'

import { payloadClient } from '../../../../lib/data'
import { bueroBenutzer, datum, euro } from '../../../../lib/office'

export const dynamic = 'force-dynamic'

const STATUS: Record<string, { text: string; art: string }> = {
  entwurf: { text: 'Entwurf', art: '' },
  versendet: { text: 'Versendet', art: 'offen' },
  angenommen: { text: 'Angenommen', art: 'gut' },
  abgelehnt: { text: 'Abgelehnt', art: 'warn' },
}

export default async function AngeboteSeite() {
  await bueroBenutzer()
  const payload = await payloadClient()

  const { docs, totalDocs } = await payload.find({
    collection: 'quotes',
    sort: '-createdAt',
    limit: 100,
    depth: 0,
    overrideAccess: true,
  })

  const offen = docs.filter((a) => a.status === 'versendet')
  const offenSumme = Math.round(offen.reduce((s, a) => s + (a.total ?? 0), 0) * 100) / 100

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
          <h1>Angebote</h1>
          <p className="buero-unterzeile">
            {totalDocs} Angebote · {euro(offenSumme)} noch in der Schwebe
          </p>
        </div>
        <Link href="/office/angebote/neu" className="buero-knopf">
          Angebot schreiben
        </Link>
      </div>

      <div className="buero-liste">
        {docs.length === 0 ? (
          <div className="buero-leer">
            Noch kein Angebot.
            <br />
            <Link href="/office/angebote/neu" style={{ textDecoration: 'underline' }}>
              Erstes Angebot schreiben
            </Link>
          </div>
        ) : (
          docs.map((a) => {
            const s = STATUS[a.status] ?? { text: a.status, art: '' }
            const abgelaufen =
              a.status === 'versendet' && a.validUntil && new Date(a.validUntil).getTime() < Date.now()
            return (
              <Link key={a.id} href={`/office/angebote/${a.id}`} className="buero-zeile">
                <div className="buero-zeile-haupt">
                  <div className="buero-zeile-titel">
                    {a.quoteNumber ?? 'Entwurf'} · {a.title || a.customerName || 'ohne Bezeichnung'}
                  </div>
                  <div className="buero-zeile-neben">
                    {a.customerName ?? 'ohne Kunde'}
                    {a.validUntil ? ` · gültig bis ${datum(a.validUntil)}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}>
                  <span className={`buero-marker ${abgelaufen ? 'warn' : s.art}`}>
                    {abgelaufen ? 'abgelaufen' : s.text}
                  </span>
                  <span className="buero-betrag">{euro(a.total)}</span>
                </div>
              </Link>
            )
          })
        )}
      </div>
    </>
  )
}
