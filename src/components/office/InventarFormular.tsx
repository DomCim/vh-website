'use client'

import { useRouter } from 'next/navigation'
import React, { useState } from 'react'
import { useEntwurf } from '../../lib/buero/entwurf'
import { absenden } from '../../lib/buero/warteschlange'
import { EntwurfLeiste } from './EntwurfLeiste'
import { Fussleiste } from './Fussleiste'

export type InventarWerte = {
  id?: number | string
  name?: string | null
  type?: string
  quantity?: number | null
  unit?: string | null
  minQuantity?: number | null
  orderQuantity?: number | null
  supplierRef?: string | null
  unitValue?: number | null
  location?: string | null
  purchaseDate?: string | null
  purchaseValue?: number | null
  supplier?: number | '' | null
  notes?: string | null
}

const ARTEN = [
  { wert: 'material', text: 'Material & Rohstoff' },
  { wert: 'werkzeug', text: 'Werkzeug' },
  { wert: 'maschine', text: 'Maschine & Anlage' },
  { wert: 'fertigware', text: 'Fertiges Stück' },
  { wert: 'sonstiges', text: 'Sonstiges' },
]

const nurTag = (v?: string | null) => (v ? String(v).slice(0, 10) : '')

/** Ein Posten im Lager — Bestand, Wert und wo er liegt. */
export function InventarFormular({
  werte,
  lieferanten,
}: {
  werte: InventarWerte
  lieferanten: { id: number; name: string }[]
}) {
  const router = useRouter()
  const [anfang] = useState<InventarWerte>(() => ({
    type: 'material',
    unit: 'Stück',
    quantity: 0,
    ...werte,
  }))
  const [w, setW] = useState<InventarWerte>(anfang)

  // Angefangenes überlebt den Gerätewechsel — siehe lib/buero/entwurf.ts
  const entwurf = useEntwurf(`inventar:${werte.id ?? 'neu'}`, w, anfang)
  const [laeuft, setLaeuft] = useState(false)
  const [meldung, setMeldung] = useState<string | null>(null)

  const setzen = (teil: Partial<InventarWerte>) => setW((v) => ({ ...v, ...teil }))

  async function speichern() {
    if (!w.name?.trim()) {
      setMeldung('Eine Bezeichnung wird gebraucht.')
      return
    }
    setLaeuft(true)
    setMeldung(null)
    try {
      const { id, sofort } = await absenden({
        pfad: '/api/office/inventar',
        bereich: 'inventar',
        koerper: { ...w },
      })
      entwurf.erledigt()
      if (!w.id && sofort) router.push(`/office/inventar/${id}`)
      else setMeldung(sofort ? 'Gespeichert.' : 'Gemerkt — geht raus, sobald wieder Netz da ist.')
    } catch {
      setMeldung('Das hat nicht geklappt.')
    } finally {
      setLaeuft(false)
    }
  }

  return (
    <div className="buero-karte">
      <EntwurfLeiste
        angebot={entwurf.angebot}
        aufWeitermachen={() => {
          const stand = entwurf.uebernehmen()
          if (stand) setW(stand)
        }}
        aufVerwerfen={entwurf.verwerfen}
      />
      {meldung && <p className="buero-hinweis">{meldung}</p>}

      <label className="buero-feld">
        <span>Bezeichnung</span>
        <input value={w.name ?? ''} onChange={(e) => setzen({ name: e.target.value })} />
      </label>

      <div className="buero-reihe">
        <label className="buero-feld">
          <span>Art</span>
          <select value={w.type} onChange={(e) => setzen({ type: e.target.value })}>
            {ARTEN.map((a) => (
              <option key={a.wert} value={a.wert}>
                {a.text}
              </option>
            ))}
          </select>
        </label>
        <label className="buero-feld">
          <span>Bestand</span>
          <input
            inputMode="decimal"
            value={w.quantity ?? 0}
            onChange={(e) => setzen({ quantity: Number(e.target.value) || 0 })}
          />
        </label>
        <label className="buero-feld">
          <span>Einheit</span>
          <input value={w.unit ?? ''} onChange={(e) => setzen({ unit: e.target.value })} />
        </label>
        <label className="buero-feld">
          <span>Mindestbestand</span>
          <input
            inputMode="decimal"
            value={w.minQuantity ?? ''}
            onChange={(e) =>
              // Geleert heißt „kein Mindestbestand" — nicht „Mindestbestand null"
              setzen({ minQuantity: e.target.value === '' ? null : Number(e.target.value) || 0 })
            }
          />
          <span style={{ marginTop: '.4rem' }}>
            Darunter meldet sich das Büro und der Posten steht unter „Nachbestellen“.
          </span>
        </label>
      </div>

      <div className="buero-reihe">
        <label className="buero-feld">
          <span>Nachbestellmenge</span>
          <input
            inputMode="decimal"
            value={w.orderQuantity ?? ''}
            onChange={(e) =>
              setzen({ orderQuantity: e.target.value === '' ? null : Number(e.target.value) || 0 })
            }
            placeholder="z.B. 100"
          />
          <span style={{ marginTop: '.4rem' }}>
            Übliche Bestellmenge, z.B. eine ganze Rolle. Leer heißt: auf das Doppelte des
            Mindestbestands auffüllen.
          </span>
        </label>
        <label className="buero-feld" style={{ gridColumn: 'span 2' }}>
          <span>Artikelnummer beim Lieferanten</span>
          <input
            value={w.supplierRef ?? ''}
            onChange={(e) => setzen({ supplierRef: e.target.value })}
            placeholder="steht in der Bestellanfrage"
          />
        </label>
      </div>

      <div className="buero-reihe">
        <label className="buero-feld">
          <span>Wert je Einheit netto (EUR)</span>
          <input
            inputMode="decimal"
            value={w.unitValue ?? ''}
            onChange={(e) =>
              setzen({ unitValue: e.target.value === '' ? null : Number(e.target.value) || 0 })
            }
          />
        </label>
        <label className="buero-feld">
          <span>Lagerort</span>
          <input value={w.location ?? ''} onChange={(e) => setzen({ location: e.target.value })} />
        </label>
        <label className="buero-feld">
          <span>Bezogen von</span>
          <select
            value={w.supplier ?? ''}
            onChange={(e) => setzen({ supplier: Number(e.target.value) || '' })}
          >
            <option value="">— keiner —</option>
            {lieferanten.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="buero-reihe">
        <label className="buero-feld">
          <span>Angeschafft am</span>
          <input
            type="date"
            value={nurTag(w.purchaseDate)}
            onChange={(e) => setzen({ purchaseDate: e.target.value })}
          />
        </label>
        <label className="buero-feld">
          <span>Anschaffungswert netto (EUR)</span>
          <input
            inputMode="decimal"
            value={w.purchaseValue ?? ''}
            onChange={(e) =>
              setzen({ purchaseValue: e.target.value === '' ? null : Number(e.target.value) || 0 })
            }
          />
        </label>
      </div>

      <label className="buero-feld">
        <span>Notiz</span>
        <textarea rows={2} value={w.notes ?? ''} onChange={(e) => setzen({ notes: e.target.value })} />
      </label>

      <Fussleiste>
        <button type="button" className="buero-knopf" disabled={laeuft} onClick={() => void speichern()}>
          Speichern
        </button>
      </Fussleiste>
    </div>
  )
}
