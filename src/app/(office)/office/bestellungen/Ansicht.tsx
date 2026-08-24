'use client'

import Link from 'next/link'
import React, { useMemo } from 'react'

import { useBestand } from '../../../../lib/buero/bestand'
import { datum, euro } from '../../../../lib/format'
import {
  BESTELL_STATUS,
  RUECKGABE_GRUND,
  RUECKGABE_STATUS,
  statusKarte,
  balkenKlasse,
  textKarte,
} from '../../../../lib/listen'

/** Bestellungen aus dem Shop — gerechnet aus dem Bestand im Gerät. */

const STATUS = statusKarte(BESTELL_STATUS)
const GRUND = textKarte(RUECKGABE_GRUND)
const STAND = statusKarte(RUECKGABE_STATUS)

/** Läuft noch etwas zurück? Erstattet und abgelehnt sind erledigt. */
const rueckgabeOffen = (r?: Bestellung['rueckgabe']) =>
  Boolean(r?.grund) && r?.status !== 'erstattet' && r?.status !== 'abgelehnt'

type Bestellung = {
  id: number | string
  orderNumber?: string | null
  status?: string | null
  total?: number | null
  createdAt?: string | null
  deliveryMethod?: string | null
  customer?: { name?: string | null } | null
  items?: unknown[] | null
  rueckgabe?: {
    grund?: string | null
    status?: string | null
    betrag?: number | null
  } | null
}

export function BestellungenAnsicht() {
  const alle = useBestand<Bestellung>('bestellungen')
  const bestellungen = useMemo(
    () => [...alle].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')),
    [alle],
  )
  const offen = bestellungen.filter(
    (o) => o.status === 'paid' || o.status === 'inProduction',
  ).length
  /*
   * Was zurückläuft, gehört in die Kopfzeile.
   *
   * Ein Storno war bis hierher folgenlos — und eine Erstattung, an die
   * niemand erinnert wird, bleibt liegen, bis der Kunde nachfragt. Deshalb
   * steht die Zahl oben und nicht nur als Zeichen in der Zeile.
   */
  const zurueck = bestellungen.filter((o) => rueckgabeOffen(o.rueckgabe)).length

  return (
    <>
      <div>
        <h1>Bestellungen</h1>
        <p className="buero-unterzeile">
          {bestellungen.length} Bestellungen · {offen} noch nicht draußen
          {zurueck > 0 ? ` · ${zurueck} in Rückabwicklung` : ''}
        </p>
      </div>

      <div className="buero-liste">
        {bestellungen.length === 0 ? (
          <div className="buero-leer">Noch keine Bestellung.</div>
        ) : (
          bestellungen.map((o) => {
            const s = STATUS[o.status ?? ''] ?? { text: o.status, art: '' }
            const anzahl = (o.items ?? []).length
            return (
              <Link
                key={o.id}
                href={`/office/bestellungen/${o.id}`}
                className={`buero-zeile ${balkenKlasse(STATUS[o.status ?? '']?.art)}`}
              >
                <div className="buero-zeile-haupt">
                  <div className="buero-zeile-titel">
                    {o.orderNumber} · {o.customer?.name ?? 'ohne Namen'}
                  </div>
                  <div className="buero-zeile-neben">
                    {datum(o.createdAt)} · {anzahl} Position{anzahl === 1 ? '' : 'en'}
                    {o.deliveryMethod === 'pickup' ? ' · Abholung' : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}>
                  {rueckgabeOffen(o.rueckgabe) && (
                    <span className={`buero-marker ${STAND[o.rueckgabe?.status ?? '']?.art ?? 'offen'}`}>
                      {GRUND[o.rueckgabe?.grund ?? ''] ?? 'Rückgabe'}
                      {o.rueckgabe?.status === 'wareZurueck' ? ' · Ware zurück' : ''}
                    </span>
                  )}
                  <span className={`buero-marker ${s.art}`}>{s.text}</span>
                  <span className="buero-betrag">{euro(o.total)}</span>
                </div>
              </Link>
            )
          })
        )}
      </div>
    </>
  )
}
