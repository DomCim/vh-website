'use client'

import React, { useState } from 'react'
import { absenden } from '../../lib/buero/warteschlange'
import { ANFRAGE_STATUS } from '../../lib/listen'
import { Rueckmeldung } from './Rueckmeldung'

export type AnfrageWerte = {
  id: number | string
  status: string
  internalNote?: string | null
}

const STATUS = ANFRAGE_STATUS.map((s) => ({ wert: s.value, text: s.label }))

/** Stand und Notiz zu einer Anfrage — die Antwort selbst geht übers Postfach. */
export function AnfrageFormular({ werte }: { werte: AnfrageWerte }) {
  const [w, setW] = useState<AnfrageWerte>(werte)
  const [laeuft, setLaeuft] = useState(false)
  const [meldung, setMeldung] = useState<string | null>(null)

  async function speichern(neuerStatus?: string) {
    setLaeuft(true)
    setMeldung(null)
    try {
      const { sofort } = await absenden({
        pfad: '/api/office/anfrage',
        bereich: 'anfragen',
        koerper: { ...w, status: neuerStatus ?? w.status },
      })
      if (neuerStatus) setW((v) => ({ ...v, status: neuerStatus }))
      setMeldung(sofort ? 'Gespeichert.' : 'Gemerkt — geht raus, sobald wieder Netz da ist.')
    } catch {
      setMeldung('Das hat nicht geklappt.')
    } finally {
      setLaeuft(false)
    }
  }

  return (
    <div className="buero-karte">
      <Rueckmeldung text={meldung} />

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
