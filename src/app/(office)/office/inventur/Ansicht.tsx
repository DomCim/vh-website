'use client'

import Link from 'next/link'
import React, { useMemo } from 'react'

import { useBestand } from '../../../../lib/buero/bestand'
import { balkenKlasse } from '../../../../lib/listen'
import { datum, euro } from '../../../../lib/format'

/** Inventurläufe — aus dem Bestand im Gerät. */

type Inventur = {
  id: number | string
  title?: string | null
  date?: string | null
  status?: string | null
  totalValue?: number | null
  lines?: unknown[] | null
}

export function InventurAnsicht() {
  const alle = useBestand<Inventur>('inventur')
  const laeufe = useMemo(
    () => [...alle].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')),
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
          <h1>Inventur</h1>
          <p className="buero-unterzeile">
            Der gezählte Bestand zum Stichtag — das braucht der Steuerberater zum Jahresabschluss.
          </p>
        </div>
        <Link href="/office/inventur/neu" className="buero-knopf">
          Inventur anlegen
        </Link>
      </div>

      <p className="buero-hinweis">
        Beim Abschließen werden die gezählten Mengen ins Inventar übernommen und der Wert
        eingefroren. Danach lässt sich der Lauf nicht mehr ändern.
      </p>

      <div className="buero-liste">
        {laeufe.length === 0 ? (
          <div className="buero-leer">Noch keine Inventur erfasst.</div>
        ) : (
          laeufe.map((s) => (
            <Link
              key={s.id}
              href={`/office/inventur/${s.id}`}
              className={`buero-zeile ${balkenKlasse(
                s.status === 'abgeschlossen' ? 'gut' : 'offen',
              )}`}
            >
              <div className="buero-zeile-haupt">
                <div className="buero-zeile-titel">{s.title}</div>
                <div className="buero-zeile-neben">
                  Stichtag {datum(s.date)} · {(s.lines ?? []).length} Posten gezählt
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}>
                <span className={`buero-marker ${s.status === 'abgeschlossen' ? 'gut' : 'offen'}`}>
                  {s.status === 'abgeschlossen' ? 'abgeschlossen' : 'offen'}
                </span>
                <span className="buero-betrag">{euro(s.totalValue)}</span>
              </div>
            </Link>
          ))
        )}
      </div>
    </>
  )
}
