'use client'

import Link from 'next/link'
import React, { useMemo } from 'react'

import { useBestand } from '../../../../lib/buero/bestand'
import { datum } from '../../../../lib/format'

/** Fertigungsaufträge — gerechnet aus dem Bestand im Gerät. */

const STATUS: Record<string, { text: string; art: string }> = {
  geplant: { text: 'Geplant', art: '' },
  inFertigung: { text: 'In Fertigung', art: 'offen' },
  fertig: { text: 'Fertig', art: 'gut' },
  geliefert: { text: 'Geliefert', art: 'gut' },
  abgebrochen: { text: 'Abgebrochen', art: 'warn' },
}

const HERKUNFT: Record<string, string> = {
  shop: 'Shop-Bestellung',
  angebot: 'Angebot',
  manuell: 'von Hand',
}

type Auftrag = {
  id: number | string
  jobNumber?: string | null
  title?: string | null
  status?: string | null
  source?: string | null
  customerName?: string | null
  dueDate?: string | null
  createdAt?: string | null
}

export function AuftraegeAnsicht() {
  const alle = useBestand<Auftrag>('auftraege')
  const auftraege = useMemo(
    () => [...alle].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')),
    [alle],
  )
  const laufend = auftraege.filter(
    (j) => j.status === 'geplant' || j.status === 'inFertigung',
  ).length

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
          <h1>Fertigungsaufträge</h1>
          <p className="buero-unterzeile">
            {auftraege.length} Aufträge · {laufend} laufen gerade
          </p>
        </div>
        <Link href="/office/auftraege/neu" className="buero-knopf">
          Auftrag anlegen
        </Link>
      </div>

      <div className="buero-liste">
        {auftraege.length === 0 ? (
          <div className="buero-leer">
            Noch kein Auftrag. Bezahlte Shop-Bestellungen landen hier von selbst.
          </div>
        ) : (
          auftraege.map((j) => {
            const s = STATUS[j.status ?? ''] ?? { text: j.status, art: '' }
            const spaet =
              j.status !== 'fertig' &&
              j.status !== 'geliefert' &&
              j.status !== 'abgebrochen' &&
              j.dueDate &&
              new Date(j.dueDate).getTime() < Date.now()
            return (
              <Link key={j.id} href={`/office/auftraege/${j.id}`} className="buero-zeile">
                <div className="buero-zeile-haupt">
                  <div className="buero-zeile-titel">
                    {j.jobNumber} · {j.title}
                  </div>
                  <div className="buero-zeile-neben">
                    {HERKUNFT[j.source ?? ''] ?? j.source}
                    {j.customerName ? ` · ${j.customerName}` : ''}
                    {j.dueDate ? ` · fertig bis ${datum(j.dueDate)}` : ''}
                  </div>
                </div>
                <span className={`buero-marker ${spaet ? 'warn' : s.art}`}>
                  {spaet ? 'überfällig' : s.text}
                </span>
              </Link>
            )
          })
        )}
      </div>
    </>
  )
}
