'use client'

import Link from 'next/link'
import React, { useMemo } from 'react'

import { useBestand } from '../../../../lib/buero/bestand'
import { datum } from '../../../../lib/format'
import { ANFRAGE_ARTEN, ANFRAGE_STATUS, statusKarte, textKarte, balkenKlasse } from '../../../../lib/listen'

/** Anfragen — neueste zuerst, gerechnet aus dem Bestand im Gerät. */

const STATUS = statusKarte(ANFRAGE_STATUS)

const ART = textKarte(ANFRAGE_ARTEN)

type Anfrage = {
  id: number | string
  name?: string | null
  email?: string | null
  type?: string | null
  status?: string | null
  createdAt?: string | null
}

export function AnfragenAnsicht() {
  const alle = useBestand<Anfrage>('anfragen')
  const anfragen = useMemo(
    () => [...alle].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')),
    [alle],
  )
  const unbeantwortet = anfragen.filter((a) => a.status === 'neu').length

  return (
    <>
      <div>
        <h1>Anfragen</h1>
        <p className="buero-unterzeile">
          {anfragen.length} Anfragen · {unbeantwortet} unbeantwortet
        </p>
      </div>

      <div className="buero-liste">
        {anfragen.length === 0 ? (
          <div className="buero-leer">Noch keine Anfrage.</div>
        ) : (
          anfragen.map((a) => {
            const s = STATUS[a.status ?? ''] ?? { text: a.status, art: '' }
            return (
              <Link
                key={a.id}
                href={`/office/anfragen/${a.id}`}
                className={`buero-zeile ${balkenKlasse(STATUS[a.status ?? '']?.art)}`}
              >
                <div className="buero-zeile-haupt">
                  <div className="buero-zeile-titel">
                    {a.name} · {ART[a.type ?? ''] ?? a.type}
                  </div>
                  <div className="buero-zeile-neben">
                    {datum(a.createdAt)} · {a.email}
                  </div>
                </div>
                <span className={`buero-marker ${s.art}`}>{s.text}</span>
              </Link>
            )
          })
        )}
      </div>
    </>
  )
}
