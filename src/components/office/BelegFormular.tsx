'use client'

import { useRouter } from 'next/navigation'
import React, { useState } from 'react'
import { useEntwurf } from '../../lib/buero/entwurf'
import { AbsendeFehler, absenden } from '../../lib/buero/warteschlange'
import { EntwurfLeiste } from './EntwurfLeiste'
import { Fussleiste } from './Fussleiste'
import { Zahleingabe } from './Zahleingabe'

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
  turnus?: string | null
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
  const [anfang] = useState<BelegWerte>(() => ({
    category: 'sonstiges',
    paid: true,
    deductible: true,
    ...werte,
  }))
  const [w, setW] = useState<BelegWerte>(anfang)

  // Angefangenes überlebt den Gerätewechsel — siehe lib/buero/entwurf.ts
  const entwurf = useEntwurf(`belege:${werte.id ?? 'neu'}`, w, anfang)
  const [laeuft, setLaeuft] = useState<null | 'upload' | 'lesen' | 'speichern' | 'loeschen'>(null)
  const [meldung, setMeldung] = useState<string | null>(null)

  const setzen = (teil: Partial<BelegWerte>) => setW((v) => ({ ...v, ...teil }))

  async function hochladen(datei: File) {
    setLaeuft('upload')
    setMeldung(null)
    try {
      // Ohne Netz bleibt das Foto im Gerät und geht später raus. Genau dafür
      // ist die Werkstatt der Anlass: Dort wird fotografiert, nicht am Schreibtisch.
      // Solange der Server das Bild nicht hat, zeigt die Seite es aus dem Gerät
      const ausDemGeraet = URL.createObjectURL(datei)

      const { id, sofort, antwort } = await absenden({
        pfad: '/api/office/beleg-upload',
        bereich: 'medien',
        koerper: {},
        datei: { name: datei.name, blob: datei },
        vorschau: { url: ausDemGeraet },
      })

      setzen({
        documentId: id as number,
        documentUrl: (antwort?.url as string) ?? ausDemGeraet,
      })

      if (!sofort) {
        setMeldung('Beleg liegt im Gerät — er geht raus, sobald wieder Netz da ist.')
        return
      }

      // Immer versuchen: Eine elektronische Rechnung liest sich auch ohne
      // hinterlegten KI-Schlüssel, weil die Daten im PDF stehen.
      await auslesen(id as number)
    } catch (err) {
      setMeldung(
        err instanceof AbsendeFehler && err.daten?.error === 'zu-gross'
          ? 'Die Datei ist zu groß (max. 25 MB).'
          : 'Upload fehlgeschlagen.',
      )
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
            ? 'Keine elektronische Rechnung im PDF und kein KI-Schlüssel hinterlegt — Felder bitte von Hand ausfüllen.'
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
        j.quelle === 'factur-x'
          ? `Elektronische Rechnung erkannt — die Werte kommen unverändert aus dem Beleg.${
              b.hinweis ? ` ${b.hinweis}` : ''
            } Nur die Kategorie muss noch stimmen.`
          : `Gelesen mit ${b.sicherheit} % Sicherheit — bitte gegen den Beleg prüfen.${
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
    // 0,00 € ist erlaubt — nur ganz ohne Betrag geht es nicht
    if (w.grossAmount == null || !w.invoiceDate) {
      setMeldung('Bruttobetrag und Rechnungsdatum werden gebraucht.')
      return
    }
    setLaeuft('speichern')
    setMeldung(null)
    try {
      const { id, sofort } = await absenden({
        pfad: '/api/office/beleg',
        bereich: 'belege',
        koerper: {
          ...w,
          extraction: w.extraction ? { ...w.extraction, status: 'bestaetigt' } : undefined,
        },
        vorschau: {
          ...w,
          document: w.documentId ?? null,
          extraction: w.extraction ? { ...w.extraction, status: 'bestaetigt' } : undefined,
        },
      })
      entwurf.erledigt()
      if (sofort) router.push(`/office/belege/${id}`)
      else setMeldung('Gemerkt — geht raus, sobald wieder Netz da ist.')
    } catch {
      setMeldung('Speichern fehlgeschlagen.')
    } finally {
      setLaeuft(null)
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
              ? 'Nach dem Hochladen liest sich der Beleg selbst: Steckt eine elektronische Rechnung im PDF, kommen die Werte von dort — sonst schaut Claude sich den Beleg an.'
              : 'Ohne hinterlegten KI-Schlüssel werden nur elektronische Rechnungen ausgelesen, alles andere von Hand ausgefüllt.'}
          </span>
        </label>
      ) : (
        <div style={{ marginBottom: '1rem', display: 'flex', gap: '.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {w.documentUrl && (
            <a href={w.documentUrl} target="_blank" rel="noreferrer" className="buero-marker">
              Beleg ansehen
            </a>
          )}
          <button
            type="button"
            className="buero-knopf leise"
            disabled={laeuft !== null}
            onClick={() => void auslesen()}
          >
            {laeuft === 'lesen' ? 'liest …' : 'Erneut auslesen'}
          </button>
          <button
            type="button"
            className="buero-knopf stumm"
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
          <Zahleingabe
            wert={w.netAmount}
            aendern={(v) => setzen({ netAmount: v })}
          />
        </label>
        <label className="buero-feld">
          <span>Steuersatz (%)</span>
          <Zahleingabe
            wert={w.vatRate}
            aendern={(v) => setzen({ vatRate: v })}
          />
        </label>
        <label className="buero-feld">
          <span>Steuer (EUR)</span>
          <Zahleingabe
            wert={w.vatAmount}
            aendern={(v) => setzen({ vatAmount: v })}
          />
        </label>
        <label className="buero-feld">
          <span>Brutto (EUR)</span>
          <Zahleingabe
            wert={w.grossAmount}
            aendern={(v) => setzen({ grossAmount: v })}
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
        <label className="buero-feld">
          <span>Wiederkehrend</span>
          {/* Miete, Internet & Co.: Der Folgebeleg entsteht zum Termin von
              selbst — nur der Scan der neuen Rechnung ist nachzureichen. */}
          <select
            value={w.turnus ?? 'nein'}
            onChange={(e) => setzen({ turnus: e.target.value })}
          >
            <option value="nein">Einmalig</option>
            <option value="monatlich">Monatlich</option>
            <option value="vierteljaehrlich">Vierteljährlich</option>
            <option value="jaehrlich">Jährlich</option>
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

      <Fussleiste>
        <button
          type="button"
          className="buero-knopf leise"
          onClick={() => router.push('/office/belege')}
        >
          Abbrechen
        </button>
        <button type="button" className="buero-knopf" disabled={laeuft !== null} onClick={speichern}>
          {laeuft === 'speichern' ? 'speichert …' : 'Speichern'}
        </button>
      </Fussleiste>
    </div>
  )
}
