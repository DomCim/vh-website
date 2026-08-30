'use client'

import React, { useEffect, useState } from 'react'

/**
 * Die Maske für einen eigenen Termin — anlegen, ändern, löschen.
 *
 * Bewusst kein eigenes Fenstersystem: Das Büro hat keines, und eines für
 * diese eine Stelle zu erfinden hieße, es an jeder weiteren zu pflegen. Die
 * Maske legt sich als Schicht über das Blatt und schließt bei Escape und beim
 * Klick daneben — das ist das, was man von einem Fenster erwartet, ohne dass
 * es eines wird.
 *
 * Geschrieben wird über `/api/office/termin`. Der örtliche Bestand kommt über
 * die Live-Meldung nach (siehe `lib/liveHooks.ts`), die Ansicht muss also
 * nichts nachladen.
 */

type Termin = {
  id: number | string
  title?: string | null
  start?: string | null
  ende?: string | null
  ganztaegig?: boolean | null
  ort?: string | null
  notiz?: string | null
}

/** Ein Zeitpunkt, wie ihn `<input type="datetime-local">` erwartet. */
function fuerFeld(wert: string | Date | null | undefined): string {
  if (!wert) return ''
  const d = new Date(wert)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(
    d.getMinutes(),
  )}`
}

/** Nur der Tag, für das Datumsfeld eines ganztägigen Termins. */
function tagFuerFeld(wert: string | Date | null | undefined): string {
  if (!wert) return ''
  const d = new Date(wert)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function TerminMaske({
  id,
  tag,
  termine,
  schliessen,
  fertig,
}: {
  id?: number | string
  /** Der Tag, auf den geklickt wurde — Vorgabe für einen neuen Termin. */
  tag?: string
  termine: Termin[]
  schliessen: () => void
  fertig: () => void
}) {
  const vorhanden = id ? termine.find((t) => String(t.id) === String(id)) : undefined

  const [titel, setTitel] = useState(vorhanden?.title ?? '')
  const [ganztaegig, setGanztaegig] = useState(Boolean(vorhanden?.ganztaegig))
  const [start, setStart] = useState(() => {
    if (vorhanden?.start) return fuerFeld(vorhanden.start)
    // Ein neuer Termin beginnt auf dem angeklickten Tag um 9 Uhr — irgendeine
    // Vorgabe muss dastehen, und der Morgen trifft es öfter als Mitternacht
    return tag ? `${tag}T09:00` : fuerFeld(new Date())
  })
  const [ende, setEnde] = useState(vorhanden?.ende ? fuerFeld(vorhanden.ende) : '')
  const [ort, setOrt] = useState(vorhanden?.ort ?? '')
  const [notiz, setNotiz] = useState(vorhanden?.notiz ?? '')
  const [laeuft, setLaeuft] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)

  // Escape schließt — dasselbe, was jedes Fenster tut
  useEffect(() => {
    const auf = (e: KeyboardEvent) => {
      if (e.key === 'Escape') schliessen()
    }
    window.addEventListener('keydown', auf)
    return () => window.removeEventListener('keydown', auf)
  }, [schliessen])

  const speichern = async () => {
    setFehler(null)
    if (!titel.trim()) {
      setFehler('Ohne Titel geht es nicht.')
      return
    }
    setLaeuft(true)
    try {
      const antwort = await fetch('/api/office/termin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          title: titel,
          /*
           * Ganztägig heißt: nur ein Datum. Das Feld liefert dann `2026-08-30`
           * ohne Uhrzeit — mit angehängter Mitternacht wird daraus ein
           * Zeitpunkt, den der Server als Tag versteht.
           */
          start: ganztaegig ? `${start.slice(0, 10)}T00:00:00` : start,
          ende: ende ? (ganztaegig ? `${ende.slice(0, 10)}T00:00:00` : ende) : null,
          ganztaegig,
          ort,
          notiz,
        }),
      })
      const daten = await antwort.json()
      if (!antwort.ok) {
        setFehler(daten.error ?? 'Das hat nicht geklappt.')
        return
      }
      fertig()
    } catch {
      setFehler('Keine Verbindung. Der Termin wurde nicht gespeichert.')
    } finally {
      setLaeuft(false)
    }
  }

  const loeschen = async () => {
    if (!id) return
    setLaeuft(true)
    try {
      const antwort = await fetch(`/api/office/termin?id=${encodeURIComponent(String(id))}`, {
        method: 'DELETE',
      })
      if (!antwort.ok) {
        setFehler('Das Löschen hat nicht geklappt.')
        return
      }
      fertig()
    } catch {
      setFehler('Keine Verbindung. Der Termin steht noch.')
    } finally {
      setLaeuft(false)
    }
  }

  return (
    <div
      className="buero-terminmaske-schicht"
      onClick={(e) => {
        // Nur der Klick daneben schließt, nicht der in die Maske hinein
        if (e.target === e.currentTarget) schliessen()
      }}
    >
      <div className="buero-terminmaske" role="dialog" aria-modal="true">
        <h2>{id ? 'Termin ändern' : 'Termin anlegen'}</h2>

        <label className="buero-feld">
          <span>Worum geht es?</span>
          <input
            value={titel}
            onChange={(e) => setTitel(e.target.value)}
            placeholder="z.B. Steuerberater"
            autoFocus
          />
        </label>

        <label className="buero-feld waagerecht">
          <input
            type="checkbox"
            checked={ganztaegig}
            onChange={(e) => setGanztaegig(e.target.checked)}
          />
          <span>Ganztägig</span>
        </label>

        <div className="buero-terminmaske-zeiten">
          <label className="buero-feld">
            <span>Beginn</span>
            <input
              type={ganztaegig ? 'date' : 'datetime-local'}
              value={ganztaegig ? tagFuerFeld(start) : start}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <label className="buero-feld">
            <span>Ende</span>
            <input
              type={ganztaegig ? 'date' : 'datetime-local'}
              value={ganztaegig ? tagFuerFeld(ende) : ende}
              onChange={(e) => setEnde(e.target.value)}
            />
          </label>
        </div>

        <label className="buero-feld">
          <span>Ort</span>
          <input value={ort} onChange={(e) => setOrt(e.target.value)} />
        </label>

        <label className="buero-feld">
          <span>Notiz</span>
          <textarea rows={3} value={notiz} onChange={(e) => setNotiz(e.target.value)} />
        </label>

        {fehler && <p className="buero-fehler">{fehler}</p>}

        <div className="buero-terminmaske-fuss">
          {id && (
            <button
              type="button"
              className="buero-knopf leise schmal"
              onClick={loeschen}
              disabled={laeuft}
            >
              Löschen
            </button>
          )}
          <span style={{ flex: 1 }} />
          <button
            type="button"
            className="buero-knopf leise schmal"
            onClick={schliessen}
            disabled={laeuft}
          >
            Abbrechen
          </button>
          <button type="button" className="buero-knopf schmal" onClick={speichern} disabled={laeuft}>
            {laeuft ? 'Einen Augenblick…' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  )
}
