'use client'

import { useRouter } from 'next/navigation'
import React, { useMemo, useState } from 'react'
import { AbsendeFehler, absenden } from '../../lib/buero/warteschlange'

export type InventurZeile = {
  item: number
  name: string
  einheit: string
  expected?: number | null
  counted: number
  unitValue?: number | null
  note?: string | null
}

export type InventurWerte = {
  id?: number | string
  title?: string | null
  date?: string | null
  status?: string
  notes?: string | null
  lines: InventurZeile[]
}

const euro = (v: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v)
const nurTag = (v?: string | null) => (v ? String(v).slice(0, 10) : '')

/**
 * Zählliste zum Stichtag.
 *
 * Solange der Lauf offen ist, ändert sich am Inventar nichts. Erst beim
 * Abschließen wandert der gezählte Bestand hinüber — und dann ist Schluss:
 * ein nachträglich änderbarer Inventurwert wäre für den Abschluss wertlos.
 */
export function InventurFormular({ werte }: { werte: InventurWerte }) {
  const router = useRouter()
  const [w, setW] = useState<InventurWerte>(werte)
  const [laeuft, setLaeuft] = useState(false)
  const [meldung, setMeldung] = useState<string | null>(null)

  const fertig = w.status === 'abgeschlossen'
  const setzen = (teil: Partial<InventurWerte>) => setW((v) => ({ ...v, ...teil }))

  const summe = useMemo(
    () =>
      Math.round(w.lines.reduce((s, z) => s + (z.counted || 0) * (z.unitValue ?? 0), 0) * 100) / 100,
    [w.lines],
  )
  const abweichungen = w.lines.filter(
    (z) => typeof z.expected === 'number' && z.counted !== z.expected,
  )

  async function speichern(neuerStatus?: string) {
    if (!w.title?.trim()) {
      setMeldung('Eine Bezeichnung wird gebraucht.')
      return
    }
    if (neuerStatus === 'abgeschlossen') {
      const sicher = window.confirm(
        'Abschließen übernimmt die gezählten Mengen ins Inventar. Danach lässt sich der Lauf nicht mehr ändern. Fortfahren?',
      )
      if (!sicher) return
    }
    setLaeuft(true)
    setMeldung(null)
    try {
      const { id, sofort } = await absenden({
        pfad: '/api/office/inventur',
        bereich: 'inventur',
        koerper: {
          id: w.id,
          title: w.title,
          date: w.date,
          notes: w.notes,
          status: neuerStatus ?? w.status ?? 'offen',
          lines: w.lines.map((z) => ({
            item: z.item,
            expected: z.expected,
            counted: z.counted,
            unitValue: z.unitValue,
            note: z.note,
          })),
        },
      })
      if (!w.id && sofort) router.push(`/office/inventur/${id}`)
      else {
        setzen({ status: neuerStatus ?? w.status })
        setMeldung(
          !sofort
            ? 'Gemerkt — geht raus, sobald wieder Netz da ist.'
            : neuerStatus === 'abgeschlossen'
              ? 'Abgeschlossen.'
              : 'Gespeichert.',
        )
      }
    } catch (err) {
      if (err instanceof AbsendeFehler && err.daten?.error === 'abgeschlossen') {
        setMeldung('Der Lauf ist bereits abgeschlossen.')
        return
      }
      setMeldung('Das hat nicht geklappt.')
    } finally {
      setLaeuft(false)
    }
  }

  return (
    <div className="buero-karte">
      {meldung && <p className="buero-hinweis">{meldung}</p>}
      {fertig && (
        <p className="buero-hinweis">
          Abgeschlossen — die gezählten Mengen stehen im Inventar, der Wert ist eingefroren.
        </p>
      )}

      <div className="buero-reihe">
        <label className="buero-feld" style={{ gridColumn: 'span 2' }}>
          <span>Bezeichnung</span>
          <input
            value={w.title ?? ''}
            disabled={fertig}
            onChange={(e) => setzen({ title: e.target.value })}
          />
        </label>
        <label className="buero-feld">
          <span>Stichtag</span>
          <input
            type="date"
            value={nurTag(w.date)}
            disabled={fertig}
            onChange={(e) => setzen({ date: e.target.value })}
          />
        </label>
      </div>

      <h2>Gezählte Posten</h2>
      {w.lines.length === 0 && <p className="buero-unterzeile">Keine Posten im Inventar.</p>}
      {w.lines.map((z, i) => {
        const abweichung = typeof z.expected === 'number' ? z.counted - z.expected : 0
        return (
          <div key={z.item} className="buero-reihe">
            <label className="buero-feld" style={{ gridColumn: 'span 2' }}>
              <span>Posten</span>
              <input value={`${z.name}${z.einheit ? ` (${z.einheit})` : ''}`} readOnly />
            </label>
            <label className="buero-feld">
              <span>Soll</span>
              <input value={z.expected ?? '—'} readOnly />
            </label>
            <label className="buero-feld">
              <span>Gezählt</span>
              <input
                inputMode="decimal"
                value={z.counted}
                disabled={fertig}
                onChange={(e) =>
                  setzen({
                    lines: w.lines.map((x, idx) =>
                      idx === i ? { ...x, counted: Number(e.target.value) || 0 } : x,
                    ),
                  })
                }
              />
            </label>
            <label className="buero-feld">
              <span>{abweichung === 0 ? 'Bemerkung' : `Bemerkung (${abweichung > 0 ? '+' : ''}${abweichung})`}</span>
              <input
                value={z.note ?? ''}
                disabled={fertig}
                onChange={(e) =>
                  setzen({
                    lines: w.lines.map((x, idx) =>
                      idx === i ? { ...x, note: e.target.value } : x,
                    ),
                  })
                }
              />
            </label>
          </div>
        )
      })}

      <div
        style={{
          marginTop: '1.25rem',
          paddingTop: '.9rem',
          borderTop: '1px solid var(--buero-linie)',
          display: 'flex',
          justifyContent: 'space-between',
          maxWidth: '20rem',
          marginLeft: 'auto',
          fontWeight: 600,
        }}
      >
        <span>Bestandswert</span>
        <span className="buero-betrag">{euro(summe)}</span>
      </div>
      {abweichungen.length > 0 && !fertig && (
        <p className="buero-unterzeile" style={{ textAlign: 'right' }}>
          {abweichungen.length} Posten weichen vom Soll ab.
        </p>
      )}

      <label className="buero-feld" style={{ marginTop: '1rem' }}>
        <span>Notiz</span>
        <textarea
          rows={2}
          value={w.notes ?? ''}
          disabled={fertig}
          onChange={(e) => setzen({ notes: e.target.value })}
        />
      </label>

      {!fertig && (
        <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="buero-knopf leise"
            disabled={laeuft}
            onClick={() => void speichern()}
          >
            Zwischenstand speichern
          </button>
          <button
            type="button"
            className="buero-knopf"
            disabled={laeuft}
            onClick={() => void speichern('abgeschlossen')}
          >
            Abschließen &amp; ins Inventar übernehmen
          </button>
        </div>
      )}
    </div>
  )
}
