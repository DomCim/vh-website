'use client'

import React, { useState } from 'react'
import { Rueckmeldung } from './Rueckmeldung'

const MONATE = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
]

/**
 * Das Monatspaket für den Steuerberater.
 *
 * Vincent schickt Ein- und Ausgaben monatlich an die Kanzlei — bisher als
 * Handarbeit aus Downloads und Fotos. Hier genügt ein Knopf: Das ZIP mit
 * Buchungsliste, Beleg-Scans und Rechnungs-PDFs entsteht am Server und geht
 * wahlweise gleich per Mail hinaus. Vorausgewählt ist der Vormonat, denn der
 * ist es, den man Anfang des Monats verschickt.
 */
export function Monatspaket({ kanzlei }: { kanzlei: string | null }) {
  const jetzt = new Date()
  const vormonat = new Date(jetzt.getFullYear(), jetzt.getMonth() - 1, 1)
  const [jahr, setJahr] = useState(vormonat.getFullYear())
  const [monat, setMonat] = useState(vormonat.getMonth() + 1)
  const [laeuft, setLaeuft] = useState(false)
  const [meldung, setMeldung] = useState<string | null>(null)

  // Die letzten zwölf Monate zur Auswahl — weiter zurück schickt niemand
  const auswahl = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(jetzt.getFullYear(), jetzt.getMonth() - i, 1)
    return { jahr: d.getFullYear(), monat: d.getMonth() + 1 }
  })

  async function senden() {
    if (!kanzlei) return
    const name = `${MONATE[monat - 1]} ${jahr}`
    if (!confirm(`Das Paket für ${name} jetzt an ${kanzlei} schicken?`)) return
    setLaeuft(true)
    setMeldung(null)
    try {
      const res = await fetch('/api/office/steuer/monat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ jahr, monat }),
      })
      const j = await res.json()
      if (!res.ok) {
        setMeldung(
          j?.error === 'keine-kanzlei'
            ? 'Keine Kanzlei-Adresse hinterlegt — Einstellungen → Integrationen → E-Mail-Versand.'
            : 'Der Versand ist fehlgeschlagen.',
        )
        return
      }
      setMeldung(
        (j.alsLink
          ? `Zu groß für einen Anhang — ${j.an} bekam die Buchungsliste plus einen Abhol-Link, 14 Tage gültig.`
          : `Verschickt an ${j.an} — ${j.dateien} Dateien.`) +
          (j.ohneScan ? ` ${j.ohneScan} Ausgaben ohne Scan fehlen im Paket.` : ''),
      )
    } catch {
      setMeldung('Verbindung fehlgeschlagen.')
    } finally {
      setLaeuft(false)
    }
  }

  return (
    <div className="buero-karte">
      <p style={{ marginTop: 0, fontSize: '.9rem', color: 'var(--buero-tinte-leise)' }}>
        Ein ZIP mit allem, was die Kanzlei für den Monat braucht: Buchungsliste als CSV, die Scans
        der Ausgabenbelege und die Ausgangsrechnungen als PDF.
      </p>

      <label className="buero-feld" style={{ maxWidth: '16rem' }}>
        <span>Monat</span>
        <select
          value={`${jahr}-${monat}`}
          onChange={(e) => {
            const [j, m] = e.target.value.split('-').map(Number)
            setJahr(j)
            setMonat(m)
          }}
        >
          {auswahl.map((a) => (
            <option key={`${a.jahr}-${a.monat}`} value={`${a.jahr}-${a.monat}`}>
              {MONATE[a.monat - 1]} {a.jahr}
            </option>
          ))}
        </select>
      </label>

      <Rueckmeldung text={meldung} />

      <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>
        <a className="buero-knopf leise" href={`/api/office/steuer/monat?jahr=${jahr}&monat=${monat}`}>
          Herunterladen
        </a>
        {kanzlei ? (
          <button type="button" className="buero-knopf" disabled={laeuft} onClick={() => void senden()}>
            {laeuft ? 'Geht raus …' : `An ${kanzlei} senden`}
          </button>
        ) : (
          <span className="buero-zeile-neben" style={{ alignSelf: 'center' }}>
            Für den Direktversand die Kanzlei-Adresse hinterlegen: Einstellungen → Integrationen →
            E-Mail-Versand.
          </span>
        )}
      </div>
    </div>
  )
}
