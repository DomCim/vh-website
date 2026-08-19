'use client'

import { useRouter } from 'next/navigation'
import React, { useMemo, useState } from 'react'

import { VersandKnopf } from './VersandKnopf'
import { useEntwurf } from '../../lib/buero/entwurf'
import { absenden } from '../../lib/buero/warteschlange'
import { EntwurfLeiste } from './EntwurfLeiste'

export type Position = {
  description: string
  quantity: number
  unit: string
  unitPrice: number
  vatRate: number
}

export type RechnungWerte = {
  id?: number | string
  invoiceNumber?: string | null
  status?: string
  customerName?: string | null
  customerAddress?: string | null
  customerSiret?: string | null
  customerVatId?: string | null
  deliveryAddress?: string | null
  deliveryDate?: string | null
  businessType?: string | null
  buyerReference?: string | null
  issueDate?: string | null
  dueDate?: string | null
  paidDate?: string | null
  items?: Position[]
  reverseCharge?: boolean
  note?: string | null
}

const nurTag = (v?: string | null) => (v ? String(v).slice(0, 10) : '')
const euro = (v: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v)

/**
 * Rechnung schreiben.
 *
 * Solange der Status „Entwurf" ist, hat die Rechnung keine Nummer. Erst beim
 * Umstellen auf „Gestellt" wird sie aus dem Nummernkreis vergeben — so bleibt
 * die Reihe lückenlos, auch wenn ein Entwurf verworfen wird.
 */
export function RechnungFormular({ werte }: { werte: RechnungWerte }) {
  const router = useRouter()
  const [anfang] = useState<RechnungWerte>(() => ({
    status: 'entwurf',
    items: [{ description: '', quantity: 1, unit: 'Stück', unitPrice: 0, vatRate: 20 }],
    ...werte,
  }))
  const [w, setW] = useState<RechnungWerte>(anfang)

  // Angefangenes überlebt den Gerätewechsel — siehe lib/buero/entwurf.ts
  const entwurf = useEntwurf(`rechnungen:${werte.id ?? 'neu'}`, w, anfang)
  const [laeuft, setLaeuft] = useState(false)
  const [meldung, setMeldung] = useState<string | null>(null)

  const festgeschrieben = Boolean(w.invoiceNumber)
  const setzen = (teil: Partial<RechnungWerte>) => setW((v) => ({ ...v, ...teil }))

  const summen = useMemo(() => {
    const runden = (n: number) => Math.round(n * 100) / 100
    let netto = 0
    let steuer = 0
    for (const p of w.items ?? []) {
      const zeile = (p.quantity || 0) * (p.unitPrice || 0)
      netto += zeile
      steuer += zeile * ((w.reverseCharge ? 0 : p.vatRate || 0) / 100)
    }
    return { netto: runden(netto), steuer: runden(steuer), brutto: runden(netto + steuer) }
  }, [w.items, w.reverseCharge])

  const setzePosition = (i: number, teil: Partial<Position>) =>
    setW((v) => ({
      ...v,
      items: (v.items ?? []).map((p, idx) => (idx === i ? { ...p, ...teil } : p)),
    }))

  async function speichern(neuerStatus?: string) {
    if (!w.customerName?.trim()) {
      setMeldung('Ein Kundenname wird gebraucht.')
      return
    }
    if (!(w.items ?? []).some((p) => p.description.trim())) {
      setMeldung('Mindestens eine Position mit Beschreibung wird gebraucht.')
      return
    }
    setLaeuft(true)
    setMeldung(null)
    try {
      const { id, sofort } = await absenden({
        pfad: '/api/office/rechnung',
        bereich: 'rechnungen',
        koerper: { ...w, status: neuerStatus ?? w.status },
      })
      // Ohne Netz bekommt eine neue Rechnung nur eine vorläufige Kennung
      entwurf.erledigt()
      if (sofort) router.push(`/office/rechnungen/${id}`)
      else setMeldung('Gemerkt — geht raus, sobald wieder Netz da ist.')
    } catch {
      setMeldung('Speichern fehlgeschlagen.')
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
      {festgeschrieben && (
        <p className="buero-hinweis">
          Rechnung <strong>{w.invoiceNumber}</strong> ist gestellt. Positionen und Beträge sollten
          jetzt nicht mehr geändert werden — für Korrekturen oben auf „Stornieren“ tippen; das legt
          die Gegenrechnung mit Verweis auf diese hier an.
        </p>
      )}
      {meldung && <p className="buero-hinweis">{meldung}</p>}

      <div className="buero-reihe">
        <label className="buero-feld">
          <span>Kunde</span>
          <input
            value={w.customerName ?? ''}
            onChange={(e) => setzen({ customerName: e.target.value })}
            placeholder="z.B. Stadt Naila"
          />
        </label>
        <label className="buero-feld">
          <span>Rechnungsdatum</span>
          <input
            type="date"
            value={nurTag(w.issueDate)}
            onChange={(e) => setzen({ issueDate: e.target.value })}
          />
        </label>
        <label className="buero-feld">
          <span>Fällig am</span>
          <input
            type="date"
            value={nurTag(w.dueDate)}
            onChange={(e) => setzen({ dueDate: e.target.value })}
          />
        </label>
      </div>

      <label className="buero-feld">
        <span>Rechnungsanschrift</span>
        <textarea
          rows={3}
          value={w.customerAddress ?? ''}
          onChange={(e) => setzen({ customerAddress: e.target.value })}
          placeholder={'Straße 1\n12345 Ort\nFrankreich'}
        />
      </label>

      {/* Angaben für die elektronische Rechnung. Bei Privatkundschaft bleiben
          sie leer — dort verlangt sie niemand. */}
      <h2 style={{ marginTop: '1.5rem' }}>Elektronische Rechnung</h2>
      <p className="buero-unterzeile" style={{ marginTop: '-.4rem' }}>
        Bei Geschäftskunden gehört die Kennung des Empfängers dazu, sonst weist die Plattform die
        Rechnung ab.
      </p>
      <div className="buero-reihe">
        <label className="buero-feld">
          <span>SIRET/SIREN des Kunden</span>
          <input
            value={w.customerSiret ?? ''}
            onChange={(e) => setzen({ customerSiret: e.target.value })}
            placeholder="14-stellig"
          />
        </label>
        <label className="buero-feld">
          <span>TVA-Nummer des Kunden</span>
          <input
            value={w.customerVatId ?? ''}
            onChange={(e) => setzen({ customerVatId: e.target.value })}
            placeholder="FR…"
          />
        </label>
      </div>
      <div className="buero-reihe">
        <label className="buero-feld">
          <span>Bestellnummer des Kunden</span>
          <input
            value={w.buyerReference ?? ''}
            onChange={(e) => setzen({ buyerReference: e.target.value })}
            placeholder="Aktenzeichen, Vergabenummer …"
          />
        </label>
        <label className="buero-feld">
          <span>Liefer-/Leistungsdatum</span>
          <input
            type="date"
            value={nurTag(w.deliveryDate)}
            onChange={(e) => setzen({ deliveryDate: e.target.value })}
          />
        </label>
        <label className="buero-feld">
          <span>Art des Geschäfts</span>
          <select
            value={w.businessType ?? 'lieferung'}
            onChange={(e) => setzen({ businessType: e.target.value })}
          >
            <option value="lieferung">Lieferung von Waren</option>
            <option value="dienstleistung">Dienstleistung</option>
            <option value="gemischt">Beides gemischt</option>
          </select>
        </label>
      </div>
      <label className="buero-feld">
        <span>Abweichende Lieferanschrift</span>
        <textarea
          rows={2}
          value={w.deliveryAddress ?? ''}
          onChange={(e) => setzen({ deliveryAddress: e.target.value })}
          placeholder="nur wenn woandershin geliefert wurde"
        />
      </label>

      <h2 style={{ marginTop: '1.5rem' }}>Positionen</h2>
      {(w.items ?? []).map((p, i) => (
        <div
          key={i}
          style={{
            border: '1px solid var(--buero-linie)',
            borderRadius: 8,
            padding: '.8rem .9rem',
            marginBottom: '.6rem',
          }}
        >
          <label className="buero-feld">
            <span>Beschreibung</span>
            <input
              value={p.description}
              onChange={(e) => setzePosition(i, { description: e.target.value })}
              placeholder="z.B. Sitzbank Cortenstahl, 2,00 m, nach Zeichnung"
            />
          </label>
          <div className="buero-reihe">
            <label className="buero-feld">
              <span>Menge</span>
              <input
                inputMode="decimal"
                value={p.quantity}
                onChange={(e) => setzePosition(i, { quantity: Number(e.target.value) || 0 })}
              />
            </label>
            <label className="buero-feld">
              <span>Einheit</span>
              <input value={p.unit} onChange={(e) => setzePosition(i, { unit: e.target.value })} />
            </label>
            <label className="buero-feld">
              <span>Einzelpreis netto</span>
              <input
                inputMode="decimal"
                value={p.unitPrice}
                onChange={(e) => setzePosition(i, { unitPrice: Number(e.target.value) || 0 })}
              />
            </label>
            <label className="buero-feld">
              <span>Steuersatz (%)</span>
              <input
                inputMode="decimal"
                value={p.vatRate}
                onChange={(e) => setzePosition(i, { vatRate: Number(e.target.value) || 0 })}
              />
            </label>
          </div>
          {(w.items ?? []).length > 1 && (
            <button
              type="button"
              className="buero-knopf leise"
              onClick={() => setzen({ items: (w.items ?? []).filter((_, idx) => idx !== i) })}
            >
              Position entfernen
            </button>
          )}
        </div>
      ))}

      <button
        type="button"
        className="buero-knopf leise"
        onClick={() =>
          setzen({
            items: [
              ...(w.items ?? []),
              { description: '', quantity: 1, unit: 'Stück', unitPrice: 0, vatRate: 20 },
            ],
          })
        }
      >
        Position hinzufügen
      </button>

      <div
        style={{
          marginTop: '1.25rem',
          paddingTop: '.9rem',
          borderTop: '1px solid var(--buero-linie)',
          display: 'grid',
          gap: '.25rem',
          maxWidth: '20rem',
          marginLeft: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--buero-tinte-leise)' }}>Netto</span>
          <span className="buero-betrag">{euro(summen.netto)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--buero-tinte-leise)' }}>Steuer</span>
          <span className="buero-betrag">{euro(summen.steuer)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
          <span>Gesamt</span>
          <span className="buero-betrag">{euro(summen.brutto)}</span>
        </div>
      </div>

      <label style={{ display: 'flex', gap: '.4rem', alignItems: 'center', fontSize: '.88rem', margin: '1rem 0' }}>
        <input
          type="checkbox"
          checked={Boolean(w.reverseCharge)}
          onChange={(e) => setzen({ reverseCharge: e.target.checked })}
        />
        Reverse Charge (Geschäftskunde im EU-Ausland, ohne Steuer)
      </label>

      <label className="buero-feld">
        <span>Hinweis auf der Rechnung</span>
        <textarea rows={2} value={w.note ?? ''} onChange={(e) => setzen({ note: e.target.value })} />
      </label>

      <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap', marginTop: '.5rem' }}>
        <button
          type="button"
          className="buero-knopf leise"
          disabled={laeuft}
          onClick={() => void speichern()}
        >
          Speichern
        </button>
        {!festgeschrieben && (
          <button
            type="button"
            className="buero-knopf"
            disabled={laeuft}
            onClick={() => void speichern('gestellt')}
          >
            Festschreiben &amp; Nummer vergeben
          </button>
        )}
        {festgeschrieben && w.status !== 'bezahlt' && (
          <button
            type="button"
            className="buero-knopf"
            disabled={laeuft}
            onClick={() => void speichern('bezahlt')}
          >
            Als bezahlt markieren
          </button>
        )}
        {festgeschrieben && (
          <>
            <a
              className="buero-knopf leise"
              href={`/api/office/rechnung/${w.id}/pdf`}
              target="_blank"
              rel="noreferrer"
            >
              PDF ansehen
            </a>
            {w.id && <VersandKnopf art="rechnung" id={w.id} />}
          </>
        )}
      </div>
    </div>
  )
}
