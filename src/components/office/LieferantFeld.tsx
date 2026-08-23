'use client'

import React, { useMemo, useState } from 'react'

import { useBestand } from '../../lib/buero/bestand'
import { absenden } from '../../lib/buero/warteschlange'
import { lieferantKennung } from '../../lib/inventarerfassung'

/**
 * Der Lieferant an einem Posten — mit der Möglichkeit, ihn hier anzulegen.
 *
 * **Warum das nicht nur Bequemlichkeit ist.** Wer zwanzig Schraubensorten
 * erfasst, hat sie in aller Regel von einem oder zwei Händlern. Steht der
 * Händler noch nicht in der Kartei, hieß es bisher: Formular verlassen, unter
 * Partner anlegen, zurücknavigieren, Posten weiterschreiben. Verloren ging
 * dabei nichts — der Entwurf übersteht das —, aber der Faden riss, und zwar
 * genau in dem Augenblick, in dem jemand in Fahrt war. Nach zweimal Hüpfen
 * greift man zur Tabelle, und die Tabelle wollen wir ja loswerden.
 *
 * **Warum nur der Name verlangt wird.** Die Partner-Schnittstelle besteht auf
 * nichts weiter; Anschrift, Steuernummer und Sprache sind nachtragbar. Hier
 * mehr zu verlangen, hieße, die Unterbrechung durch ein Formular zu ersetzen —
 * dasselbe Übel in kleiner.
 *
 * **Und warum die Kennung eine Zeichenkette sein darf.** Ohne Netz vergibt die
 * Warteschlange eine vorläufige Kennung (`neu:…`) und schreibt sie um, sobald
 * der Server seine eigene vergeben hat. Genau dieser Fall — ein Posten
 * verweist auf einen Lieferanten, den es beim Server noch gar nicht gibt — ist
 * der Grund, warum es die vorläufigen Kennungen überhaupt gibt. Wer hier
 * `Number()` darüberlaufen ließe, machte daraus ein `NaN` und verlöre den
 * Lieferanten beim Abschicken.
 */

type Partner = { id: number | string; name?: string | null }

/** Der Eintrag in der Auswahl, der das Anlegen aufklappt */
const ANLEGEN = '__neu'

export type LieferantWert = number | string | '' | null | undefined

export function LieferantFeld({
  wert,
  aendern,
  beschriftung = 'Bezogen von',
}: {
  wert: LieferantWert
  aendern: (id: number | string | '') => void
  beschriftung?: string
}) {
  const partner = useBestand<Partner>('partner')
  const [anlegen, setAnlegen] = useState(false)
  const [name, setName] = useState('')
  const [laeuft, setLaeuft] = useState(false)
  const [meldung, setMeldung] = useState<string | null>(null)

  // Bewusst ungefiltert nach Rolle: Auch ein Kunde kann etwas liefern, und
  // eine harte Schranke hieße nur, dass jemand denselben Betrieb zweimal
  // anlegt — siehe die gleiche Überlegung in PartnerBezug.
  const sortiert = useMemo(
    () => [...partner].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'de')),
    [partner],
  )

  async function speichern() {
    const sauber = name.trim()
    if (!sauber) {
      setMeldung('Ein Name wird gebraucht.')
      return
    }

    setLaeuft(true)
    setMeldung(null)
    try {
      const { id, sofort } = await absenden({
        pfad: '/api/office/partner',
        bereich: 'partner',
        koerper: { name: sauber, role: 'lieferant' },
      })
      aendern(id)
      setAnlegen(false)
      setName('')
      if (!sofort) setMeldung(`${sauber} ist angelegt — geht raus, sobald wieder Netz da ist.`)
    } catch {
      setMeldung('Das hat nicht geklappt.')
    } finally {
      setLaeuft(false)
    }
  }

  /*
   * Beim Anlegen ist die Hülle bewusst ein `div` und kein `label`: Ein Klick
   * auf ein Label reicht den Klick an das erste Bedienfeld darin weiter — die
   * beiden Knöpfe lägen also in einem Element, das jeden Klick zusätzlich ins
   * Namensfeld schickt.
   */
  if (anlegen) {
    return (
      <div className="buero-feld">
        {/*
          `aria-label` und nicht bloß der Text darüber: Die Hülle ist hier ein
          `div`, also verbindet nichts das Wort mit dem Feld — ein Vorleser
          sagte „Eingabefeld" und sonst nichts. Der Platzhaltertext zählt
          dafür nicht, er verschwindet beim ersten Buchstaben.
        */}
        <span aria-hidden="true">{beschriftung}</span>
        <input
          autoFocus
          aria-label={beschriftung}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            // Enter legt an — sonst müsste die Hand für einen einzigen Namen
            // an die Maus und zurück.
            if (e.key === 'Enter') {
              e.preventDefault()
              void speichern()
            }
            if (e.key === 'Escape') setAnlegen(false)
          }}
          placeholder="Name des Lieferanten"
        />
        <div style={{ display: 'flex', gap: '.5rem', marginTop: '.5rem' }}>
          <button
            type="button"
            className="buero-knopf leise"
            disabled={laeuft}
            onClick={() => void speichern()}
          >
            Anlegen
          </button>
          <button
            type="button"
            className="buero-knopf stumm"
            onClick={() => {
              setAnlegen(false)
              setMeldung(null)
            }}
          >
            Abbrechen
          </button>
        </div>
        <span style={{ marginTop: '.4rem' }}>
          Anschrift und Steuernummer lassen sich später unter Partner nachtragen.
        </span>
        {meldung && <span style={{ marginTop: '.4rem' }}>{meldung}</span>}
      </div>
    )
  }

  return (
    <label className="buero-feld">
      <span>{beschriftung}</span>
      <select
        value={wert ?? ''}
        onChange={(e) => {
          const gewaehlt = e.target.value
          if (gewaehlt === ANLEGEN) {
            setAnlegen(true)
            return
          }
          aendern(lieferantKennung(gewaehlt))
        }}
      >
        <option value="">— keiner —</option>
        {sortiert.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
        <option value={ANLEGEN}>+ Neuer Lieferant …</option>
      </select>
      {meldung && <span style={{ marginTop: '.4rem' }}>{meldung}</span>}
    </label>
  )
}
