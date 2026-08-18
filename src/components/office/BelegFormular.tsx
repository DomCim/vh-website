'use client'

import { useRouter } from 'next/navigation'
import React, { useState } from 'react'

export type Kategorie = { label: string; value: string }

export type BelegWerte = {
  id?: number | string
  title?: string | null
  supplierName?: string | null
  invoiceNumber?: string | null
  invoiceDate?: string | null
  dueDate?: string | null
  netAmount?: number | null
  vatRate?: number | null
  vatAmount?: number | null
  grossAmount?: number | null
  category?: string
  paymentMethod?: string | null
  paid?: boolean
  deductible?: boolean
  notes?: string | null
  documentId?: number | null
  documentUrl?: string | null
  extraction?: { status?: string | null; confidence?: number | null; note?: string | null } | null
}

const nurTag = (v?: string | null) => (v ? String(v).slice(0, 10) : '')

/**
 * Beleg erfassen und bearbeiten.
 *
 * Ablauf in der Werkstatt: Foto machen, hochladen, auslesen lassen, kurz
 * prüfen, speichern. Die KI füllt nur Felder — bestätigt wird von Hand.
 */
export function BelegFormular({
  werte,
  kategorien,
  kiVerfuegbar,
}: {
  werte: BelegWerte
  kategorien: Kategorie[]
  kiVerfuegbar: boolean
}) {
  const router = useRouter()
  const [w, setW] = useState<BelegWerte>({
    category: 'sonstiges',
    paid: true,
    deductible: true,
    ...werte,
  })
  const [laeuft, setLaeuft] = useState<null | 'upload' | 'lesen' | 'speichern' | 'loeschen'>(null)
  const [meldung, setMeldung] = useState<string | null>(null)

  const setzen = (teil: Partial<BelegWerte>) => setW((v) => ({ ...v, ...teil }))
  const zahl = (s: string) => (s.trim() === '' ? null : Number(s.replace(',', '.')))

  async function hochladen(datei: File) {
    setLaeuft('upload')
    setMeldung(null)
    try {
      const daten = new FormData()
      daten.append('datei', datei)
      const res = await fetch('/api/office/beleg-upload', {
        method: 'POST',
        body: daten,
        credentials: 'include',
      })
      const j = await res.json()
      if (!res.ok) {
        setMeldung(j.error === 'zu-gross' ? 'Die Datei ist zu groß (max. 25 MB).' : 'Upload fehlgeschlagen.')
        return
      }
      setzen({ documentId: j.id, documentUrl: j.url })
      if (kiVerfuegbar) await auslesen(j.id)
    } catch {
      setMeldung('Upload fehlgeschlagen.')
    } finally {
      setLaeuft(null)
    }
  }

  async function auslesen(medienId?: number | null) {
    const id = medienId ?? w.documentId
    if (!id) return
    setLaeuft('lesen')
    setMeldung(null)
    try {
      const res = await fetch('/api/ki', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ aktion: 'beleg', medienId: id }),
      })
      const j = await res.json()
      if (!res.ok) {
        setMeldung(
          j.error === 'kein-schluessel'
            ? 'Kein Anthropic-Schlüssel hinterlegt — Felder bitte von Hand ausfüllen.'
            : 'Der Beleg konnte nicht gelesen werden.',
        )
        return
      }
      const b = j.beleg
      setzen({
        title: b.bezeichnung ?? w.title,
        supplierName: b.lieferant ?? w.supplierName,
        invoiceNumber: b.rechnungsnummer ?? w.invoiceNumber,
        invoiceDate: b.rechnungsdatum ?? w.invoiceDate,
        dueDate: b.faelligkeit ?? w.dueDate,
        netAmount: b.netto ?? w.netAmount,
        vatRate: b.steuersatz ?? w.vatRate,
        vatAmount: b.steuer ?? w.vatAmount,
        grossAmount: b.brutto ?? w.grossAmount,
        category: b.kategorie ?? w.category,
        extraction: { status: 'ungeprueft', confidence: b.sicherheit, note: b.hinweis },
      })
      setMeldung(
        `Gelesen mit ${b.sicherheit} % Sicherheit — bitte gegen den Beleg prüfen.${
          b.hinweis ? ` Hinweis: ${b.hinweis}` : ''
        }`,
      )
    } catch {
      setMeldung('Der Beleg konnte nicht gelesen werden.')
    } finally {
      setLaeuft(null)
    }
  }

  async function speichern() {
    if (!w.grossAmount || !w.invoiceDate) {
      setMeldung('Bruttobetrag und Rechnungsdatum werden gebraucht.')
      return
    }
    setLaeuft('speichern')
    setMeldung(null)
    try {
      const res = await fetch('/api/office/beleg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...w,
          extraction: w.extraction ? { ...w.extraction, status: 'bestaetigt' } : undefined,
        }),
      })
      const j = await res.json()
      if (!res.ok) {
        setMeldung('Speichern fehlgeschlagen.')
        return
      }
      router.push(`/office/belege/${j.id}`)
      router.refresh()
    } catch {
      setMeldung('Speichern fehlgeschlagen.')
    } finally {
      setLaeuft(null)
    }
  }

  return (
    <div className="buero-karte">
      {!w.documentId ? (
        <label className="buero-feld">
          <span>Beleg fotografieren oder auswählen</span>
          <input
            type="file"
            accept="image/*,application/pdf"
            capture="environment"
            onChange={(e) => {
              const d = e.target.files?.[0]
              if (d) void hochladen(d)
            }}
          />
          <span style={{ marginTop: '.4rem' }}>
            {kiVerfuegbar
              ? 'Nach dem Hochladen wird der Beleg automatisch ausgelesen.'
              : 'Ohne hinterlegten KI-Schlüssel werden die Felder von Hand ausgefüllt.'}
          </span>
        </label>
      ) : (
        <div style={{ marginBottom: '1rem', display: 'flex', gap: '.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {w.documentUrl && (
            <a href={w.documentUrl} target="_blank" rel="noreferrer" className="buero-marker">
              Beleg ansehen
            </a>
          )}
          {kiVerfuegbar && (
            <button
              type="button"
              className="buero-knopf leise"
              disabled={laeuft !== null}
              onClick={() => void auslesen()}
            >
              {laeuft === 'lesen' ? 'liest …' : 'Erneut auslesen'}
            </button>
          )}
          <button
            type="button"
            className="buero-knopf leise"
            disabled={laeuft !== null}
            onClick={() => setzen({ documentId: null, documentUrl: null })}
          >
            Beleg entfernen
          </button>
        </div>
      )}

      {laeuft === 'upload' && <p className="buero-hinweis">Wird hochgeladen …</p>}
      {laeuft === 'lesen' && <p className="buero-hinweis">Beleg wird gelesen …</p>}
      {meldung && <p className="buero-hinweis">{meldung}</p>}

      <label className="buero-feld">
        <span>Bezeichnung</span>
        <input
          value={w.title ?? ''}
          onChange={(e) => setzen({ title: e.target.value })}
          placeholder="z.B. Stahlblech S235"
        />
      </label>

      <div className="buero-reihe">
        <label className="buero-feld">
          <span>Lieferant</span>
          <input
            value={w.supplierName ?? ''}
            onChange={(e) => setzen({ supplierName: e.target.value })}
          />
        </label>
        <label className="buero-feld">
          <span>Rechnungsnummer</span>
          <input
            value={w.invoiceNumber ?? ''}
            onChange={(e) => setzen({ invoiceNumber: e.target.value })}
          />
        </label>
        <label className="buero-feld">
          <span>Rechnungsdatum</span>
          <input
            type="date"
            value={nurTag(w.invoiceDate)}
            onChange={(e) => setzen({ invoiceDate: e.target.value })}
          />
        </label>
        <label className="buero-feld">
          <span>Zahlbar bis</span>
          <input
            type="date"
            value={nurTag(w.dueDate)}
            onChange={(e) => setzen({ dueDate: e.target.value })}
          />
        </label>
      </div>

      <div className="buero-reihe">
        <label className="buero-feld">
          <span>Netto (EUR)</span>
          <input
            inputMode="decimal"
            value={w.netAmount ?? ''}
            onChange={(e) => setzen({ netAmount: zahl(e.target.value) })}
          />
        </label>
        <label className="buero-feld">
          <span>Steuersatz (%)</span>
          <input
            inputMode="decimal"
            value={w.vatRate ?? ''}
            onChange={(e) => setzen({ vatRate: zahl(e.target.value) })}
          />
        </label>
        <label className="buero-feld">
          <span>Steuer (EUR)</span>
          <input
            inputMode="decimal"
            value={w.vatAmount ?? ''}
            onChange={(e) => setzen({ vatAmount: zahl(e.target.value) })}
          />
        </label>
        <label className="buero-feld">
          <span>Brutto (EUR)</span>
          <input
            inputMode="decimal"
            value={w.grossAmount ?? ''}
            onChange={(e) => setzen({ grossAmount: zahl(e.target.value) })}
          />
        </label>
      </div>

      <div className="buero-reihe">
        <label className="buero-feld">
          <span>Kategorie</span>
          <select value={w.category} onChange={(e) => setzen({ category: e.target.value })}>
            {kategorien.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </label>
        <label className="buero-feld">
          <span>Bezahlt per</span>
          <select
            value={w.paymentMethod ?? ''}
            onChange={(e) => setzen({ paymentMethod: e.target.value || null })}
          >
            <option value="">—</option>
            <option value="ueberweisung">Überweisung</option>
            <option value="karte">Karte</option>
            <option value="bar">Bar</option>
            <option value="lastschrift">Lastschrift</option>
            <option value="paypal">PayPal</option>
          </select>
        </label>
      </div>

      <div style={{ display: 'flex', gap: '1.25rem', margin: '.25rem 0 1rem', flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', gap: '.4rem', alignItems: 'center', fontSize: '.88rem' }}>
          <input
            type="checkbox"
            checked={Boolean(w.paid)}
            onChange={(e) => setzen({ paid: e.target.checked })}
          />
          bezahlt
        </label>
        <label style={{ display: 'flex', gap: '.4rem', alignItems: 'center', fontSize: '.88rem' }}>
          <input
            type="checkbox"
            checked={Boolean(w.deductible)}
            onChange={(e) => setzen({ deductible: e.target.checked })}
          />
          steuerlich absetzbar
        </label>
      </div>

      <label className="buero-feld">
        <span>Notiz</span>
        <textarea rows={2} value={w.notes ?? ''} onChange={(e) => setzen({ notes: e.target.value })} />
      </label>

      <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>
        <button type="button" className="buero-knopf" disabled={laeuft !== null} onClick={speichern}>
          {laeuft === 'speichern' ? 'speichert …' : 'Speichern'}
        </button>
        <button
          type="button"
          className="buero-knopf leise"
          onClick={() => router.push('/office/belege')}
        >
          Abbrechen
        </button>
      </div>
    </div>
  )
}
