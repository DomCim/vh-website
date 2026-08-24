'use client'

import Link from 'next/link'
import React, { useMemo } from 'react'

import { useBestand } from '../../../../lib/buero/bestand'
import { balkenKlasse } from '../../../../lib/listen'
import { euro } from '../../../../lib/format'

/** Inventar — Bestandswert und Mindestbestände rechnet die Seite selbst. */

const ART: Record<string, string> = {
  material: 'Material',
  werkzeug: 'Werkzeug',
  maschine: 'Maschine',
  fertigware: 'Fertiges Stück',
  sonstiges: 'Sonstiges',
}

type Posten = {
  id: number | string
  name?: string | null
  type?: string | null
  location?: string | null
  unit?: string | null
  quantity?: number | null
  minQuantity?: number | null
  unitValue?: number | null
}

export function InventarAnsicht() {
  const alle = useBestand<Posten>('inventar')
  const posten = useMemo(
    () => [...alle].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'de')),
    [alle],
  )

  const wert =
    Math.round(posten.reduce((s, i) => s + (i.quantity ?? 0) * (i.unitValue ?? 0), 0) * 100) / 100
  const knapp = posten.filter(
    (i) => typeof i.minQuantity === 'number' && (i.quantity ?? 0) < i.minQuantity,
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
          <h1>Inventar</h1>
          <p className="buero-unterzeile">
            {posten.length} Posten · Bestandswert {euro(wert)}
          </p>
        </div>
        <Link href="/office/inventar/neu" className="buero-knopf">
          Posten anlegen
        </Link>
      </div>

      {knapp.length > 0 && (
        <p className="buero-hinweis">
          {knapp.length} Posten liegen unter dem Mindestbestand:{' '}
          {knapp.map((k) => k.name).join(', ')}
        </p>
      )}

      <div className="buero-liste">
        {posten.length === 0 ? (
          <div className="buero-leer">Noch nichts erfasst.</div>
        ) : (
          posten.map((i) => {
            const wenig = typeof i.minQuantity === 'number' && (i.quantity ?? 0) < i.minQuantity
            return (
              // Rot heißt „über der Zeit": Unter dem Mindestbestand fehlt
              // Material, bevor der nächste Auftrag es braucht.
              <Link
                key={i.id}
                href={`/office/inventar/${i.id}`}
                className={`buero-zeile ${balkenKlasse(wenig ? 'warn' : '')}`}
              >
                <div className="buero-zeile-haupt">
                  <div className="buero-zeile-titel">{i.name}</div>
                  <div className="buero-zeile-neben">
                    {ART[i.type ?? ''] ?? i.type}
                    {i.location ? ` · ${i.location}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}>
                  {wenig && <span className="buero-marker warn">knapp</span>}
                  <span className="buero-betrag">
                    {i.quantity ?? 0} {i.unit ?? ''}
                  </span>
                </div>
              </Link>
            )
          })
        )}
      </div>
    </>
  )
}
