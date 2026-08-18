'use client'

import { useRouter } from 'next/navigation'
import React, { useState } from 'react'

export type BestellungWerte = {
  id: number | string
  status: string
  trackingNumber?: string | null
  trackingUrl?: string | null
  expectedReady?: string | null
}

const STATUS = [
  { wert: 'pending', text: 'Offen (unbezahlt)' },
  { wert: 'paid', text: 'Bezahlt' },
  { wert: 'inProduction', text: 'In Fertigung' },
  { wert: 'shipped', text: 'Versendet' },
  { wert: 'cancelled', text: 'Storniert' },
]

/**
 * Bestellstand setzen.
 *
 * Jeder Statuswechsel schickt der Kundschaft eine Mail — deshalb steht der
 * Hinweis dabei, was gleich rausgeht.
 */
export function BestellungFormular({ werte }: { werte: BestellungWerte }) {
  const router = useRouter()
  const [w, setW] = useState<BestellungWerte>(werte)
  const [laeuft, setLaeuft] = useState(false)
  const [meldung, setMeldung] = useState<string | null>(null)

  const setzen = (teil: Partial<BestellungWerte>) => setW((v) => ({ ...v, ...teil }))

  async function speichern() {
    setLaeuft(true)
    setMeldung(null)
    try {
      const res = await fetch('/api/office/bestellung', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(w),
      })
      const j = await res.json()
      if (!res.ok) {
        setMeldung(
          j?.error === 'sendungsnummer-fehlt'
            ? 'Für „Versendet" wird eine Sendungsnummer gebraucht — sonst steht die Mail ohne Verfolgung da.'
            : 'Das hat nicht geklappt.',
        )
        return
      }
      setMeldung('Gespeichert.')
      router.refresh()
    } catch {
      setMeldung('Verbindung fehlgeschlagen.')
    } finally {
      setLaeuft(false)
    }
  }

  const mailHinweis =
    w.status === 'inProduction'
      ? 'Beim Speichern geht die Fertigungs-Mail raus.'
      : w.status === 'shipped'
        ? 'Beim Speichern geht die Versand-Mail mit der Sendungsnummer raus.'
        : null

  return (
    <div className="buero-karte">
      {meldung && <p className="buero-hinweis">{meldung}</p>}
      {mailHinweis && w.status !== werte.status && <p className="buero-hinweis">{mailHinweis}</p>}

      <div className="buero-reihe">
        <label className="buero-feld">
          <span>Status</span>
          <select value={w.status} onChange={(e) => setzen({ status: e.target.value })}>
            {STATUS.map((s) => (
              <option key={s.wert} value={s.wert}>
                {s.text}
              </option>
            ))}
          </select>
        </label>
        <label className="buero-feld">
          <span>Voraussichtlich fertig</span>
          <input
            value={w.expectedReady ?? ''}
            placeholder="z.B. Ende April"
            onChange={(e) => setzen({ expectedReady: e.target.value })}
          />
        </label>
      </div>

      <div className="buero-reihe">
        <label className="buero-feld">
          <span>Sendungsnummer</span>
          <input
            value={w.trackingNumber ?? ''}
            onChange={(e) => setzen({ trackingNumber: e.target.value })}
          />
        </label>
        <label className="buero-feld">
          <span>Tracking-Link</span>
          <input
            value={w.trackingUrl ?? ''}
            onChange={(e) => setzen({ trackingUrl: e.target.value })}
          />
        </label>
      </div>

      <button type="button" className="buero-knopf" disabled={laeuft} onClick={() => void speichern()}>
        Speichern
      </button>
    </div>
  )
}
