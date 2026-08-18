import Link from 'next/link'
import React from 'react'

import { AUSGABEN_KATEGORIEN } from '../../../../collections/Expenses'
import { payloadClient } from '../../../../lib/data'
import { bueroBenutzer, datum, euro } from '../../../../lib/office'

export const dynamic = 'force-dynamic'

const KATEGORIE_TEXT = Object.fromEntries(AUSGABEN_KATEGORIEN.map((k) => [k.value, k.label]))

export default async function BelegeSeite({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; jahr?: string }>
}) {
  await bueroBenutzer()
  const { filter, jahr } = await searchParams
  const payload = await payloadClient()

  const bedingungen: Record<string, unknown>[] = []
  if (filter === 'ungeprueft') bedingungen.push({ 'extraction.status': { equals: 'ungeprueft' } })
  if (filter === 'ohne-beleg') bedingungen.push({ document: { exists: false } })
  if (filter === 'offen') bedingungen.push({ paid: { equals: false } })
  if (jahr) {
    bedingungen.push({ invoiceDate: { greater_than_equal: `${jahr}-01-01` } })
    bedingungen.push({ invoiceDate: { less_than: `${Number(jahr) + 1}-01-01` } })
  }

  const { docs, totalDocs } = await payload.find({
    collection: 'expenses',
    where: bedingungen.length ? { and: bedingungen as never } : undefined,
    sort: '-invoiceDate',
    limit: 100,
    depth: 0,
    overrideAccess: true,
  })

  const summe = Math.round(docs.reduce((s, b) => s + (b.grossAmount ?? 0), 0) * 100) / 100

  const filterPunkte = [
    { wert: undefined, label: 'Alle' },
    { wert: 'ungeprueft', label: 'Ungeprüft' },
    { wert: 'ohne-beleg', label: 'Ohne Beleg' },
    { wert: 'offen', label: 'Unbezahlt' },
  ]

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
          <h1>Belege</h1>
          <p className="buero-unterzeile">
            {totalDocs} Belege · {euro(summe)} in dieser Ansicht
          </p>
        </div>
        <Link href="/office/belege/neu" className="buero-knopf">
          Beleg erfassen
        </Link>
      </div>

      <div className="buero-nav" style={{ borderRadius: 10, border: '1px solid var(--buero-linie)' }}>
        {filterPunkte.map((f) => (
          <Link
            key={f.label}
            href={f.wert ? `/office/belege?filter=${f.wert}` : '/office/belege'}
            aria-current={filter === f.wert ? 'page' : undefined}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <div className="buero-liste" style={{ marginTop: '1rem' }}>
        {docs.length === 0 ? (
          <div className="buero-leer">
            Keine Belege in dieser Ansicht.
            <br />
            <Link href="/office/belege/neu" style={{ textDecoration: 'underline' }}>
              Ersten Beleg erfassen
            </Link>
          </div>
        ) : (
          docs.map((b) => (
            <Link key={b.id} href={`/office/belege/${b.id}`} className="buero-zeile">
              <div className="buero-zeile-haupt">
                <div className="buero-zeile-titel">
                  {b.title || b.supplierName || 'ohne Bezeichnung'}
                </div>
                <div className="buero-zeile-neben">
                  {datum(b.invoiceDate)} · {KATEGORIE_TEXT[b.category] ?? b.category}
                  {b.invoiceNumber ? ` · ${b.invoiceNumber}` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}>
                {!b.document && <span className="buero-marker warn">kein Beleg</span>}
                {b.extraction?.status === 'ungeprueft' && (
                  <span className="buero-marker offen">ungeprüft</span>
                )}
                {!b.paid && <span className="buero-marker offen">unbezahlt</span>}
                <span className="buero-betrag">{euro(b.grossAmount)}</span>
              </div>
            </Link>
          ))
        )}
      </div>
    </>
  )
}
