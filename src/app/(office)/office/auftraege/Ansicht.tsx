'use client'

import Link from 'next/link'
import React, { useMemo } from 'react'

import { useBestand } from '../../../../lib/buero/bestand'
import { datum } from '../../../../lib/format'
import { AUFTRAG_STATUS, statusKarte, balkenKlasse } from '../../../../lib/listen'

/** Fertigungsaufträge — gerechnet aus dem Bestand im Gerät. */

const STATUS = statusKarte(AUFTRAG_STATUS)

const HERKUNFT: Record<string, string> = {
  shop: 'Shop-Bestellung',
  angebot: 'Angebot',
  manuell: 'von Hand',
}

type Rechnung = {
  auftrag?: unknown
  status?: string | null
  dueDate?: string | null
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
  const rechnungen = useBestand<Rechnung>('rechnungen')

  /*
   * Welche Aufträge auf Geld warten.
   *
   * Steht das nur in der Auftragsseite, sieht es niemand — geschaut wird auf
   * die Liste. „Überfällig" wegen des Termins und „überfällig" wegen der
   * Zahlung sind außerdem zwei verschiedene Dinge: Beim zweiten wartet die
   * Werkstatt zu Recht, und der Termin verschiebt sich deshalb.
   */
  const wartetAufGeld = useMemo(() => {
    const jetzt = Date.now()
    const ids = new Set<string>()
    for (const r of rechnungen) {
      if (r.status !== 'gestellt' || !r.dueDate) continue
      if (new Date(r.dueDate).getTime() >= jetzt) continue
      const id = typeof r.auftrag === 'object' ? (r.auftrag as { id?: number })?.id : r.auftrag
      if (id !== null && id !== undefined) ids.add(String(id))
    }
    return ids
  }, [rechnungen])
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
            const wartet = wartetAufGeld.has(String(j.id))
            const spaet =
              j.status !== 'fertig' &&
              j.status !== 'geliefert' &&
              j.status !== 'abgebrochen' &&
              j.dueDate &&
              new Date(j.dueDate).getTime() < Date.now()
            return (
              <Link
                key={j.id}
                href={`/office/auftraege/${j.id}`}
                className={`buero-zeile ${balkenKlasse(STATUS[j.status ?? '']?.art)}`}
              >
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
                <span className={`buero-marker ${wartet || spaet ? 'warn' : s.art}`}>
                  {wartet ? 'wartet auf Zahlung' : spaet ? 'überfällig' : s.text}
                </span>
              </Link>
            )
          })
        )}
      </div>
    </>
  )
}
