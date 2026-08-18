import Link from 'next/link'
import { notFound } from 'next/navigation'
import React from 'react'

import { AnfrageFormular } from '../../../../../components/office/AnfrageFormular'
import { payloadClient } from '../../../../../lib/data'
import { bueroBenutzer, datum } from '../../../../../lib/office'

export const dynamic = 'force-dynamic'

const ART: Record<string, string> = {
  kontakt: 'Kontaktformular',
  produkt: 'Produktanfrage',
  massanfertigung: 'Maßanfertigung',
}

export default async function AnfrageAnsehen({ params }: { params: Promise<{ id: string }> }) {
  await bueroBenutzer()
  const { id } = await params
  const payload = await payloadClient()

  const a = await payload
    .findByID({ collection: 'inquiries', id, depth: 0, overrideAccess: true })
    .catch(() => null)
  if (!a) notFound()

  const masse = [
    a.custom?.width ? `${a.custom.width} cm breit` : null,
    a.custom?.depth ? `${a.custom.depth} cm tief` : null,
    a.custom?.height ? `${a.custom.height} cm hoch` : null,
  ].filter(Boolean)

  // Antwort geht übers Postfach — mit Betreff und Empfänger schon eingetragen
  const antwortLink = `/office/post?an=${encodeURIComponent(a.email)}&betreff=${encodeURIComponent(
    `Ihre Anfrage vom ${datum(a.createdAt)}`,
  )}`

  return (
    <>
      <h1>{a.name}</h1>
      <p className="buero-unterzeile">
        {ART[a.type] ?? a.type} · {datum(a.createdAt)} · {a.email}
        {a.phone ? ` · ${a.phone}` : ''}
        {a.locale && a.locale !== 'de' ? ` · Anfrage auf ${a.locale.toUpperCase()}` : ''}
      </p>

      <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <Link href={antwortLink} className="buero-knopf">
          Antworten
        </Link>
        <Link href="/office/angebote/neu" className="buero-knopf leise">
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
                    <a href={a.productUrl} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>
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

      <h2>Stand</h2>
      <AnfrageFormular werte={{ id: a.id, status: a.status, internalNote: a.internalNote }} />
    </>
  )
}
