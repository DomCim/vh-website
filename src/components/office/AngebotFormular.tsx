'use client'

import { useRouter } from 'next/navigation'
import React, { useMemo, useState } from 'react'

import { betraege } from '../../lib/betraege'
import { VersandKnopf } from './VersandKnopf'
import { useEntwurf } from '../../lib/buero/entwurf'
import { AbsendeFehler, absenden } from '../../lib/buero/warteschlange'
import { EntwurfLeiste } from './EntwurfLeiste'
import { Fussleiste } from './Fussleiste'
import { Zahleingabe } from './Zahleingabe'
import { ArtikelBezug } from './ArtikelBezug'
import { PartnerBezug, partnerAnschrift } from './PartnerBezug'
import { VerwerfenKnopf } from './VerwerfenKnopf'
import { Rueckmeldung } from './Rueckmeldung'

export type AngebotPosition = {
  description: string
  quantity: number
  unit: string
  unitPrice: number
  vatRate: number
  /** Nur für das Bild auf dem Papier — ändert an keiner Zahl etwas */
  product?: number | '' | null
}

export type AngebotWerte = {
  id?: number | string
  quoteNumber?: string | null
  status?: string
  title?: string | null
  /** Verknüpfter Geschäftspartner — füllt Name und Anschrift vor */
  customer?: number | '' | null
  /** Die Anfrage, aus der dieses Angebot entstand — daran hängt der Zahlplan */
  inquiry?: number | null
  customerName?: string | null
  customerAddress?: string | null
  issueDate?: string | null
  validUntil?: string | null
  productionTime?: string | null
  items?: AngebotPosition[]
  note?: string | null
  discountKind?: string | null
  discountValue?: number | null
  discountReason?: string | null
  revision?: number | null
}

const nurTag = (v?: string | null) => (v ? String(v).slice(0, 10) : '')
const euro = (v: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v)

/**
 * Angebot schreiben und weiterreichen.
 *
 * Angenommen? Ein Klick macht daraus einen Fertigungsauftrag, ein zweiter
 * später die Rechnung — ohne die Positionen ein zweites Mal einzutippen.
 */
export function AngebotFormular({ werte }: { werte: AngebotWerte }) {
  const router = useRouter()
  const [anfang] = useState<AngebotWerte>(() => ({
    status: 'entwurf',
    items: [{ description: '', quantity: 1, unit: 'Stück', unitPrice: 0, vatRate: 20 }],
    ...werte,
  }))
  const [w, setW] = useState<AngebotWerte>(anfang)

  // Angefangenes überlebt den Gerätewechsel — siehe lib/buero/entwurf.ts
  const entwurf = useEntwurf(`angebote:${werte.id ?? 'neu'}`, w, anfang)
  const [laeuft, setLaeuft] = useState(false)
  const [meldung, setMeldung] = useState<string | null>(null)

  const versendet = Boolean(w.quoteNumber)
  const setzen = (teil: Partial<AngebotWerte>) => setW((v) => ({ ...v, ...teil }))
  const setzePosition = (i: number, teil: Partial<AngebotPosition>) =>
    setW((v) => ({
      ...v,
      items: (v.items ?? []).map((p, idx) => (idx === i ? { ...p, ...teil } : p)),
    }))

  const summen = useMemo(
    () =>
      betraege(w.items ?? [], { discountKind: w.discountKind, discountValue: w.discountValue }),
    [w.items, w.discountKind, w.discountValue],
  )

  async function senden(rumpf: Record<string, unknown>) {
    setLaeuft(true)
    setMeldung(null)
    try {
      const { id, sofort, antwort } = await absenden({
        pfad: '/api/office/angebot',
        bereich: 'angebote',
        koerper: rumpf,
      })
      entwurf.erledigt()
      if (!sofort) setMeldung('Gemerkt — geht raus, sobald wieder Netz da ist.')
      // Die Antwort mitgeben: Aus einem angenommenen Angebot entstehen Auftrag
      // und Rechnung, und deren Kennungen vergibt nur der Server.
      return { ...(antwort ?? {}), id } as { id: string | number } & Record<string, unknown>
    } catch (err) {
      /*
       * „Schon vorhanden" ist kein Fehler, sondern eine Wegbeschreibung:
       * Aus diesem Angebot ist längst ein Auftrag oder eine Rechnung
       * entstanden — der zweite Klick führt dorthin, statt zu schimpfen
       * (oder, schlimmer, ein zweites Exemplar anzulegen).
       */
      if (err instanceof AbsendeFehler && err.daten?.error === 'schon-vorhanden') {
        const ziel = err.daten.auftragId
          ? `/office/auftraege/${err.daten.auftragId}`
          : err.daten.rechnungId
            ? `/office/rechnungen/${err.daten.rechnungId}`
            : null
        if (ziel) {
          router.push(ziel)
          return null
        }
      }
      setMeldung('Das hat nicht geklappt.')
      return null
    } finally {
      setLaeuft(false)
    }
  }

  async function speichern(neuerStatus?: string) {
    if (!w.customerName?.trim()) {
      setMeldung('Ein Kundenname wird gebraucht.')
      return
    }
    const j = await senden({ ...w, status: neuerStatus ?? w.status })
    // Ohne Netz ist die Kennung nur vorläufig — dann bleibt man, wo man ist
    if (j?.id && !String(j.id).startsWith('neu:')) router.push(`/office/angebote/${j.id}`)
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
      {versendet && (
        <p className="buero-hinweis">
          Angebot <strong>{w.quoteNumber}</strong> ist versendet
          {(w.revision ?? 1) > 1 ? ` — Fassung ${w.revision}` : ''}. Nachverhandeln ist möglich:
          Positionen oder Nachlass ändern und speichern. Die Nummer bleibt, die Fassung zählt hoch.
        </p>
      )}
      <Rueckmeldung text={meldung} />

      <label className="buero-feld">
        <span>Bezeichnung</span>
        <input
          value={w.title ?? ''}
          onChange={(e) => setzen({ title: e.target.value })}
          placeholder="z.B. Sitzbänke Rathausplatz"
        />
      </label>

      <div className="buero-reihe">
        <PartnerBezug
          wert={w.customer}
          aendern={(id, partner) =>
            // Auswählen heißt übernehmen — wer abweichen will, tippt danach
            setzen({
              customer: id,
              ...(partner
                ? { customerName: partner.name ?? '', customerAddress: partnerAnschrift(partner) }
                : {}),
            })
          }
        />
        <label className="buero-feld">
          <span>Kunde</span>
          <input
            value={w.customerName ?? ''}
            onChange={(e) => setzen({ customerName: e.target.value })}
          />
        </label>
        <label className="buero-feld">
          <span>Angebotsdatum</span>
          <input
            type="date"
            value={nurTag(w.issueDate)}
            onChange={(e) => setzen({ issueDate: e.target.value })}
          />
        </label>
        <label className="buero-feld">
          <span>Gültig bis</span>
          <input
            type="date"
            value={nurTag(w.validUntil)}
            onChange={(e) => setzen({ validUntil: e.target.value })}
          />
        </label>
      </div>

      <div className="buero-reihe">
        <label className="buero-feld">
          <span>Zugesagte Fertigungszeit</span>
          <input
            value={w.productionTime ?? ''}
            onChange={(e) => setzen({ productionTime: e.target.value })}
            placeholder="z.B. 6–8 Wochen ab Auftrag"
          />
        </label>
      </div>

      <label className="buero-feld">
        <span>Anschrift</span>
        <textarea
          rows={3}
          value={w.customerAddress ?? ''}
          onChange={(e) => setzen({ customerAddress: e.target.value })}
        />
      </label>

      <h2>Positionen</h2>
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
            />
          </label>
          <ArtikelBezug
            wert={p.product ?? ''}
            aendern={(id) => setzePosition(i, { product: id || undefined })}
          />
          <div className="buero-reihe">
            <label className="buero-feld">
              <span>Menge</span>
              <Zahleingabe
                wert={p.quantity}
                beiLeer={0}
                aendern={(v) => setzePosition(i, { quantity: v ?? 0 })}
              />
            </label>
            <label className="buero-feld">
              <span>Einheit</span>
              <input value={p.unit} onChange={(e) => setzePosition(i, { unit: e.target.value })} />
            </label>
            <label className="buero-feld">
              <span>Einzelpreis netto</span>
              <Zahleingabe
                wert={p.unitPrice}
                beiLeer={0}
                aendern={(v) => setzePosition(i, { unitPrice: v ?? 0 })}
              />
            </label>
            <label className="buero-feld">
              <span>Steuersatz (%)</span>
              <Zahleingabe
                wert={p.vatRate}
                beiLeer={0}
                aendern={(v) => setzePosition(i, { vatRate: v ?? 0 })}
              />
            </label>
          </div>
          {(w.items ?? []).length > 1 && (
            <button
              type="button"
              className="buero-knopf stumm"
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

      <h2>Nachlass</h2>
      <div className="buero-reihe">
        <label className="buero-feld">
          <span>Art</span>
          <select
            value={w.discountKind ?? 'kein'}
            onChange={(e) => setzen({ discountKind: e.target.value })}
          >
            <option value="kein">Kein Nachlass</option>
            <option value="prozent">Prozent</option>
            <option value="betrag">Fester Betrag</option>
          </select>
        </label>
        {w.discountKind && w.discountKind !== 'kein' && (
          <>
            <label className="buero-feld">
              <span>{w.discountKind === 'prozent' ? 'Prozent' : 'Betrag (EUR)'}</span>
              <Zahleingabe
                wert={w.discountValue}
                aendern={(v) => setzen({ discountValue: v })}
              />
            </label>
            <label className="buero-feld">
              <span>Begründung</span>
              <input
                value={w.discountReason ?? ''}
                onChange={(e) => setzen({ discountReason: e.target.value })}
                placeholder="z.B. Projektnachlass"
              />
            </label>
          </>
        )}
      </div>

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
          <span className="buero-betrag">{euro(summen.subtotal)}</span>
        </div>
        {summen.discountTotal > 0 && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--buero-tinte-leise)' }}>
                {w.discountReason?.trim() || 'Nachlass'}
              </span>
              <span className="buero-betrag">− {euro(summen.discountTotal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--buero-tinte-leise)' }}>Netto nach Nachlass</span>
              <span className="buero-betrag">{euro(summen.netTotal)}</span>
            </div>
          </>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--buero-tinte-leise)' }}>Steuer</span>
          <span className="buero-betrag">{euro(summen.vatTotal)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
          <span>Gesamt</span>
          <span className="buero-betrag">{euro(summen.total)}</span>
        </div>
      </div>

      <label className="buero-feld" style={{ marginTop: '1rem' }}>
        <span>Hinweis auf dem Angebot</span>
        <textarea rows={2} value={w.note ?? ''} onChange={(e) => setzen({ note: e.target.value })} />
      </label>

      {/*
       * Die Hauptsache wandert mit dem Stand des Angebots: erst verschicken,
       * dann „Angenommen", dann den Auftrag daraus anlegen. Nur eine davon
       * ist je sichtbar, und sie steht immer zuletzt.
       */}
      <Fussleiste>
        <button type="button" className="buero-knopf leise" disabled={laeuft} onClick={() => void speichern()}>
          Speichern
        </button>
        {versendet && (
          <a className="buero-knopf leise" href={`/api/office/angebot/${w.id}/pdf`} target="_blank" rel="noreferrer">
            PDF ansehen
          </a>
        )}
        {versendet && w.id && <VersandKnopf art="angebot" id={w.id} leise />}
        {!versendet && w.id && (
          <VerwerfenKnopf
            pfad="/api/office/angebot"
            id={w.id}
            ziel="/office/angebote"
            was="Angebotsentwurf"
          />
        )}
        {/*
         * Verlorene Angebote brauchen ein Ende: Ohne „Abgelehnt" blieb der
         * Stand „versendet" stehen, und das Nachfassen erinnerte ewig weiter.
         */}
        {versendet && w.status !== 'angenommen' && w.status !== 'abgelehnt' && (
          <button
            type="button"
            className="buero-knopf leise"
            disabled={laeuft}
            onClick={() => void speichern('abgelehnt')}
          >
            Abgelehnt
          </button>
        )}
        {w.status === 'angenommen' && (
          <button
            type="button"
            className="buero-knopf leise"
            disabled={laeuft}
            onClick={async () => {
              const j = await senden({ aktion: 'in-rechnung', id: w.id })
              if (j?.rechnungId) router.push(`/office/rechnungen/${j.rechnungId}`)
            }}
          >
            Rechnung daraus
          </button>
        )}
        {!versendet && (
          <button type="button" className="buero-knopf" disabled={laeuft} onClick={() => void speichern('versendet')}>
            Versenden &amp; Nummer vergeben
          </button>
        )}
        {versendet && w.status !== 'angenommen' && (
          <button type="button" className="buero-knopf" disabled={laeuft} onClick={() => void speichern('angenommen')}>
            Angenommen
          </button>
        )}
        {w.status === 'angenommen' && (
          <button
            type="button"
            className="buero-knopf"
            disabled={laeuft}
            onClick={async () => {
              const j = await senden({ aktion: 'in-auftrag', id: w.id })
              if (j?.auftragId) router.push(`/office/auftraege/${j.auftragId}`)
            }}
          >
            Auftrag anlegen
          </button>
        )}
      </Fussleiste>
    </div>
  )
}
