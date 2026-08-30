'use client'

import React, { useEffect, useRef, useState } from 'react'

import { merkmaleLesen } from '../../../../lib/kalender/merkmale'

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
  const notizFeld = useRef<HTMLTextAreaElement>(null)

  /**
   * Eine Flagge in die Notiz setzen.
   *
   * Immer in einer eigenen Zeile — ein Flag mitten im Satz wirkt nicht (der
   * Leser sucht die Raute am Zeilenanfang, siehe `lib/kalender/merkmale.ts`).
   * Danach steht der Zeiger hinter der eingesetzten Zeile, damit man sofort
   * weiterschreiben kann; das ist der ganze Sinn des Knopfes.
   */
  const flaggeEinfuegen = (text: string) => {
    setNotiz((vorher) => {
      const braucht = vorher.length > 0 && !vorher.endsWith('\n')
      return `${vorher}${braucht ? '\n' : ''}${text}`
    })
    // Nach dem Neuzeichnen den Zeiger ans Ende setzen
    setTimeout(() => {
      const feld = notizFeld.current
      if (!feld) return
      feld.focus()
      feld.selectionStart = feld.selectionEnd = feld.value.length
    }, 0)
  }

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
          <textarea
            ref={notizFeld}
            rows={4}
            value={notiz}
            onChange={(e) => setNotiz(e.target.value)}
            placeholder="Interne Notizen. Für die Website: #öffentlich"
          />
        </label>

        <FlaggenHilfe einfuegen={flaggeEinfuegen} notiz={notiz} />

        {fehler && <p className="buero-hinweis warn">{fehler}</p>}

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

/**
 * Die Flaggen zum Nachlesen — und zum Einsetzen per Klick.
 *
 * Der Grund, warum das hier steht und nicht in einer Anleitung: Ein Muster,
 * das man auswendig können muss, benutzt nach drei Wochen niemand mehr. Wer
 * einen Termin anlegt, hat die Frage „wie war das noch mit der Website?"
 * genau hier — also gehört die Antwort auch hierher.
 *
 * Eingeklappt, damit sie im Weg steht, wenn man sie braucht, und sonst nicht.
 * Der Kopf zeigt trotzdem, ob dieser Termin öffentlich ist: Das ist die eine
 * Angabe, die man auch dann sehen will, wenn man die Hilfe nicht aufklappt.
 */
function FlaggenHilfe({
  einfuegen,
  notiz,
}: {
  einfuegen: (text: string) => void
  notiz: string
}) {
  const [offen, setOffen] = useState(false)
  const merkmale = merkmaleLesen(notiz)

  const flaggen: { flagge: string; was: string; beispiel: string }[] = [
    {
      flagge: '#öffentlich',
      was: 'Zeigt den Termin auf der Website. Ohne das bleibt er intern.',
      beispiel: '#öffentlich\n',
    },
    {
      flagge: '#beschreibung:',
      was: 'Der Text auf der Website. Darf über mehrere Zeilen gehen; **fett** und *kursiv* wirken.',
      beispiel: '#beschreibung: ',
    },
    {
      flagge: '#titel:',
      was: 'Ein anderer Titel nach außen als hier oben.',
      beispiel: '#titel: ',
    },
    {
      flagge: '#ort:',
      was: 'Die Anschrift für Besucher — statt des Kürzels im Feld „Ort".',
      beispiel: '#ort: ',
    },
    { flagge: '#link:', was: 'Die Seite des Veranstalters.', beispiel: '#link: https://' },
    {
      flagge: '#bild:',
      was: 'Der Dateiname eines Bildes aus der Mediathek.',
      beispiel: '#bild: ',
    },
    {
      flagge: '#absage',
      was: 'Der Termin fällt aus. Er bleibt sichtbar, aber deutlich als abgesagt.',
      beispiel: '#absage\n',
    },
  ]

  return (
    <div className="buero-flaggen">
      <button
        type="button"
        className="buero-flaggen-kopf"
        onClick={() => setOffen((o) => !o)}
        aria-expanded={offen}
      >
        <span>{offen ? '▾' : '▸'} Für die Website</span>
        {merkmale.oeffentlich ? (
          <span className="buero-marker erledigt">
            {merkmale.abgesagt ? 'öffentlich · abgesagt' : 'steht auf der Website'}
          </span>
        ) : (
          <span className="buero-flaggen-still">nur intern</span>
        )}
      </button>

      {offen && (
        <div className="buero-flaggen-inhalt">
          <p className="buero-unterzeile">
            In die Notiz geschrieben, wirken diese Zeilen auf der Website. Sie gehen auch am
            Telefon — die Notiz kommt über den Kalender hier an. Anklicken setzt die Zeile ein.
          </p>

          <dl className="buero-flaggen-liste">
            {flaggen.map((f) => (
              <React.Fragment key={f.flagge}>
                <dt>
                  <button
                    type="button"
                    className="buero-flaggen-knopf"
                    onClick={() => einfuegen(f.beispiel)}
                    title="In die Notiz einsetzen"
                  >
                    {f.flagge}
                  </button>
                </dt>
                <dd>{f.was}</dd>
              </React.Fragment>
            ))}
          </dl>

          <p className="buero-unterzeile">
            <strong>Andere Sprache:</strong> Das Kürzel hinter das Flag —{' '}
            <code>#beschreibung:fr:</code> für Französisch, <code>:en:</code> für Englisch. Was
            fehlt, steht auf Deutsch da; eine leere Stelle gibt es nie.
          </p>
          <p className="buero-unterzeile">
            Alles ohne Flagge bleibt intern und steht nirgends draußen.
          </p>
        </div>
      )}
    </div>
  )
}
