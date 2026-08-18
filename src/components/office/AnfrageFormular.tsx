'use client'

import { useRouter } from 'next/navigation'
import React, { useState } from 'react'

export type AnfrageWerte = {
  id: number | string
  status: string
  internalNote?: string | null
}

const STATUS = [
  { wert: 'neu', text: 'Neu' },
  { wert: 'inBearbeitung', text: 'In Bearbeitung' },
  { wert: 'beantwortet', text: 'Beantwortet' },
  { wert: 'erledigt', text: 'Erledigt' },
]

/** Stand und Notiz zu einer Anfrage — die Antwort selbst geht übers Postfach. */
export function AnfrageFormular({ werte }: { werte: AnfrageWerte }) {
  const router = useRouter()
  const [w, setW] = useState<AnfrageWerte>(werte)
  const [laeuft, setLaeuft] = useState(false)
  const [meldung, setMeldung] = useState<string | null>(null)

  async function speichern(neuerStatus?: string) {
    setLaeuft(true)
    setMeldung(null)
    try {
      const res = await fetch('/api/office/anfrage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...w, status: neuerStatus ?? w.status }),
      })
      if (!res.ok) {
        setMeldung('Das hat nicht geklappt.')
        return
      }
      if (neuerStatus) setW((v) => ({ ...v, status: neuerStatus }))
      setMeldung('Gespeichert.')
      router.refresh()
    } catch {
      setMeldung('Verbindung fehlgeschlagen.')
    } finally {
      setLaeuft(false)
    }
  }

  return (
    <div className="buero-karte">
      {meldung && <p className="buero-hinweis">{meldung}</p>}

      <label className="buero-feld">
        <span>Status</span>
        <select value={w.status} onChange={(e) => setW((v) => ({ ...v, status: e.target.value }))}>
          {STATUS.map((s) => (
            <option key={s.wert} value={s.wert}>
              {s.text}
            </option>
          ))}
        </select>
      </label>

      <label className="buero-feld">
        <span>Interne Notiz</span>
        <textarea
          rows={3}
          value={w.internalNote ?? ''}
          onChange={(e) => setW((v) => ({ ...v, internalNote: e.target.value }))}
        />
      </label>

      <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="buero-knopf leise"
          disabled={laeuft}
          onClick={() => void speichern()}
        >
          Speichern
        </button>
        {w.status !== 'erledigt' && (
          <button
            type="button"
            className="buero-knopf leise"
            disabled={laeuft}
            onClick={() => void speichern('erledigt')}
          >
            Als erledigt ablegen
          </button>
        )}
      </div>
    </div>
  )
}
