'use client'

import { useRouter } from 'next/navigation'
import React, { useState } from 'react'

export type AuftragPosition = {
  description: string
  quantity: number
  price?: number | null
}

export type AuftragMaterial = {
  item: number | ''
  quantity: number
}

export type AuftragWerte = {
  id?: number | string
  jobNumber?: string | null
  status?: string
  source?: string
  title?: string | null
  customerName?: string | null
  startDate?: string | null
  dueDate?: string | null
  positions?: AuftragPosition[]
  material?: AuftragMaterial[]
  notes?: string | null
  materialGebucht?: boolean
}

export type PostenAuswahl = { id: number; name: string; unit: string; quantity: number }

const nurTag = (v?: string | null) => (v ? String(v).slice(0, 10) : '')

const STATUS = [
  { wert: 'geplant', text: 'Geplant' },
  { wert: 'inFertigung', text: 'In Fertigung' },
  { wert: 'fertig', text: 'Fertig' },
  { wert: 'geliefert', text: 'Geliefert' },
  { wert: 'abgebrochen', text: 'Abgebrochen' },
]

/**
 * Ein Stück durch die Werkstatt begleiten.
 *
 * Das Material steht hier als Plan. Abgebucht wird es erst, wenn der Auftrag
 * auf „Fertig" springt — vorher wäre der Bestand falsch, sobald ein Auftrag
 * doch nicht gebaut wird.
 */
export function AuftragFormular({
  werte,
  posten,
}: {
  werte: AuftragWerte
  posten: PostenAuswahl[]
}) {
  const router = useRouter()
  const [w, setW] = useState<AuftragWerte>({
    status: 'geplant',
    positions: [{ description: '', quantity: 1 }],
    material: [],
    ...werte,
  })
  const [laeuft, setLaeuft] = useState(false)
  const [meldung, setMeldung] = useState<string | null>(null)

  const setzen = (teil: Partial<AuftragWerte>) => setW((v) => ({ ...v, ...teil }))

  // Fehlmengen sofort sichtbar, ohne die Seite neu zu laden
  const knapp = (w.material ?? [])
    .map((m) => {
      const p = posten.find((x) => x.id === Number(m.item))
      if (!p) return null
      const fehlt = Math.round(((m.quantity || 0) - p.quantity) * 1000) / 1000
      return fehlt > 0 ? { name: p.name, fehlt, einheit: p.unit } : null
    })
    .filter(Boolean) as { name: string; fehlt: number; einheit: string }[]

  async function speichern(neuerStatus?: string) {
    if (!w.title?.trim()) {
      setMeldung('Eine Bezeichnung wird gebraucht.')
      return
    }
    setLaeuft(true)
    setMeldung(null)
    try {
      const res = await fetch('/api/office/auftrag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...w, status: neuerStatus ?? w.status }),
      })
      const j = await res.json()
      if (!res.ok) {
        setMeldung('Das hat nicht geklappt.')
        return
      }
      if (!w.id) router.push(`/office/auftraege/${j.id}`)
      else {
        setzen({ status: neuerStatus ?? w.status })
        setMeldung('Gespeichert.')
      }
      router.refresh()
    } catch {
      setMeldung('Verbindung fehlgeschlagen.')
    } finally {
      setLaeuft(false)
    }
  }

  return (
    <div className="buero-karte">
      {meldung && <p className="buero-hinweis">{meldung}</p>}
      {knapp.length > 0 && (
        <p className="buero-hinweis">
          Nicht alles im Haus:{' '}
          {knapp.map((k) => `${k.name} (${k.fehlt} ${k.einheit} fehlen)`).join(', ')} — bestellen,
          bevor es losgeht.
        </p>
      )}

      <label className="buero-feld">
        <span>Bezeichnung</span>
        <input value={w.title ?? ''} onChange={(e) => setzen({ title: e.target.value })} />
      </label>

      <div className="buero-reihe">
        <label className="buero-feld">
          <span>Kunde</span>
          <input
            value={w.customerName ?? ''}
            onChange={(e) => setzen({ customerName: e.target.value })}
          />
        </label>
        <label className="buero-feld">
          <span>Start</span>
          <input
            type="date"
            value={nurTag(w.startDate)}
            onChange={(e) => setzen({ startDate: e.target.value })}
          />
        </label>
        <label className="buero-feld">
          <span>Fertig bis</span>
          <input
            type="date"
            value={nurTag(w.dueDate)}
            onChange={(e) => setzen({ dueDate: e.target.value })}
          />
        </label>
        <label className="buero-feld">
          <span>Status</span>
          <select value={w.status} onChange={(e) => setzen({ status: e.target.value })}>
            {STATUS.map((s) => (
              <option key={s.wert} value={s.wert}>
                {s.text}
              </option>
            ))}
          </select>
        </label>
      </div>

      <h2>Was gefertigt wird</h2>
      {(w.positions ?? []).map((p, i) => (
        <div key={i} className="buero-reihe">
          <label className="buero-feld" style={{ gridColumn: 'span 2' }}>
            <span>Beschreibung</span>
            <input
              value={p.description}
              onChange={(e) =>
                setzen({
                  positions: (w.positions ?? []).map((x, idx) =>
                    idx === i ? { ...x, description: e.target.value } : x,
                  ),
                })
              }
            />
          </label>
          <label className="buero-feld">
            <span>Menge</span>
            <input
              inputMode="decimal"
              value={p.quantity}
              onChange={(e) =>
                setzen({
                  positions: (w.positions ?? []).map((x, idx) =>
                    idx === i ? { ...x, quantity: Number(e.target.value) || 0 } : x,
                  ),
                })
              }
            />
          </label>
          <label className="buero-feld">
            <span>Preis (EUR)</span>
            <input
              inputMode="decimal"
              value={p.price ?? ''}
              onChange={(e) =>
                setzen({
                  positions: (w.positions ?? []).map((x, idx) =>
                    idx === i ? { ...x, price: Number(e.target.value) || 0 } : x,
                  ),
                })
              }
            />
          </label>
        </div>
      ))}
      <button
        type="button"
        className="buero-knopf leise"
        onClick={() =>
          setzen({ positions: [...(w.positions ?? []), { description: '', quantity: 1 }] })
        }
      >
        Position hinzufügen
      </button>

      <h2>Geplantes Material</h2>
      {w.materialGebucht && (
        <p className="buero-unterzeile">Bereits vom Inventar abgezogen — Änderungen wirken nicht mehr nach.</p>
      )}
      {(w.material ?? []).map((m, i) => (
        <div key={i} className="buero-reihe">
          <label className="buero-feld" style={{ gridColumn: 'span 2' }}>
            <span>Posten</span>
            <select
              value={m.item}
              onChange={(e) =>
                setzen({
                  material: (w.material ?? []).map((x, idx) =>
                    idx === i ? { ...x, item: Number(e.target.value) || '' } : x,
                  ),
                })
              }
            >
              <option value="">— wählen —</option>
              {posten.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.quantity} {p.unit} da)
                </option>
              ))}
            </select>
          </label>
          <label className="buero-feld">
            <span>Menge</span>
            <input
              inputMode="decimal"
              value={m.quantity}
              onChange={(e) =>
                setzen({
                  material: (w.material ?? []).map((x, idx) =>
                    idx === i ? { ...x, quantity: Number(e.target.value) || 0 } : x,
                  ),
                })
              }
            />
          </label>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button
              type="button"
              className="buero-knopf leise"
              onClick={() => setzen({ material: (w.material ?? []).filter((_, idx) => idx !== i) })}
            >
              Entfernen
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        className="buero-knopf leise"
        onClick={() => setzen({ material: [...(w.material ?? []), { item: '', quantity: 1 }] })}
      >
        Material hinzufügen
      </button>

      <label className="buero-feld" style={{ marginTop: '1.5rem' }}>
        <span>Notizen zur Fertigung</span>
        <textarea
          rows={3}
          value={w.notes ?? ''}
          onChange={(e) => setzen({ notes: e.target.value })}
        />
      </label>

      <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="buero-knopf"
          disabled={laeuft}
          onClick={() => void speichern()}
        >
          Speichern
        </button>
        {w.status === 'geplant' && (
          <button
            type="button"
            className="buero-knopf leise"
            disabled={laeuft}
            onClick={() => void speichern('inFertigung')}
          >
            In Fertigung nehmen
          </button>
        )}
        {w.status === 'inFertigung' && (
          <button
            type="button"
            className="buero-knopf leise"
            disabled={laeuft}
            onClick={() => void speichern('fertig')}
          >
            Fertig melden &amp; Material abbuchen
          </button>
        )}
      </div>
    </div>
  )
}
