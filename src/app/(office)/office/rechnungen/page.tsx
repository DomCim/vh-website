import Link from 'next/link'
import React from 'react'

import { payloadClient } from '../../../../lib/data'
import { bueroBenutzer, datum, euro } from '../../../../lib/office'

export const dynamic = 'force-dynamic'

const STATUS: Record<string, { text: string; art: string }> = {
  entwurf: { text: 'Entwurf', art: '' },
  gestellt: { text: 'Gestellt', art: 'offen' },
  bezahlt: { text: 'Bezahlt', art: 'gut' },
  storniert: { text: 'Storniert', art: 'warn' },
}

export default async function RechnungenSeite() {
  await bueroBenutzer()
  const payload = await payloadClient()

  const { docs, totalDocs } = await payload.find({
    collection: 'outgoing-invoices',
    sort: '-issueDate',
    limit: 100,
    depth: 0,
    overrideAccess: true,
  })

  const offen = docs.filter((r) => r.status === 'gestellt')
  const offenSumme = Math.round(offen.reduce((s, r) => s + (r.total ?? 0), 0) * 100) / 100

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h1>Rechnungen</h1>
          <p className="buero-unterzeile">
            {totalDocs} Rechnungen · {euro(offenSumme)} offen
          </p>
        </div>
        <Link href="/office/rechnungen/neu" className="buero-knopf">
          Rechnung schreiben
        </Link>
      </div>

      <div className="buero-liste">
        {docs.length === 0 ? (
          <div className="buero-leer">
            Noch keine Rechnung.
            <br />
            <Link href="/office/rechnungen/neu" style={{ textDecoration: 'underline' }}>
              Erste Rechnung schreiben
            </Link>
          </div>
        ) : (
          docs.map((r) => {
            const s = STATUS[r.status] ?? { text: r.status, art: '' }
            const spaet =
              r.status === 'gestellt' && r.dueDate && new Date(r.dueDate).getTime() < Date.now()
            return (
              <Link key={r.id} href={`/office/rechnungen/${r.id}`} className="buero-zeile">
                <div className="buero-zeile-haupt">
                  <div className="buero-zeile-titel">
                    {r.invoiceNumber ?? 'Entwurf'} · {r.customerName ?? 'ohne Kunde'}
                  </div>
                  <div className="buero-zeile-neben">
                    {r.issueDate ? datum(r.issueDate) : 'noch nicht gestellt'}
                    {r.dueDate ? ` · fällig ${datum(r.dueDate)}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}>
                  <span className={`buero-marker ${spaet ? 'warn' : s.art}`}>
                    {spaet ? 'überfällig' : s.text}
                  </span>
                  <span className="buero-betrag">{euro(r.total)}</span>
                </div>
              </Link>
            )
          })
        )}
      </div>
    </>
  )
}
