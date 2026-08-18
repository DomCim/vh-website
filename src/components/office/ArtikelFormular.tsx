'use client'

import { useRouter } from 'next/navigation'
import React, { useMemo, useState } from 'react'

export type StuecklistenZeile = { item: number | ''; quantity: number; note?: string | null }
export type DienstleisterZeile = {
  contact: number | ''
  service: string
  cost?: number | null
  leadTime?: string | null
  note?: string | null
}

export type PostenAuswahl = { id: number; name: string; unit: string; unitValue: number }
export type PartnerAuswahl = { id: number; name: string }

const euro = (v: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v)

/**
 * Stückliste und Dienstleister eines Artikels.
 *
 * Der Artikel selbst — Titel, Preis, Bilder — bleibt in der Website-Verwaltung.
 * Was ihn kostet und wer daran mitarbeitet, ist Sache des Betriebs und steht
 * deshalb hier.
 */
export function ArtikelFormular({
  produktId,
  stueckliste,
  dienstleister,
  posten,
  partner,
  verkaufspreis,
  arbeitsminuten,
  stundensatz,
  wunschaufschlag,
}: {
  produktId: number
  stueckliste: StuecklistenZeile[]
  dienstleister: DienstleisterZeile[]
  posten: PostenAuswahl[]
  partner: PartnerAuswahl[]
  verkaufspreis?: number | null
  /** Arbeitszeit je Stück in Minuten — steht am Artikel in der Verwaltung */
  arbeitsminuten?: number | null
  stundensatz: number
  wunschaufschlag: number
}) {
  const router = useRouter()
  const [zeilen, setZeilen] = useState<StuecklistenZeile[]>(stueckliste)
  const [dienste, setDienste] = useState<DienstleisterZeile[]>(dienstleister)
  const [minuten, setMinuten] = useState<number>(arbeitsminuten ?? 0)
  const [laeuft, setLaeuft] = useState(false)
  const [meldung, setMeldung] = useState<string | null>(null)

  // Was ein Stück an Material und Fremdleistung kostet — die Grundlage dafür,
  // ob der Preis auf der Website den Aufwand überhaupt deckt
  const kosten = useMemo(() => {
    const material = zeilen.reduce((s, z) => {
      const p = posten.find((x) => x.id === Number(z.item))
      return s + (p?.unitValue ?? 0) * (z.quantity || 0)
    }, 0)
    const fremd = dienste.reduce((s, d) => s + (d.cost ?? 0), 0)
    const arbeit = (minuten / 60) * stundensatz
    const runden = (n: number) => Math.round(n * 100) / 100
    const summe = material + fremd + arbeit
    return {
      material: runden(material),
      fremd: runden(fremd),
      arbeit: runden(arbeit),
      summe: runden(summe),
      // Preisvorschlag aus Einsatz plus Wunschaufschlag — der Anfang eines
      // Angebots, nicht sein Ende: Was der Markt hergibt, weiß die Werkstatt
      // besser als eine Formel.
      vorschlag: runden(summe * (1 + wunschaufschlag / 100)),
    }
  }, [zeilen, dienste, posten, minuten, stundensatz, wunschaufschlag])

  async function speichern() {
    setLaeuft(true)
    setMeldung(null)
    try {
      const res = await fetch('/api/office/stueckliste', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          produktId,
          zeilen: zeilen.filter((z) => z.item && z.quantity),
          dienstleister: dienste.filter((d) => d.contact && d.service?.trim()),
          arbeitsminuten: minuten || 0,
        }),
      })
      setMeldung(res.ok ? 'Gespeichert.' : 'Das hat nicht geklappt.')
      if (res.ok) router.refresh()
    } catch {
      setMeldung('Verbindung fehlgeschlagen.')
    } finally {
      setLaeuft(false)
    }
  }

  return (
    <div className="buero-karte">
      {meldung && <p className="buero-hinweis">{meldung}</p>}

      <h2>Material je Stück</h2>
      {zeilen.length === 0 && (
        <p className="buero-unterzeile">
          Ohne Stückliste kann das System bei einer Bestellung nicht prüfen, ob alles da ist.
        </p>
      )}
      {zeilen.map((z, i) => (
        <div key={i} className="buero-reihe">
          <label className="buero-feld" style={{ gridColumn: 'span 2' }}>
            <span>Posten</span>
            <select
              value={z.item}
              onChange={(e) =>
                setZeilen((v) =>
                  v.map((x, idx) => (idx === i ? { ...x, item: Number(e.target.value) || '' } : x)),
                )
              }
            >
              <option value="">— wählen —</option>
              {posten.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.unit ? ` (${p.unit})` : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="buero-feld">
            <span>Menge</span>
            <input
              inputMode="decimal"
              value={z.quantity}
              onChange={(e) =>
                setZeilen((v) =>
                  v.map((x, idx) =>
                    idx === i ? { ...x, quantity: Number(e.target.value) || 0 } : x,
                  ),
                )
              }
            />
          </label>
          <label className="buero-feld">
            <span>Bemerkung</span>
            <input
              value={z.note ?? ''}
              onChange={(e) =>
                setZeilen((v) => v.map((x, idx) => (idx === i ? { ...x, note: e.target.value } : x)))
              }
            />
          </label>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button
              type="button"
              className="buero-knopf leise"
              onClick={() => setZeilen((v) => v.filter((_, idx) => idx !== i))}
            >
              Entfernen
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        className="buero-knopf leise"
        onClick={() => setZeilen((v) => [...v, { item: '', quantity: 1 }])}
      >
        Material hinzufügen
      </button>

      <h2>Externe Dienstleister</h2>
      {dienste.length === 0 && (
        <p className="buero-unterzeile">
          Verzinkerei, Beschichter, Laserschneider — wer von außen mitarbeitet, gehört hierher.
        </p>
      )}
      {dienste.map((d, i) => (
        <div key={i} className="buero-reihe">
          <label className="buero-feld">
            <span>Betrieb</span>
            <select
              value={d.contact}
              onChange={(e) =>
                setDienste((v) =>
                  v.map((x, idx) =>
                    idx === i ? { ...x, contact: Number(e.target.value) || '' } : x,
                  ),
                )
              }
            >
              <option value="">— wählen —</option>
              {partner.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="buero-feld">
            <span>Leistung</span>
            <input
              value={d.service}
              placeholder="z.B. Verzinken"
              onChange={(e) =>
                setDienste((v) =>
                  v.map((x, idx) => (idx === i ? { ...x, service: e.target.value } : x)),
                )
              }
            />
          </label>
          <label className="buero-feld">
            <span>Kosten je Stück</span>
            <input
              inputMode="decimal"
              value={d.cost ?? ''}
              onChange={(e) =>
                setDienste((v) =>
                  v.map((x, idx) => (idx === i ? { ...x, cost: Number(e.target.value) || 0 } : x)),
                )
              }
            />
          </label>
          <label className="buero-feld">
            <span>Vorlaufzeit</span>
            <input
              value={d.leadTime ?? ''}
              placeholder="z.B. 10 Werktage"
              onChange={(e) =>
                setDienste((v) =>
                  v.map((x, idx) => (idx === i ? { ...x, leadTime: e.target.value } : x)),
                )
              }
            />
          </label>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button
              type="button"
              className="buero-knopf leise"
              onClick={() => setDienste((v) => v.filter((_, idx) => idx !== i))}
            >
              Entfernen
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        className="buero-knopf leise"
        onClick={() => setDienste((v) => [...v, { contact: '', service: '', cost: 0 }])}
      >
        Dienstleister hinzufügen
      </button>

      <h2 style={{ marginTop: '1.5rem' }}>Arbeitszeit</h2>
      <div className="buero-reihe">
        <label className="buero-feld">
          <span>Minuten je Stück</span>
          <input
            inputMode="numeric"
            value={minuten || ''}
            onChange={(e) => setMinuten(Number(e.target.value.replace(/[^\d]/g, '')) || 0)}
            placeholder="z.B. 240"
          />
        </label>
        <div className="buero-feld">
          <span>Stundensatz</span>
          <div style={{ padding: '.55rem 0', color: 'var(--buero-tinte-leise)' }}>
            {euro(stundensatz)} — änderbar in den Website-Einstellungen
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: '1.5rem',
          paddingTop: '.9rem',
          borderTop: '1px solid var(--buero-linie)',
          display: 'grid',
          gap: '.25rem',
          maxWidth: '22rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--buero-tinte-leise)' }}>Material</span>
          <span className="buero-betrag">{euro(kosten.material)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--buero-tinte-leise)' }}>Fremdleistung</span>
          <span className="buero-betrag">{euro(kosten.fremd)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--buero-tinte-leise)' }}>
            Arbeitszeit ({Math.floor(minuten / 60)} h {String(minuten % 60).padStart(2, '0')} min)
          </span>
          <span className="buero-betrag">{euro(kosten.arbeit)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
          <span>Einsatz je Stück</span>
          <span className="buero-betrag">{euro(kosten.summe)}</span>
        </div>
        {typeof verkaufspreis === 'number' && verkaufspreis > 0 && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              color: 'var(--buero-tinte-leise)',
              fontSize: '.85rem',
            }}
          >
            <span>bleibt vom Website-Preis</span>
            <span className="buero-betrag">{euro(verkaufspreis - kosten.summe)}</span>
          </div>
        )}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            color: 'var(--buero-tinte-leise)',
            fontSize: '.85rem',
          }}
        >
          <span>Preisvorschlag (+{wunschaufschlag} %)</span>
          <span className="buero-betrag">{euro(kosten.vorschlag)}</span>
        </div>
        {typeof verkaufspreis === 'number' &&
          verkaufspreis > 0 &&
          verkaufspreis < kosten.summe && (
            <div className="buero-hinweis warn" style={{ marginTop: '.6rem' }}>
              Der Website-Preis liegt unter dem Einsatz. Jedes verkaufte Stück kostet die Werkstatt
              Geld.
            </div>
          )}
      </div>

      <div style={{ marginTop: '1.25rem' }}>
        <button type="button" className="buero-knopf" disabled={laeuft} onClick={() => void speichern()}>
          Speichern
        </button>
      </div>
    </div>
  )
}
