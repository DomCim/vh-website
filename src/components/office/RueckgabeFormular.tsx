'use client'

import React, { useState } from 'react'

import { AbsendeFehler, absenden } from '../../lib/buero/warteschlange'
import { euro } from '../../lib/format'
import { RUECKGABE_GRUND, RUECKGABE_STATUS, RUECKGABE_UEBERGAENGE } from '../../lib/listen'
import { Fussleiste } from './Fussleiste'
import { Rueckmeldung } from './Rueckmeldung'

export type RueckgabeWerte = {
  grund?: string | null
  status?: string | null
  betrag?: number | null
  angefragtAm?: string | null
  wareZurueckAm?: string | null
  erstattetAm?: string | null
  notiz?: string | null
}

/**
 * Die Rückabwicklung einer Bestellung — Storno, Widerruf, Reklamation.
 *
 * **Warum das Geld hier nicht zurückgeht.** Es gäbe den Weg: PayPal kann auf
 * Zuruf erstatten. Genau das wäre aber der einzige Vorgang im Haus, der auf
 * einen Klick hin unumkehrbar Geld verschiebt — dieselbe Linie wie bei
 * Rechnungen und Mahnungen: Es entsteht ein Vorgang, ausgeführt wird er von
 * Hand. Hier steht deshalb nur, was zu erstatten ist und ob es geschehen ist.
 *
 * **Warum kein Weg zurück aus „erstattet" und „abgelehnt".** Beides ist nach
 * außen geschehen — Geld ist geflossen oder der Kundschaft wurde abgesagt.
 * Wer korrigieren muss, tut das in der Verwaltung und sieht dabei, was er tut.
 */
export function RueckgabeFormular({
  id,
  werte,
  gesamt,
}: {
  id: number | string
  werte: RueckgabeWerte
  /** Bestellsumme — Vorschlag für den Erstattungsbetrag */
  gesamt?: number | null
}) {
  const [w, setW] = useState<RueckgabeWerte>(werte)
  const [laeuft, setLaeuft] = useState(false)
  const [meldung, setMeldung] = useState<string | null>(null)

  const stand = w.status ?? 'offen'
  const erledigt = stand === 'erstattet' || stand === 'abgelehnt'
  const erlaubt = RUECKGABE_UEBERGAENGE[werte.status ?? ''] ?? null

  const setzen = (teil: Partial<RueckgabeWerte>) => setW((v) => ({ ...v, ...teil }))

  async function speichern() {
    if (!w.grund) {
      setMeldung('Ohne Grund gibt es keinen Vorgang — Storno, Widerruf oder Reklamation.')
      return
    }
    setLaeuft(true)
    setMeldung(null)
    try {
      const { sofort } = await absenden({
        pfad: '/api/office/bestellung',
        bereich: 'bestellungen',
        koerper: { id, rueckgabe: { ...w } },
      })
      setMeldung(sofort ? 'Gespeichert.' : 'Gemerkt — geht raus, sobald wieder Netz da ist.')
    } catch (err) {
      setMeldung(
        err instanceof AbsendeFehler && err.daten?.error === 'stand-nicht-erlaubt'
          ? 'Von dort führt kein Weg dorthin. Was erstattet oder abgelehnt ist, bleibt es.'
          : 'Das hat nicht geklappt.',
      )
    } finally {
      setLaeuft(false)
    }
  }

  return (
    <div className="buero-karte">
      <Rueckmeldung text={meldung} />

      <div className="buero-reihe">
        <label className="buero-feld">
          <span>Grund</span>
          <select value={w.grund ?? ''} onChange={(e) => setzen({ grund: e.target.value })}>
            <option value="">— keiner —</option>
            {RUECKGABE_GRUND.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
        </label>
        <label className="buero-feld">
          <span>Stand</span>
          <select
            value={stand}
            disabled={erledigt}
            onChange={(e) => setzen({ status: e.target.value })}
          >
            {RUECKGABE_STATUS.filter(
              // Nur, wohin es von hier aus wirklich geht
              (s) => !erlaubt || s.value === werte.status || erlaubt.includes(s.value),
            ).map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="buero-feld">
          <span>Zu erstatten (€)</span>
          <input
            inputMode="decimal"
            value={w.betrag ?? ''}
            placeholder={gesamt ? String(gesamt) : ''}
            onChange={(e) =>
              setzen({ betrag: e.target.value === '' ? null : Number(e.target.value.replace(',', '.')) })
            }
          />
          <span style={{ marginTop: '.4rem' }}>
            Beim Widerruf ohne die Rücksendekosten — die trägt laut Widerrufsbelehrung der Kunde.
          </span>
        </label>
      </div>

      <label className="buero-feld">
        <span>Notiz</span>
        <textarea
          rows={2}
          value={w.notiz ?? ''}
          onChange={(e) => setzen({ notiz: e.target.value })}
        />
      </label>

      {stand === 'erstattet' ? (
        <p className="buero-unterzeile">
          Als erstattet vermerkt{w.betrag ? ` · ${euro(w.betrag)}` : ''}. Zurückgeschickt hat das
          Geld ein Mensch beim Zahlungsdienst — das Portal bewegt keins.
        </p>
      ) : (
        <p className="buero-unterzeile">
          Das Portal erstattet nichts von selbst. Geld zurück beim Zahlungsdienst, danach hier auf
          {' „Erstattet“ '} stellen.
        </p>
      )}

      {!erledigt && (
        <Fussleiste>
          <button
            type="button"
            className="buero-knopf"
            disabled={laeuft}
            onClick={() => void speichern()}
          >
            Speichern
          </button>
        </Fussleiste>
      )}
    </div>
  )
}
