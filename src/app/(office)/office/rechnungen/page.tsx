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

export default async function RechnungenSeite({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>
}) {
  await bueroBenutzer()
  const { filter } = await searchParams
  const payload = await payloadClient()

  const { docs: alle, totalDocs } = await payload.find({
    collection: 'outgoing-invoices',
    sort: '-issueDate',
    limit: 100,
    depth: 0,
    overrideAccess: true,
  })

  const ueberfaellig = (r: { status?: string | null; dueDate?: string | null }) =>
    r.status === 'gestellt' && Boolean(r.dueDate) && new Date(r.dueDate!).getTime() < Date.now()

  const docs =
    filter === 'ueberfaellig'
      ? alle.filter(ueberfaellig)
      : filter === 'offen'
        ? alle.filter((r) => r.status === 'gestellt')
        : alle

  const offen = alle.filter((r) => r.status === 'gestellt')
  const offenSumme = Math.round(offen.reduce((s, r) => s + (r.total ?? 0), 0) * 100) / 100
  const spaeteAnzahl = alle.filter(ueberfaellig).length

  const filterPunkte = [
    { wert: undefined, label: 'Alle' },
    { wert: 'offen', label: 'Offen' },
    { wert: 'ueberfaellig', label: `Überfällig${spaeteAnzahl ? ` (${spaeteAnzahl})` : ''}` },
  ]

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

      <div className="buero-nav" style={{ borderRadius: 10, border: '1px solid var(--buero-linie)' }}>
        {filterPunkte.map((f) => (
          <Link
            key={f.label}
            href={f.wert ? `/office/rechnungen?filter=${f.wert}` : '/office/rechnungen'}
            aria-current={filter === f.wert ? 'page' : undefined}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <div className="buero-liste" style={{ marginTop: '1rem' }}>
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
            const spaet = ueberfaellig(r)
            const gemahnt = (r.reminders ?? []).length
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
                  {gemahnt > 0 && (
                    <span className="buero-marker offen">
                      {gemahnt === 1 ? 'erinnert' : `${gemahnt}× gemahnt`}
                    </span>
                  )}
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
