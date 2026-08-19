'use client'

import React, { useCallback, useEffect, useState } from 'react'

import type { FeldBeschreibung } from '../../lib/felderLesen'
import { Fussleiste } from './Fussleiste'

/**
 * Einstellungen im Büro — gerendert aus der Feldbeschreibung von Payload.
 *
 * Bewusst nicht von Hand nachgebaut: Die Integrationen allein sind über
 * fünfhundert Zeilen Felddefinition. Ein zweites, handgeschriebenes Formular
 * liefe auseinander, sobald jemand ein Feld ergänzt — und zwar unbemerkt. So
 * erscheint hier, was dort steht.
 *
 * Passwörter und Schlüssel sind verdeckt, aber kopierfähig: Man braucht sie
 * regelmäßig zum Einfügen woanders, und ein Feld, das man nur überschreiben
 * kann, ist beim Nachsehen wertlos.
 */

type Werte = Record<string, unknown>

function tiefLesen(werte: Werte, pfad: string[]): unknown {
  return pfad.reduce<unknown>(
    (stand, teil) => (stand && typeof stand === 'object' ? (stand as Werte)[teil] : undefined),
    werte,
  )
}

function tiefSetzen(werte: Werte, pfad: string[], wert: unknown): Werte {
  const [kopf, ...rest] = pfad
  if (!rest.length) return { ...werte, [kopf]: wert }
  const darunter = (werte[kopf] ?? {}) as Werte
  return { ...werte, [kopf]: tiefSetzen(darunter, rest, wert) }
}

function Geheimfeld({
  wert,
  aendern,
}: {
  wert: string
  aendern: (neu: string) => void
}) {
  const [sichtbar, setSichtbar] = useState(false)
  return (
    <div style={{ display: 'flex', gap: '.4rem', alignItems: 'stretch' }}>
      <input
        type={sichtbar ? 'text' : 'password'}
        value={wert}
        onChange={(e) => aendern(e.target.value)}
        style={{ flex: 1, minWidth: 0 }}
        // Kopierfähig soll es bleiben, auch verdeckt
        onFocus={(e) => e.currentTarget.select()}
      />
      <button
        type="button"
        className="buero-knopf schmal leise"
        onClick={() => setSichtbar((s) => !s)}
        aria-label={sichtbar ? 'Verdecken' : 'Anzeigen'}
      >
        {sichtbar ? 'verdecken' : 'zeigen'}
      </button>
    </div>
  )
}

function Feld({
  feld,
  pfad,
  werte,
  setzen,
}: {
  feld: FeldBeschreibung
  pfad: string[]
  werte: Werte
  setzen: (pfad: string[], wert: unknown) => void
}) {
  const eigenerPfad = [...pfad, feld.name]
  const wert = tiefLesen(werte, eigenerPfad)

  if (feld.art === 'gruppe') {
    return (
      <fieldset className="buero-karte" style={{ marginBottom: '1rem' }}>
        <legend className="buero-zeile-titel">{feld.label}</legend>
        {feld.hinweis && <p className="buero-unterzeile">{feld.hinweis}</p>}
        {(feld.felder ?? []).map((unterfeld) => (
          <Feld
            key={unterfeld.name}
            feld={unterfeld}
            pfad={eigenerPfad}
            werte={werte}
            setzen={setzen}
          />
        ))}
      </fieldset>
    )
  }

  if (feld.art === 'liste') {
    const eintraege = Array.isArray(wert) ? (wert as Werte[]) : []
    return (
      <fieldset className="buero-karte" style={{ marginBottom: '1rem' }}>
        <legend className="buero-zeile-titel">{feld.label}</legend>
        {feld.hinweis && <p className="buero-unterzeile">{feld.hinweis}</p>}

        {eintraege.length === 0 && <div className="buero-leer">Noch nichts eingetragen.</div>}

        {eintraege.map((_, i) => (
          <div
            key={i}
            style={{
              borderTop: '1px solid var(--buero-linie)',
              paddingTop: '.8rem',
              marginTop: '.8rem',
            }}
          >
            {(feld.felder ?? []).map((unterfeld) => (
              <Feld
                key={unterfeld.name}
                feld={unterfeld}
                pfad={[...eigenerPfad, String(i)]}
                werte={werte}
                setzen={setzen}
              />
            ))}
            <button
              type="button"
              className="buero-knopf schmal gefahr"
              onClick={() =>
                setzen(
                  eigenerPfad,
                  eintraege.filter((_, k) => k !== i),
                )
              }
            >
              Entfernen
            </button>
          </div>
        ))}

        <button
          type="button"
          className="buero-knopf leise schmal"
          style={{ marginTop: '.8rem' }}
          onClick={() => setzen(eigenerPfad, [...eintraege, {}])}
        >
          Hinzufügen
        </button>
      </fieldset>
    )
  }

  if (feld.art === 'haken') {
    return (
      <label className="buero-feld" style={{ flexDirection: 'row', alignItems: 'center', gap: '.5rem' }}>
        <input
          type="checkbox"
          checked={Boolean(wert)}
          onChange={(e) => setzen(eigenerPfad, e.target.checked)}
          style={{ width: 'auto' }}
        />
        <span>{feld.label}</span>
        {feld.hinweis && <span className="buero-unterzeile"> — {feld.hinweis}</span>}
      </label>
    )
  }

  return (
    <label className="buero-feld">
      <span>
        {feld.label}
        {feld.pflicht ? ' *' : ''}
      </span>

      {feld.art === 'absatz' ? (
        <textarea
          rows={3}
          value={(wert as string) ?? ''}
          onChange={(e) => setzen(eigenerPfad, e.target.value)}
        />
      ) : feld.art === 'auswahl' ? (
        <select
          value={(wert as string) ?? ''}
          onChange={(e) => setzen(eigenerPfad, e.target.value)}
        >
          <option value="">— bitte wählen —</option>
          {(feld.optionen ?? []).map((o) => (
            <option key={o.wert} value={o.wert}>
              {o.text}
            </option>
          ))}
        </select>
      ) : feld.geheim ? (
        <Geheimfeld
          wert={(wert as string) ?? ''}
          aendern={(neu) => setzen(eigenerPfad, neu)}
        />
      ) : (
        <input
          type={feld.art === 'zahl' ? 'number' : feld.art === 'email' ? 'email' : 'text'}
          inputMode={feld.art === 'zahl' ? 'decimal' : undefined}
          value={wert == null ? '' : String(wert)}
          onChange={(e) =>
            setzen(
              eigenerPfad,
              feld.art === 'zahl'
                ? e.target.value === ''
                  ? null
                  : Number(e.target.value)
                : e.target.value,
            )
          }
        />
      )}

      {feld.hinweis && <span className="buero-unterzeile">{feld.hinweis}</span>}
    </label>
  )
}

export function EinstellungenFormular({
  bereich,
  titel,
}: {
  bereich: 'betrieb' | 'integrationen'
  titel: string
}) {
  const [felder, setFelder] = useState<FeldBeschreibung[] | null>(null)
  const [werte, setWerte] = useState<Werte>({})
  /** Der Stand beim Öffnen — daran wird gemessen, was wirklich geändert wurde. */
  const [urspruenglich, setUrspruenglich] = useState<Werte>({})
  const [meldung, setMeldung] = useState<string | null>(null)
  const [laeuft, setLaeuft] = useState(false)

  useEffect(() => {
    let abgebrochen = false
    void (async () => {
      try {
        const antwort = await fetch(`/api/office/einstellungen?bereich=${bereich}`, {
          credentials: 'include',
        })
        if (!antwort.ok) throw new Error('nicht erreichbar')
        const daten = await antwort.json()
        if (abgebrochen) return
        setFelder(daten.felder)
        setWerte(daten.werte ?? {})
        setUrspruenglich(daten.werte ?? {})
      } catch {
        if (!abgebrochen) setMeldung('Einstellungen brauchen eine Verbindung.')
      }
    })()
    return () => {
      abgebrochen = true
    }
  }, [bereich])

  const setzen = useCallback((pfad: string[], wert: unknown) => {
    setWerte((v) => tiefSetzen(v, pfad, wert))
    setMeldung(null)
  }, [])

  async function speichern() {
    /*
     * Nur das Geänderte schicken, nicht das ganze Blatt.
     *
     * Sonst überschriebe ein Speichern hier still, was jemand anderes in der
     * Zwischenzeit an einer anderen Stelle geändert hat — und dieses Formular
     * kann lange offen stehen. Payload übernimmt, was mitkommt, und lässt den
     * Rest, wie er ist.
     */
    const geaendert: Werte = {}
    for (const schluessel of Object.keys(werte)) {
      if (JSON.stringify(werte[schluessel]) !== JSON.stringify(urspruenglich[schluessel])) {
        geaendert[schluessel] = werte[schluessel]
      }
    }

    if (!Object.keys(geaendert).length) {
      setMeldung('Nichts geändert.')
      return
    }

    setLaeuft(true)
    setMeldung(null)
    try {
      const antwort = await fetch('/api/office/einstellungen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ bereich, werte: geaendert }),
      })
      if (antwort.ok) {
        setUrspruenglich(werte)
        setMeldung('Gespeichert.')
      } else {
        setMeldung('Das hat nicht geklappt.')
      }
    } catch {
      setMeldung('Einstellungen brauchen eine Verbindung.')
    } finally {
      setLaeuft(false)
    }
  }

  if (!felder) {
    return (
      <>
        <h2>{titel}</h2>
        <div className="buero-leer">{meldung ?? 'wird geholt …'}</div>
      </>
    )
  }

  return (
    <>
      <h2>{titel}</h2>
      {meldung && <p className="buero-hinweis">{meldung}</p>}

      {felder.map((feld) => (
        <Feld key={feld.name} feld={feld} pfad={[]} werte={werte} setzen={setzen} />
      ))}

      <Fussleiste>
        <button type="button" className="buero-knopf" disabled={laeuft} onClick={speichern}>
          {laeuft ? 'speichert …' : 'Speichern'}
        </button>
      </Fussleiste>
    </>
  )
}
