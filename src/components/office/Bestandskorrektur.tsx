'use client'

import React, { useState } from 'react'

import { absenden } from '../../lib/buero/warteschlange'
import { datum } from '../../lib/format'
import { Rueckmeldung } from './Rueckmeldung'

export type Bewegung = {
  day?: string | null
  delta?: number | null
  rest?: number | null
  reason?: string | null
  who?: string | null
}

/**
 * Bestand korrigieren — und aufschreiben, warum.
 *
 * Der Bestand ändert sich nicht nur beim Fertigmelden eines Auftrags: Es wird
 * nachgeschweißt, ein Blech verschnitten, zwei Meter Draht für eine Reparatur
 * außerhalb gebraucht. Bisher blieb dafür nur, die Zahl im Feld zu
 * überschreiben — und danach wusste niemand mehr, warum aus 50 plötzlich 48
 * wurden.
 *
 * Gebucht wird deshalb die **Veränderung**, nicht der neue Stand: Wer zwei
 * Meter verbraucht hat, tippt eine Zwei und drückt „verbraucht". Nachsehen,
 * wie viel gerade dasteht, und im Kopf abziehen — genau da entstehen die
 * Zahlendreher, die eine Inventur später mühsam wieder einfängt.
 */
export function Bestandskorrektur({
  postenId,
  bestand,
  einheit,
  verlauf = [],
}: {
  postenId: number | string
  bestand: number
  einheit: string
  verlauf?: Bewegung[]
}) {
  const [menge, setMenge] = useState('')
  const [grund, setGrund] = useState('')
  const [laeuft, setLaeuft] = useState(false)
  const [meldung, setMeldung] = useState<string | null>(null)

  async function buchen(richtung: -1 | 1) {
    const wert = Number(String(menge).replace(',', '.'))
    if (!Number.isFinite(wert) || wert <= 0) {
      setMeldung('Wie viel? Eine Zahl größer als null.')
      return
    }
    setLaeuft(true)
    setMeldung(null)
    const delta = Math.round(wert * richtung * 1000) / 1000
    try {
      const { sofort } = await absenden({
        pfad: '/api/office/inventar',
        bereich: 'inventar',
        koerper: { aktion: 'korrektur', id: postenId, delta, grund },
        // Damit die Seite sofort den neuen Stand zeigt, auch ohne Netz
        vorschau: { id: postenId, quantity: Math.round((bestand + delta) * 1000) / 1000 },
      })
      setMenge('')
      setGrund('')
      setMeldung(
        sofort
          ? `Gebucht — Bestand steht jetzt auf ${Math.round((bestand + delta) * 1000) / 1000} ${einheit}.`
          : 'Gemerkt — geht raus, sobald wieder Netz da ist.',
      )
    } catch {
      setMeldung('Das hat nicht geklappt.')
    } finally {
      setLaeuft(false)
    }
  }

  const letzte = [...verlauf].reverse().slice(0, 8)

  return (
    <div className="buero-karte">
      <h2>Bestand korrigieren</h2>
      <p className="buero-unterzeile">
        Verbraucht, verschnitten, dazubekommen — die Veränderung eintragen, nicht den neuen Stand.
        Aktuell {bestand} {einheit}.
      </p>

      <div className="buero-reihe">
        <label className="buero-feld">
          <span>Wie viel ({einheit})</span>
          <input
            inputMode="decimal"
            value={menge}
            onChange={(e) => setMenge(e.target.value)}
            placeholder="z.B. 2"
          />
        </label>
        <label className="buero-feld" style={{ gridColumn: 'span 2' }}>
          <span>Warum</span>
          <input
            value={grund}
            onChange={(e) => setGrund(e.target.value)}
            placeholder="z.B. Reparatur Hoftor, außerhalb eines Auftrags"
          />
        </label>
      </div>

      <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="buero-knopf"
          disabled={laeuft}
          onClick={() => void buchen(-1)}
        >
          Verbraucht
        </button>
        <button
          type="button"
          className="buero-knopf leise"
          disabled={laeuft}
          onClick={() => void buchen(1)}
        >
          Dazubekommen
        </button>
      </div>
      <Rueckmeldung text={meldung} />

      {bestand < 0 && (
        <p className="buero-hinweis warn">
          Der Bestand steht rechnerisch unter null. Das heißt: Es wurde mehr verbraucht, als je
          gebucht wurde — da fehlt ein Wareneingang, oder es ist Zeit für eine Inventur.
        </p>
      )}

      {letzte.length > 0 && (
        <>
          <h3 style={{ marginTop: '1.2rem', fontSize: '.85rem' }}>Zuletzt</h3>
          <div className="buero-liste">
            {letzte.map((b, i) => (
              <div key={i} className="buero-zeile">
                <div className="buero-zeile-haupt">
                  <div className="buero-zeile-titel">
                    {(b.delta ?? 0) > 0 ? '+' : ''}
                    {b.delta} {einheit}
                    {b.reason ? ` · ${b.reason}` : ''}
                  </div>
                  <div className="buero-zeile-neben">
                    {datum(b.day)}
                    {b.who ? ` · ${b.who}` : ''}
                    {typeof b.rest === 'number' ? ` · danach ${b.rest} ${einheit}` : ''}
                  </div>
                </div>
                {/* Neutral: Zu- und Abgang sind Richtungen, keine Zustände. Grün
                    für „mehr" hieße im Büro sonst zweierlei. */}
                <span className="buero-marker">
                  {(b.delta ?? 0) > 0 ? 'Zugang' : 'Abgang'}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
