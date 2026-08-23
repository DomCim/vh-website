'use client'

import React, { useMemo, useState } from 'react'

import { useBestand } from '../../lib/buero/bestand'
import { absenden } from '../../lib/buero/warteschlange'
import { datum } from '../../lib/format'
import { Rueckmeldung } from './Rueckmeldung'

/**
 * Wiedervorlagen an einem Vorgang — Partner, Auftrag oder Rechnung.
 *
 * Zwei Felder und ein Knopf, mehr braucht ein Zettel nicht. Alles Weitere
 * (Notiz, Verschieben) steht auf der Übersichtsseite; hier geht es darum, den
 * Gedanken loszuwerden, solange man ihn hat — nämlich mitten im Gespräch.
 *
 * Gerechnet wird aus dem Bestand im Gerät, gespeichert über die Warteschlange:
 * Das funktioniert auch mit dem Handy in der Werkstatt ohne Empfang.
 */

export type WiedervorlagenBezug = {
  contact?: number | string | null
  job?: number | string | null
  quote?: number | string | null
  invoice?: number | string | null
}

type Wiedervorlage = {
  id: number | string
  title?: string | null
  dueDate?: string | null
  done?: boolean | null
  note?: string | null
  contact?: unknown
  job?: unknown
  quote?: unknown
  invoice?: unknown
}

const kennung = (wert: unknown): string =>
  typeof wert === 'object' && wert
    ? String((wert as { id?: number }).id ?? '')
    : wert == null
      ? ''
      : String(wert)

/** In einem Monat — der übliche Abstand fürs Nachfassen. */
function inEinemMonat(): string {
  const d = new Date()
  d.setMonth(d.getMonth() + 1)
  return d.toISOString().slice(0, 10)
}

export function Wiedervorlagen({ bezug }: { bezug: WiedervorlagenBezug }) {
  const alle = useBestand<Wiedervorlage>('wiedervorlagen')
  const [titel, setTitel] = useState('')
  const [wann, setWann] = useState(inEinemMonat)
  const [laeuft, setLaeuft] = useState(false)
  const [meldung, setMeldung] = useState<string | null>(null)

  const meine = useMemo(
    () =>
      alle
        .filter((w) =>
          (Object.keys(bezug) as (keyof WiedervorlagenBezug)[]).some(
            (feld) => bezug[feld] && kennung(w[feld]) === String(bezug[feld]),
          ),
        )
        .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? '')),
    [alle, bezug],
  )

  const offen = meine.filter((w) => !w.done)
  const erledigt = meine.filter((w) => w.done)

  async function anlegen() {
    if (!titel.trim()) {
      setMeldung('Ohne Text gibt es nichts zu erinnern.')
      return
    }
    setLaeuft(true)
    setMeldung(null)
    try {
      const { sofort } = await absenden({
        pfad: '/api/office/wiedervorlage',
        bereich: 'wiedervorlagen',
        koerper: { title: titel.trim(), dueDate: wann, ...bezug },
        vorschau: { title: titel.trim(), dueDate: wann, done: false, ...bezug },
      })
      setTitel('')
      setWann(inEinemMonat())
      if (!sofort) setMeldung('Gemerkt — geht raus, sobald wieder Netz da ist.')
    } catch {
      setMeldung('Das hat nicht geklappt.')
    } finally {
      setLaeuft(false)
    }
  }

  async function abhaken(id: number | string, erledigen: boolean) {
    await absenden({
      pfad: '/api/office/wiedervorlage',
      bereich: 'wiedervorlagen',
      koerper: { aktion: erledigen ? 'erledigt' : 'offen', id },
      vorschau: { done: erledigen },
    }).catch(() => setMeldung('Das hat nicht geklappt.'))
  }

  return (
    <div className="buero-karte">
      <h2>Wiedervorlage</h2>
      <p className="buero-unterzeile">
        Was hier steht, meldet sich am gewählten Tag aufs Handy.
      </p>

      {offen.length > 0 && (
        <div className="buero-liste">
          {offen.map((w) => {
            const faellig = w.dueDate && new Date(w.dueDate).getTime() <= Date.now()
            return (
              <div key={w.id} className="buero-zeile">
                <div className="buero-zeile-haupt">
                  <div className="buero-zeile-titel">{w.title}</div>
                  <div className="buero-zeile-neben">
                    {datum(w.dueDate)}
                    {w.note ? ` · ${w.note}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}>
                  {faellig && <span className="buero-marker warn">fällig</span>}
                  <button
                    type="button"
                    className="buero-knopf leise schmal"
                    onClick={() => void abhaken(w.id, true)}
                  >
                    erledigt
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="buero-reihe">
        <label className="buero-feld">
          <span>Woran erinnern?</span>
          <input
            value={titel}
            onChange={(e) => setTitel(e.target.value)}
            placeholder="z.B. wegen zweitem Kübel anrufen"
          />
        </label>
        <label className="buero-feld">
          <span>Wann</span>
          <input type="date" value={wann} onChange={(e) => setWann(e.target.value)} />
        </label>
      </div>
      <button type="button" className="buero-knopf" disabled={laeuft} onClick={anlegen}>
        Merken
      </button>
      <Rueckmeldung text={meldung} />

      {erledigt.length > 0 && (
        <p className="buero-unterzeile" style={{ marginTop: '.8rem' }}>
          Erledigt: {erledigt.map((w) => `${w.title} (${datum(w.dueDate)})`).join(' · ')}
        </p>
      )}
    </div>
  )
}
