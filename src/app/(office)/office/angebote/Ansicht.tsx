'use client'

import Link from 'next/link'
import React, { useMemo } from 'react'

import { useBestand } from '../../../../lib/buero/bestand'
import { datum, euro } from '../../../../lib/format'
import { ANGEBOT_STATUS, statusKarte, balkenKlasse } from '../../../../lib/listen'

/** Angebote — gerechnet aus dem Bestand im Gerät. */

const STATUS = statusKarte(ANGEBOT_STATUS)

type Angebot = {
  id: number | string
  quoteNumber?: string | null
  title?: string | null
  customerName?: string | null
  status?: string | null
  validUntil?: string | null
  total?: number | null
  createdAt?: string | null
}

export function AngeboteAnsicht() {
  const alle = useBestand<Angebot>('angebote')
  const angebote = useMemo(
    () => [...alle].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')),
    [alle],
  )

  const offenSumme = useMemo(() => {
    const offen = angebote.filter((a) => a.status === 'versendet')
    return Math.round(offen.reduce((s, a) => s + (a.total ?? 0), 0) * 100) / 100
  }, [angebote])

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
          <h1>Angebote</h1>
          <p className="buero-unterzeile">
            {angebote.length} Angebote · {euro(offenSumme)} noch in der Schwebe
          </p>
        </div>
        <Link href="/office/angebote/neu" className="buero-knopf">
          Angebot schreiben
        </Link>
      </div>

      <div className="buero-liste">
        {angebote.length === 0 ? (
          <div className="buero-leer">
            Noch kein Angebot.
            <br />
            <Link href="/office/angebote/neu" style={{ textDecoration: 'underline' }}>
              Erstes Angebot schreiben
            </Link>
          </div>
        ) : (
          angebote.map((a) => {
            const s = STATUS[a.status ?? ''] ?? { text: a.status, art: '' }
            const abgelaufen =
              a.status === 'versendet' &&
              a.validUntil &&
              new Date(a.validUntil).getTime() < Date.now()
            return (
              <Link
                key={a.id}
                href={`/office/angebote/${a.id}`}
                className={`buero-zeile ${balkenKlasse(STATUS[a.status ?? '']?.art)}`}
              >
                <div className="buero-zeile-haupt">
                  <div className="buero-zeile-titel">
                    {a.quoteNumber ?? 'Entwurf'} · {a.title || a.customerName || 'ohne Bezeichnung'}
                  </div>
                  <div className="buero-zeile-neben">
                    {a.customerName ?? 'ohne Kunde'}
                    {a.validUntil ? ` · gültig bis ${datum(a.validUntil)}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}>
                  <span className={`buero-marker ${abgelaufen ? 'warn' : s.art}`}>
                    {abgelaufen ? 'abgelaufen' : s.text}
                  </span>
                  <span className="buero-betrag">{euro(a.total)}</span>
                </div>
              </Link>
            )
          })
        )}
      </div>
    </>
  )
}
