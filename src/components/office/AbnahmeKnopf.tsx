'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Rueckmeldung } from './Rueckmeldung'

/**
 * Die Abnahme mit Unterschrift auf dem Telefon.
 *
 * Beim Kunden vor Ort: „Abnahme" antippen, das Gerät hinhalten, der Kunde
 * unterschreibt mit dem Finger. Der Server macht daraus das Abnahmeprotokoll
 * (den Lieferschein mit Unterschrift) und legt es zu den Vorgangsdateien.
 *
 * Das braucht Netz — das Protokoll entsteht am Server. Ohne Empfang lieber
 * fünf Minuten warten als eine Abnahme mit falschem Zeitstempel.
 */
export function AbnahmeKnopf({
  id,
  abgenommen,
}: {
  id: number | string
  abgenommen?: { am?: string | null; name?: string | null } | null
}) {
  const [offen, setOffen] = useState(false)
  const [laeuft, setLaeuft] = useState(false)
  const [meldung, setMeldung] = useState<string | null>(null)
  const [erledigt, setErledigt] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [ort, setOrt] = useState('')
  const [gezeichnet, setGezeichnet] = useState(false)
  const leinwand = useRef<HTMLCanvasElement>(null)
  const zeichnung = useRef<{ aktiv: boolean }>({ aktiv: false })

  // Die Leinwand scharf stellen: CSS-Größe mal Gerätepixel, sonst wird die
  // Unterschrift auf dem Telefon zur Treppchengrafik.
  useEffect(() => {
    if (!offen) return
    const c = leinwand.current
    if (!c) return
    const massstab = window.devicePixelRatio || 1
    const breite = c.clientWidth
    const hoehe = c.clientHeight
    c.width = Math.round(breite * massstab)
    c.height = Math.round(hoehe * massstab)
    const stift = c.getContext('2d')
    if (stift) {
      stift.scale(massstab, massstab)
      stift.lineWidth = 2
      stift.lineCap = 'round'
      stift.lineJoin = 'round'
      stift.strokeStyle = '#1a1a66'
    }
  }, [offen])

  function punkt(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = leinwand.current!
    const r = c.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  function anfangen(e: React.PointerEvent<HTMLCanvasElement>) {
    const stift = leinwand.current?.getContext('2d')
    if (!stift) return
    e.currentTarget.setPointerCapture(e.pointerId)
    zeichnung.current.aktiv = true
    const p = punkt(e)
    stift.beginPath()
    stift.moveTo(p.x, p.y)
    // Auch ein Punkt ist ein Strich — sonst fehlen die i-Punkte
    stift.lineTo(p.x + 0.1, p.y + 0.1)
    stift.stroke()
    setGezeichnet(true)
  }

  function ziehen(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!zeichnung.current.aktiv) return
    const stift = leinwand.current?.getContext('2d')
    if (!stift) return
    const p = punkt(e)
    stift.lineTo(p.x, p.y)
    stift.stroke()
  }

  function aufhoeren() {
    zeichnung.current.aktiv = false
  }

  function leeren() {
    const c = leinwand.current
    const stift = c?.getContext('2d')
    if (c && stift) stift.clearRect(0, 0, c.width, c.height)
    setGezeichnet(false)
  }

  async function senden() {
    const c = leinwand.current
    if (!c || !gezeichnet) {
      setMeldung('Erst unterschreiben — das Feld ist noch leer.')
      return
    }
    setLaeuft(true)
    setMeldung(null)
    try {
      const res = await fetch(`/api/office/auftrag/${id}/abnahme`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          unterschrift: c.toDataURL('image/png'),
          name,
          ort,
          zeitpunkt: new Date().toISOString(),
        }),
      })
      const j = await res.json()
      if (!res.ok) {
        setMeldung(
          j?.error === 'schon-abgenommen'
            ? 'Dieser Auftrag ist schon abgenommen — das Protokoll liegt bei den Dateien.'
            : 'Das hat nicht geklappt — Verbindung prüfen und noch einmal.',
        )
        return
      }
      setOffen(false)
      setErledigt(name || 'dem Kunden')
    } catch {
      setMeldung('Keine Verbindung — die Abnahme braucht Netz.')
    } finally {
      setLaeuft(false)
    }
  }

  if (abgenommen?.am || erledigt) {
    const wann = abgenommen?.am
      ? new Date(abgenommen.am).toLocaleDateString('de-DE')
      : new Date().toLocaleDateString('de-DE')
    const wer = abgenommen?.name || erledigt
    return (
      <span className="buero-zeile-neben">
        Abgenommen am {wann}
        {wer && wer !== 'dem Kunden' ? ` von ${wer}` : ''} — das Protokoll liegt bei den Dateien.
      </span>
    )
  }

  if (!offen) {
    return (
      <button type="button" className="buero-knopf leise" onClick={() => setOffen(true)}>
        Abnahme mit Unterschrift
      </button>
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
      <p className="buero-unterzeile" style={{ marginTop: 0 }}>
        Der Kunde prüft die Leistung und unterschreibt hier. Daraus entsteht das
        Abnahmeprotokoll als PDF am Auftrag — das braucht Netz.
      </p>
      <Rueckmeldung text={meldung} />

      <div className="buero-reihe">
        <label className="buero-feld">
          <span>Name (wer abnimmt)</span>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="buero-feld">
          <span>Ort</span>
          <input value={ort} onChange={(e) => setOrt(e.target.value)} />
        </label>
      </div>

      <canvas
        ref={leinwand}
        className="buero-unterschrift"
        onPointerDown={anfangen}
        onPointerMove={ziehen}
        onPointerUp={aufhoeren}
        onPointerCancel={aufhoeren}
      />

      <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap', marginTop: '.6rem' }}>
        <button
          type="button"
          className="buero-knopf"
          disabled={laeuft || !gezeichnet}
          onClick={() => void senden()}
        >
          {laeuft ? 'Wird abgelegt …' : 'Abnahme festhalten'}
        </button>
        <button type="button" className="buero-knopf leise schmal" onClick={leeren}>
          Neu ansetzen
        </button>
        <button type="button" className="buero-knopf leise schmal" onClick={() => setOffen(false)}>
          Abbrechen
        </button>
      </div>
    </div>
  )
}
