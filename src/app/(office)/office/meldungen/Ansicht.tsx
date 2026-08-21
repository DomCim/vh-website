'use client'

import Link from 'next/link'
import React, { useMemo, useState } from 'react'

import { alsGelesen, allesGelesen, meldungsZeit, useMeldungen } from '../../../../lib/buero/meldungen'
import { datum, seit } from '../../../../lib/format'

/**
 * Alle Meldungen — was das Büro gesagt hat, in ganzer Länge.
 *
 * Unter der Glocke stehen die letzten zwanzig; hier stehen sie alle, nach
 * Tagen geordnet. Das ist die Stelle, an der man nachsieht, wenn man weiß,
 * dass da etwas war, aber nicht mehr, was — der Fall, für den die ganze Liste
 * gebaut ist.
 */

const tagVon = (wert: string) => (wert || '').slice(0, 10)

export function MeldungenAnsicht() {
  const alle = useMeldungen()
  const [nurNeue, setNurNeue] = useState(false)
  const [laeuft, setLaeuft] = useState(false)

  const ungelesen = alle.filter((m) => !m.gelesen).length
  const sichtbar = useMemo(() => (nurNeue ? alle.filter((m) => !m.gelesen) : alle), [alle, nurNeue])

  // Nach Tagen gebündelt: „heute", „gestern", sonst das Datum. Eine Liste aus
  // vierzig Zeitangaben liest niemand — eine Liste unter drei Überschriften schon.
  const tage = useMemo(() => {
    const gebuendelt: { tag: string; meldungen: typeof sichtbar }[] = []
    for (const m of sichtbar) {
      const tag = tagVon(meldungsZeit(m))
      const letzter = gebuendelt[gebuendelt.length - 1]
      if (letzter?.tag === tag) letzter.meldungen.push(m)
      else gebuendelt.push({ tag, meldungen: [m] })
    }
    return gebuendelt
  }, [sichtbar])

  const heute = new Date().toISOString().slice(0, 10)
  const gestern = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
  const tagName = (tag: string) => (tag === heute ? 'Heute' : tag === gestern ? 'Gestern' : datum(tag))

  const abhaken = async () => {
    setLaeuft(true)
    try {
      await allesGelesen(alle)
    } finally {
      setLaeuft(false)
    }
  }

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
          <h1>Meldungen</h1>
          <p className="buero-unterzeile">
            {alle.length} Meldungen · {ungelesen} ungelesen
          </p>
        </div>
        {ungelesen > 0 && (
          <button type="button" className="buero-knopf leise" disabled={laeuft} onClick={() => void abhaken()}>
            {laeuft ? '…' : 'Alles gelesen'}
          </button>
        )}
      </div>

      <div className="buero-reiter">
        <button
          type="button"
          aria-current={!nurNeue ? 'page' : undefined}
          onClick={() => setNurNeue(false)}
        >
          Alle
        </button>
        <button
          type="button"
          aria-current={nurNeue ? 'page' : undefined}
          onClick={() => setNurNeue(true)}
        >
          Ungelesen{ungelesen ? ` (${ungelesen})` : ''}
        </button>
      </div>

      {sichtbar.length === 0 ? (
        <div className="buero-leer" style={{ marginTop: '1rem' }}>
          Nichts liegt an.
          <br />
          Was das Büro meldet, steht hier — auch, wenn die Meldung auf dem Handy weggewischt wurde.
        </div>
      ) : (
        tage.map(({ tag, meldungen }) => (
          <section key={tag || 'ohne'} style={{ marginTop: '1.25rem' }}>
            <h2>{tagName(tag)}</h2>
            <div className="buero-liste">
              {meldungen.map((m) => (
                <div key={m.id} className={`buero-zeile${m.gelesen ? '' : ' ist-neu'}`}>
                  <Link
                    href={m.url || '/office'}
                    className="buero-zeile-haupt"
                    style={{ color: 'inherit', textDecoration: 'none' }}
                    onClick={() => {
                      if (!m.gelesen) void alsGelesen(m.id)
                    }}
                  >
                    <div className="buero-zeile-titel">
                      {m.titel}
                      {(m.anzahl ?? 1) > 1 && (
                        <span className="buero-marker" style={{ marginLeft: '.5rem' }}>
                          {m.anzahl}×
                        </span>
                      )}
                    </div>
                    <div className="buero-zeile-neben">
                      {m.text}
                      {m.text ? ' · ' : ''}
                      {seit(meldungsZeit(m))}
                    </div>
                  </Link>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}>
                    <button
                      type="button"
                      className="buero-knopf leise schmal"
                      onClick={() => void alsGelesen(m.id, !m.gelesen)}
                    >
                      {m.gelesen ? 'wieder neu' : 'gelesen'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))
      )}
    </>
  )
}
