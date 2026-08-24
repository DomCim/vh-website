'use client'

import Link from 'next/link'
import React, { useMemo } from 'react'

import { useBestand } from '../../../../lib/buero/bestand'
import { balkenKlasse } from '../../../../lib/listen'
import { datum } from '../../../../lib/format'

/**
 * Die Wareneingänge, neueste zuerst.
 *
 * Was hier steht, beantwortet die Frage, wegen der man sonst den Karton im
 * Lager sucht: Wann kam das, von wem, wie viel — und wo ist der Lieferschein.
 */

type Eingang = {
  id: number | string
  receiptNumber?: string | null
  receivedAt?: string | null
  supplierName?: string | null
  deliveryNote?: string | null
  document?: unknown
  lines?: { item?: unknown; quantity?: number | null }[] | null
}

export function WareneingangListe() {
  const eingaenge = useBestand<Eingang>('wareneingaenge')

  const sortiert = useMemo(
    () => [...eingaenge].sort((a, b) => (b.receivedAt ?? '').localeCompare(a.receivedAt ?? '')),
    [eingaenge],
  )

  return (
    <>
      <h1>Wareneingang</h1>
      <p className="buero-unterzeile">
        Was geliefert wurde — mit Lieferschein. Der Bestand wird beim Buchen erhöht.
      </p>

      <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap', margin: '.6rem 0 1rem' }}>
        <Link href="/office/wareneingang/neu" className="buero-knopf">
          Lieferung buchen
        </Link>
        <Link href="/office/nachbestellen" className="buero-knopf leise">
          Was ist bestellt?
        </Link>
      </div>

      <div className="buero-liste">
        {sortiert.length === 0 ? (
          <div className="buero-leer">Noch nichts gebucht.</div>
        ) : (
          sortiert.map((e) => (
            /*
             * Balken nur, wo etwas fehlt.
             *
             * Ein Eingang mit Lieferschein ist Ablage — grün auf fast jeder
             * Zeile sagt nichts mehr (dieselbe Überlegung wie bei den
             * Belegen). Bronze steht deshalb allein bei „ohne Papier": Das
             * ist der Zettel, der in zwei Wochen fehlt, wenn die Rechnung
             * kommt und die Mengen nicht stimmen.
             */
            <Link
              key={e.id}
              href={`/office/wareneingang/${e.id}`}
              className={`buero-zeile ${balkenKlasse(e.document ? '' : 'offen')}`}
            >
              <div className="buero-zeile-haupt">
                <div className="buero-zeile-titel">
                  {e.receiptNumber ?? 'Wareneingang'} · {e.supplierName || 'ohne Lieferant'}
                </div>
                <div className="buero-zeile-neben">
                  {datum(e.receivedAt)}
                  {e.deliveryNote ? ` · Lieferschein ${e.deliveryNote}` : ''} ·{' '}
                  {(e.lines ?? []).length} {(e.lines ?? []).length === 1 ? 'Posten' : 'Posten'}
                </div>
              </div>
              <span className={`buero-marker ${e.document ? 'gut' : 'offen'}`}>
                {e.document ? 'mit Lieferschein' : 'ohne Papier'}
              </span>
            </Link>
          ))
        )}
      </div>
    </>
  )
}
