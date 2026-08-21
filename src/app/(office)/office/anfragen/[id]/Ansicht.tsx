'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import React from 'react'

import { AnfrageFormular } from '../../../../../components/office/AnfrageFormular'
import { Vorgangsdateien } from '../../../../../components/office/Vorgangsdateien'
import { useAbgleich, useDatensatz } from '../../../../../lib/buero/bestand'
import { datum } from '../../../../../lib/format'
import { ANFRAGE_ARTEN, textKarte } from '../../../../../lib/listen'

/** Eine Anfrage im Ganzen — aus dem Bestand im Gerät. */

const ART = textKarte(ANFRAGE_ARTEN)

type Anfrage = {
  id: number | string
  name?: string | null
  email?: string | null
  phone?: string | null
  type?: string | null
  locale?: string | null
  status?: string | null
  message?: string | null
  internalNote?: string | null
  createdAt?: string | null
  productTitle?: string | null
  productUrl?: string | null
  custom?: {
    width?: number | null
    depth?: number | null
    height?: number | null
    color?: string | null
    purpose?: string | null
    desiredDate?: string | null
  } | null
}

export function AnfrageAnsicht() {
  const { id } = useParams<{ id: string }>()
  const a = useDatensatz<Anfrage>('anfragen', id)
  const { bereit } = useAbgleich()

  if (!a) {
    return (
      <>
        <h1>Anfrage</h1>
        <div className="buero-leer">
          {bereit ? 'Diese Anfrage gibt es nicht (mehr).' : 'wird geholt …'}
        </div>
      </>
    )
  }

  const masse = [
    a.custom?.width ? `${a.custom.width} cm breit` : null,
    a.custom?.depth ? `${a.custom.depth} cm tief` : null,
    a.custom?.height ? `${a.custom.height} cm hoch` : null,
  ].filter(Boolean)

  // Antwort geht übers Postfach — mit Betreff und Empfänger schon eingetragen
  const antwortLink = `/office/post?an=${encodeURIComponent(
    a.email ?? '',
  )}&betreff=${encodeURIComponent(`Ihre Anfrage vom ${datum(a.createdAt)}`)}`

  return (
    <>
      <h1>{a.name}</h1>
      <p className="buero-unterzeile">
        {ART[a.type ?? ''] ?? a.type} · {datum(a.createdAt)} · {a.email}
        {a.phone ? ` · ${a.phone}` : ''}
        {a.locale && a.locale !== 'de' ? ` · Anfrage auf ${a.locale.toUpperCase()}` : ''}
      </p>

      <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <Link href={antwortLink} className="buero-knopf">
          Antworten
        </Link>
        {/* Mit Bezug: Das Angebot übernimmt Name und Produkt und merkt sich
            die Anfrage — daran hängt später der Zahlplan des Auftrags. */}
        <Link href={`/office/angebote/neu?anfrage=${a.id}`} className="buero-knopf leise">
          Angebot schreiben
        </Link>
      </div>

      <h2>Nachricht</h2>
      <div className="buero-karte" style={{ whiteSpace: 'pre-wrap' }}>
        {a.message}
      </div>

      {(a.productTitle || masse.length > 0 || a.custom?.color || a.custom?.purpose) && (
        <>
          <h2>Angaben</h2>
          <div className="buero-karte">
            {a.productTitle && (
              <div>
                Produkt: {a.productTitle}
                {a.productUrl ? (
                  <>
                    {' — '}
                    <a
                      href={a.productUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{ textDecoration: 'underline' }}
                    >
                      auf der Website ansehen
                    </a>
                  </>
                ) : null}
              </div>
            )}
            {masse.length > 0 && <div>Maße: {masse.join(', ')}</div>}
            {a.custom?.color && <div>Wunschfarbe: {a.custom.color}</div>}
            {a.custom?.purpose && <div>Verwendung: {a.custom.purpose}</div>}
            {a.custom?.desiredDate && <div>Wunschtermin: {a.custom.desiredDate}</div>}
          </div>
        </>
      )}

      <Vorgangsdateien anfrage={a.id} />

      <h2>Stand</h2>
      <AnfrageFormular
        werte={{ id: a.id, status: a.status ?? 'neu', internalNote: a.internalNote }}
      />
    </>
  )
}
