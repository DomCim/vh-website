'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import React, { useMemo } from 'react'

import { useBestand } from '../../../../lib/buero/bestand'
import { datum, euro } from '../../../../lib/format'
import { AUSGABEN_KATEGORIEN } from '../../../../lib/listen'

/**
 * Belege — gerechnet aus dem Bestand im Gerät.
 *
 * Früher fragte diese Seite bei jedem Aufruf die Datenbank. Jetzt liegen die
 * Belege ohnehin im Browser, also wird hier nur noch sortiert und gezählt.
 * Das hat zwei Folgen, die man merkt: Der Wechsel zwischen den Filtern ist
 * ohne Wartezeit, und in der Werkstatt ohne Netz steht die Liste trotzdem da.
 */

const KATEGORIE_TEXT = Object.fromEntries(AUSGABEN_KATEGORIEN.map((k) => [k.value, k.label]))

type Beleg = {
  id: number | string
  title?: string | null
  supplierName?: string | null
  invoiceNumber?: string | null
  invoiceDate?: string | null
  category?: string | null
  grossAmount?: number | null
  paid?: boolean | null
  document?: number | string | null
  extraction?: { status?: string | null } | null
}

const FILTER = [
  { wert: undefined, label: 'Alle' },
  { wert: 'ungeprueft', label: 'Ungeprüft' },
  { wert: 'ohne-beleg', label: 'Ohne Beleg' },
  { wert: 'offen', label: 'Unbezahlt' },
] as const

export function BelegeAnsicht() {
  const suche = useSearchParams()
  const filter = suche.get('filter') ?? undefined
  const jahr = suche.get('jahr') ?? undefined
  const alle = useBestand<Beleg>('belege')

  const belege = useMemo(() => {
    let liste = alle
    if (filter === 'ungeprueft') liste = liste.filter((b) => b.extraction?.status === 'ungeprueft')
    if (filter === 'ohne-beleg') liste = liste.filter((b) => !b.document)
    if (filter === 'offen') liste = liste.filter((b) => !b.paid)
    if (jahr) liste = liste.filter((b) => (b.invoiceDate ?? '').startsWith(jahr))

    // Neueste zuerst; Belege ohne Datum ans Ende
    return [...liste].sort((a, b) => (b.invoiceDate ?? '').localeCompare(a.invoiceDate ?? ''))
  }, [alle, filter, jahr])

  const summe = useMemo(
    () => Math.round(belege.reduce((s, b) => s + (b.grossAmount ?? 0), 0) * 100) / 100,
    [belege],
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
          <h1>Belege</h1>
          <p className="buero-unterzeile">
            {belege.length} Belege · {euro(summe)} in dieser Ansicht
          </p>
        </div>
        <Link href="/office/belege/neu" className="buero-knopf">
          Beleg erfassen
        </Link>
      </div>

      <div className="buero-reiter">
        {FILTER.map((f) => (
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
        {belege.length === 0 ? (
          <div className="buero-leer">
            Keine Belege in dieser Ansicht.
            <br />
            <Link href="/office/belege/neu" style={{ textDecoration: 'underline' }}>
              Ersten Beleg erfassen
            </Link>
          </div>
        ) : (
          belege.map((b) => (
            <Link key={b.id} href={`/office/belege/${b.id}`} className="buero-zeile">
              <div className="buero-zeile-haupt">
                <div className="buero-zeile-titel">
                  {b.title || b.supplierName || 'ohne Bezeichnung'}
                </div>
                <div className="buero-zeile-neben">
                  {datum(b.invoiceDate)} · {KATEGORIE_TEXT[b.category ?? ''] ?? b.category}
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
