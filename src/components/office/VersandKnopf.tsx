'use client'

import React, { useState } from 'react'

import { signaturAlsHtml, textAlsAbsaetze } from '../../lib/signaturHtml'
import { Schreibfeld } from './Schreibfeld'

type Art = 'angebot' | 'rechnung' | 'bestaetigung' | 'mahnung' | 'lieferschein'

const BESCHRIFTUNG: Record<Art, string> = {
  angebot: 'Angebot senden',
  rechnung: 'Rechnung senden',
  bestaetigung: 'Bestätigung senden',
  mahnung: 'Erinnern / mahnen',
  lieferschein: 'Lieferschein senden',
}

/**
 * Ein Kundendokument per Mail verschicken.
 *
 * Empfänger, Betreff und Text kommen vorbereitet vom Server; das PDF hängt
 * automatisch dran. Was zum Kunden geht, geht als PDF — nicht als Fließtext
 * in der Mail, den jedes Programm anders darstellt.
 */
export function VersandKnopf({
  art,
  id,
  leise = false,
}: {
  art: Art
  id: number | string
  leise?: boolean
}) {
  const [offen, setOffen] = useState(false)
  const [laeuft, setLaeuft] = useState(false)
  const [meldung, setMeldung] = useState<string | null>(null)
  const [w, setW] = useState({ an: '', betreff: '', html: '', dateiname: '', absender: '' })

  async function oeffnen() {
    setLaeuft(true)
    setMeldung(null)
    try {
      const res = await fetch(`/api/office/versand?art=${art}&id=${id}`, { credentials: 'include' })
      const j = await res.json()
      if (!res.ok) {
        setMeldung(
          j?.error === 'noch-entwurf'
            ? 'Das ist noch ein Entwurf — erst versenden, dann verschicken.'
            : j?.error === 'nicht-offen'
              ? 'Diese Rechnung ist bezahlt oder storniert — da gibt es nichts zu mahnen.'
              : 'Der Vorschlag ließ sich nicht laden.',
        )
        setOffen(true)
        return
      }
      /*
       * Vorschlag plus Signatur, beides gleich im Schreibfeld: So sieht man
       * vor dem Senden genau das, was rausgeht — der Server hängt beim
       * gestalteten Versand nichts mehr stillschweigend an.
       */
      setW({
        an: j.an ?? '',
        betreff: j.betreff ?? '',
        html: `${textAlsAbsaetze(j.text)}${signaturAlsHtml(j.signatur, false)}`,
        dateiname: j.dateiname ?? '',
        absender: j.absender ?? '',
      })
      setOffen(true)
    } catch {
      setMeldung('Verbindung fehlgeschlagen.')
      setOffen(true)
    } finally {
      setLaeuft(false)
    }
  }

  async function senden() {
    if (!w.an.trim()) {
      setMeldung('Eine Empfängeradresse wird gebraucht.')
      return
    }
    setLaeuft(true)
    setMeldung(null)
    try {
      const res = await fetch('/api/office/versand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          art,
          id,
          an: w.an,
          betreff: w.betreff,
          // Aus der Rückfallebene des Schreibfelds kommt Klartext ohne
          // Auszeichnung — der geht als Text, sonst als gestalteter Rumpf
          ...(w.html.includes('<') ? { html: w.html } : { text: w.html }),
        }),
      })
      const j = await res.json()
      if (!res.ok) {
        setMeldung(
          j?.error === 'kein-postfach'
            ? 'Es ist kein Postfach eingerichtet — ohne das geht kein Versand.' // kommt nur noch von alten Serverständen
            : 'Die Mail ging nicht raus.',
        )
        return
      }
      setOffen(false)
      setMeldung(`Verschickt an ${j.an}.`)
    } catch {
      setMeldung('Verbindung fehlgeschlagen.')
    } finally {
      setLaeuft(false)
    }
  }

  if (!offen) {
    return (
      <>
        <button
          type="button"
          className={`buero-knopf${leise ? ' leise' : ''}`}
          disabled={laeuft}
          onClick={() => void oeffnen()}
        >
          {BESCHRIFTUNG[art]}
        </button>
        {meldung && <span className="buero-zeile-neben">{meldung}</span>}
      </>
    )
  }

  return (
    <div
      style={{
        border: '1px solid var(--buero-linie)',
        borderRadius: 10,
        padding: '.9rem 1rem',
        marginTop: '.6rem',
        width: '100%',
      }}
    >
      {meldung && <p className="buero-hinweis">{meldung}</p>}
      <p className="buero-unterzeile" style={{ marginBottom: '.75rem' }}>
        {w.dateiname ? `${w.dateiname} hängt als PDF an` : 'Das PDF hängt an'}
        {w.absender ? ` · Absender ${w.absender}` : ''}
      </p>

      <label className="buero-feld">
        <span>An</span>
        <input value={w.an} onChange={(e) => setW({ ...w, an: e.target.value })} />
      </label>
      <label className="buero-feld">
        <span>Betreff</span>
        <input value={w.betreff} onChange={(e) => setW({ ...w, betreff: e.target.value })} />
      </label>
      <div className="buero-feld">
        <span>Nachricht</span>
        <Schreibfeld wert={w.html} aendern={(html) => setW((v) => ({ ...v, html }))} />
      </div>

      <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>
        <button type="button" className="buero-knopf" disabled={laeuft} onClick={() => void senden()}>
          {laeuft ? 'Geht raus …' : 'Senden'}
        </button>
        <button type="button" className="buero-knopf leise" onClick={() => setOffen(false)}>
          Abbrechen
        </button>
      </div>
    </div>
  )
}
