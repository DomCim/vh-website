'use client'

import React, { useCallback, useEffect, useState } from 'react'

import {
  type Wartend,
  haengengebliebene,
  nochmalVersuchen,
  useWarteschlange,
  verwerfen,
} from '../../lib/buero/warteschlange'

/**
 * Was der Server abgewiesen hat.
 *
 * Ein Eintrag, den der Server dauerhaft nicht annimmt, wird nicht endlos
 * wiederholt und nicht heimlich weggeworfen — beides wäre falsch: Das eine
 * dreht sich ewig, das andere vernichtet Arbeit. Er bleibt liegen, und hier
 * steht, was los ist. Danach entscheidet ein Mensch: noch einmal versuchen
 * oder verwerfen.
 *
 * Im Normalfall steht hier nichts.
 */

const NAMEN: Record<string, string> = {
  '/api/office/beleg': 'Beleg',
  '/api/office/beleg-upload': 'Beleg-Scan',
  '/api/office/rechnung': 'Rechnung',
  '/api/office/angebot': 'Angebot',
  '/api/office/auftrag': 'Auftrag',
  '/api/office/partner': 'Geschäftspartner',
  '/api/office/inventar': 'Inventarposten',
  '/api/office/inventur': 'Inventur',
  '/api/office/anfrage': 'Anfrage',
  '/api/office/bestellung': 'Bestellung',
  '/api/office/stueckliste': 'Stückliste',
  '/api/office/zeit': 'Zeitbuchung',
}

export function Haengengebliebenes() {
  const { fehlerhaft } = useWarteschlange()
  const [liste, setListe] = useState<Wartend[]>([])

  const holen = useCallback(async () => {
    setListe(await haengengebliebene().catch(() => []))
  }, [])

  useEffect(() => {
    void holen()
  }, [holen, fehlerhaft])

  if (!liste.length) return null

  return (
    <>
      <h2>Nicht angekommen</h2>
      <p className="buero-unterzeile">
        Der Server hat das hier abgewiesen. Nichts davon ist verloren — aber es geht auch nicht
        von selbst weiter.
      </p>

      <div className="buero-liste">
        {liste.map((e) => (
          <div key={e.nummer} className="buero-zeile">
            <div className="buero-zeile-haupt">
              <div className="buero-zeile-titel">{NAMEN[e.pfad] ?? e.pfad}</div>
              <div className="buero-zeile-neben">
                {e.fehler} · {new Date(e.zeit).toLocaleString('de-DE')}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '.4rem' }}>
              <button
                type="button"
                className="buero-knopf schmal leise"
                onClick={async () => {
                  await nochmalVersuchen(e.nummer!)
                  await holen()
                }}
              >
                nochmal
              </button>
              <button
                type="button"
                className="buero-knopf schmal gefahr"
                onClick={async () => {
                  if (!window.confirm('Diese Änderung endgültig verwerfen?')) return
                  await verwerfen(e.nummer!)
                  await holen()
                }}
              >
                verwerfen
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
