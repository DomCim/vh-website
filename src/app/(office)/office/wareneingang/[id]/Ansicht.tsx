'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import React from 'react'

import { useAbgleich, useBestand, useDatensatz } from '../../../../../lib/buero/bestand'
import { datum } from '../../../../../lib/format'

/** Ein gebuchter Wareneingang — was kam, von wem, und das Papier dazu. */

type Eingang = {
  id: number | string
  receiptNumber?: string | null
  receivedAt?: string | null
  supplierName?: string | null
  deliveryNote?: string | null
  note?: string | null
  document?: unknown
  lines?: { item?: unknown; quantity?: number | null; note?: string | null }[] | null
}

type Posten = { id: number | string; name?: string | null; unit?: string | null }
type Medium = { id: number | string; url?: string | null }

const kennung = (wert: unknown) =>
  typeof wert === 'object' && wert ? (wert as { id?: number }).id : wert

export function WareneingangAnsicht() {
  const { id } = useParams<{ id: string }>()
  const e = useDatensatz<Eingang>('wareneingaenge', id)
  const inventar = useBestand<Posten>('inventar')
  const medien = useBestand<Medium>('medien')
  const { bereit } = useAbgleich()

  if (!e) {
    return (
      <>
        <h1>Wareneingang</h1>
        <div className="buero-leer">
          {bereit ? 'Diesen Wareneingang gibt es nicht (mehr).' : 'wird geholt …'}
        </div>
      </>
    )
  }

  const bildId = kennung(e.document)
  const bild = medien.find((m) => String(m.id) === String(bildId))

  return (
    <>
      <h1>{e.receiptNumber ?? 'Wareneingang'}</h1>
      <p className="buero-unterzeile">
        {e.supplierName || 'ohne Lieferant'} · geliefert am {datum(e.receivedAt)}
        {e.deliveryNote ? ` · Lieferschein ${e.deliveryNote}` : ''}
      </p>

      {bild?.url ? (
        <p className="buero-unterzeile">
          <a href={bild.url} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>
            Lieferschein ansehen
          </a>
        </p>
      ) : (
        <p className="buero-hinweis">
          Zu dieser Lieferung liegt kein Lieferschein. Gebraucht wird er, wenn die Rechnung kommt
          und die Mengen nicht stimmen.
        </p>
      )}

      <h2>Gebuchte Posten</h2>
      <div className="buero-liste">
        {(e.lines ?? []).map((z, i) => {
          const posten = inventar.find((p) => String(p.id) === String(kennung(z.item)))
          return (
            <Link
              key={i}
              href={`/office/inventar/${kennung(z.item)}`}
              className="buero-zeile"
            >
              <div className="buero-zeile-haupt">
                <div className="buero-zeile-titel">{posten?.name ?? 'Posten'}</div>
                <div className="buero-zeile-neben">
                  {z.quantity} {posten?.unit ?? ''}
                  {z.note ? ` · ${z.note}` : ''}
                </div>
              </div>
              {/* Neutral: In dieser Liste ist jede Zeile gebucht — grün auf allen
                  sagt nichts und nimmt der Farbe ihre Bedeutung. */}
              <span className="buero-marker">gebucht</span>
            </Link>
          )
        })}
      </div>

      {e.note && <p className="buero-unterzeile">{e.note}</p>}

      <p className="buero-unterzeile" style={{ marginTop: '1.2rem' }}>
        Menge falsch gebucht? Am Posten eine Korrektur buchen — dann steht im Verlauf, dass
        korrigiert wurde, statt dass eine Zahl still eine andere wird.
      </p>
    </>
  )
}
