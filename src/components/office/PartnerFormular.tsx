'use client'

import { useRouter } from 'next/navigation'
import React, { useState } from 'react'

export type PartnerWerte = {
  id?: number | string
  name?: string | null
  role?: string
  email?: string | null
  phone?: string | null
  line1?: string | null
  postalCode?: string | null
  city?: string | null
  country?: string | null
  vatId?: string | null
  siret?: string | null
  defaultCategory?: string | null
  notes?: string | null
}

const ARTEN = [
  { wert: 'lieferant', text: 'Lieferant' },
  { wert: 'kunde', text: 'Kunde' },
  { wert: 'dienstleister', text: 'Dienstleister' },
  { wert: 'beides', text: 'Mehreres' },
]

/** Lieferant, Kunde oder Dienstleister — eine Kartei für alle. */
export function PartnerFormular({
  werte,
  kategorien,
}: {
  werte: PartnerWerte
  kategorien: { wert: string; text: string }[]
}) {
  const router = useRouter()
  const [w, setW] = useState<PartnerWerte>({ role: 'beides', country: 'Frankreich', ...werte })
  const [laeuft, setLaeuft] = useState(false)
  const [meldung, setMeldung] = useState<string | null>(null)

  const setzen = (teil: Partial<PartnerWerte>) => setW((v) => ({ ...v, ...teil }))

  async function speichern() {
    if (!w.name?.trim()) {
      setMeldung('Ein Name wird gebraucht.')
      return
    }
    setLaeuft(true)
    setMeldung(null)
    try {
      const res = await fetch('/api/office/partner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(w),
      })
      const j = await res.json()
      if (!res.ok) {
        setMeldung('Das hat nicht geklappt.')
        return
      }
      if (!w.id) router.push(`/office/partner/${j.id}`)
      else setMeldung('Gespeichert.')
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

      <div className="buero-reihe">
        <label className="buero-feld" style={{ gridColumn: 'span 2' }}>
          <span>Name / Firma</span>
          <input value={w.name ?? ''} onChange={(e) => setzen({ name: e.target.value })} />
        </label>
        <label className="buero-feld">
          <span>Art</span>
          <select value={w.role} onChange={(e) => setzen({ role: e.target.value })}>
            {ARTEN.map((a) => (
              <option key={a.wert} value={a.wert}>
                {a.text}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="buero-reihe">
        <label className="buero-feld">
          <span>E-Mail</span>
          <input
            type="email"
            value={w.email ?? ''}
            onChange={(e) => setzen({ email: e.target.value })}
          />
        </label>
        <label className="buero-feld">
          <span>Telefon</span>
          <input value={w.phone ?? ''} onChange={(e) => setzen({ phone: e.target.value })} />
        </label>
      </div>

      <label className="buero-feld">
        <span>Straße &amp; Hausnummer</span>
        <input value={w.line1 ?? ''} onChange={(e) => setzen({ line1: e.target.value })} />
      </label>

      <div className="buero-reihe">
        <label className="buero-feld">
          <span>PLZ</span>
          <input
            value={w.postalCode ?? ''}
            onChange={(e) => setzen({ postalCode: e.target.value })}
          />
        </label>
        <label className="buero-feld">
          <span>Ort</span>
          <input value={w.city ?? ''} onChange={(e) => setzen({ city: e.target.value })} />
        </label>
        <label className="buero-feld">
          <span>Land</span>
          <input value={w.country ?? ''} onChange={(e) => setzen({ country: e.target.value })} />
        </label>
      </div>

      <div className="buero-reihe">
        <label className="buero-feld">
          <span>USt-IdNr. / TVA</span>
          <input value={w.vatId ?? ''} onChange={(e) => setzen({ vatId: e.target.value })} />
        </label>
        <label className="buero-feld">
          <span>SIRET</span>
          <input value={w.siret ?? ''} onChange={(e) => setzen({ siret: e.target.value })} />
        </label>
        <label className="buero-feld">
          <span>Übliche Ausgaben-Kategorie</span>
          <select
            value={w.defaultCategory ?? ''}
            onChange={(e) => setzen({ defaultCategory: e.target.value })}
          >
            <option value="">— keine —</option>
            {kategorien.map((k) => (
              <option key={k.wert} value={k.wert}>
                {k.text}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="buero-unterzeile">
        Die Kategorie wird bei neuen Belegen dieses Lieferanten vorgeschlagen. Eine USt-IdNr. sorgt
        bei Geschäftskunden im EU-Ausland dafür, dass die Rechnung ohne Steuer rausgeht.
      </p>

      <label className="buero-feld">
        <span>Notiz</span>
        <textarea rows={2} value={w.notes ?? ''} onChange={(e) => setzen({ notes: e.target.value })} />
      </label>

      <button type="button" className="buero-knopf" disabled={laeuft} onClick={() => void speichern()}>
        Speichern
      </button>
    </div>
  )
}
