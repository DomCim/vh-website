'use client'

import { useRouter } from 'next/navigation'
import React, { useMemo, useState } from 'react'

import { VersandKnopf } from './VersandKnopf'
import { useEntwurf } from '../../lib/buero/entwurf'
import { AbsendeFehler, absenden } from '../../lib/buero/warteschlange'
import { EntwurfLeiste } from './EntwurfLeiste'
import { Fussleiste } from './Fussleiste'
import { Zahleingabe } from './Zahleingabe'
import { PartnerBezug, partnerAnschrift } from './PartnerBezug'
import { VerwerfenKnopf } from './VerwerfenKnopf'
import { ArtikelBezug } from './ArtikelBezug'
import { Rueckmeldung } from './Rueckmeldung'

export type Position = {
  description: string
  quantity: number
  unit: string
  unitPrice: number
  vatRate: number
  /** Nur für das Bild auf dem Papier — ändert an keiner Zahl etwas */
  product?: number | '' | null
}

export type RechnungWerte = {
  id?: number | string
  invoiceNumber?: string | null
  status?: string
  /** Verknüpfter Geschäftspartner — füllt Name, Anschrift, SIRET und TVA vor */
  customer?: number | '' | null
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

  /*
   * Ist die Nummer vergeben, sind die Felder zu.
   *
   * Vorher stand hier nur eine Bitte im Hinweis, und jedes Feld blieb offen —
   * ein Klick auf „Speichern" schrieb die gestellte Rechnung um. Das durfte
   * nicht bleiben: Was der Kunde im Ordner hat, muss dem entsprechen, was
   * hier liegt, sonst gibt es zwei Papiere unter einer Nummer.
   *
   * Gesperrt wird alles, was auf dem Blatt steht — Beträge und Positionen
   * ebenso wie der Hinweis, denn der wird mitgedruckt. Was danach noch geht,
   * geht über eigene Wege: „Als bezahlt markieren", Verschicken und
   * Stornieren. Der Server weist eine Änderung zusätzlich ab
   * (api/office/rechnung), damit die Sperre nicht bloß Anzeige ist.
   */
  const gesperrt = festgeschrieben

  const setzen = (teil: Partial<RechnungWerte>) => setW((v) => ({ ...v, ...teil }))

  /*
   * Die E-Rechnungs-Felder brauchen nur Geschäftskunden — bei Privatkundschaft
   * standen sie trotzdem als Dauerblock im Formular. Eingeklappt, solange
   * nichts davon gesetzt ist; ein Partner mit SIRET oder TVA klappt sie auf.
   */
  const [eRechnungOffen, setERechnungOffen] = useState<boolean>(() =>
    Boolean(
      anfang.customerSiret ||
        anfang.customerVatId ||
        anfang.buyerReference ||
        anfang.deliveryDate ||
        anfang.deliveryAddress ||
        (anfang.businessType && anfang.businessType !== 'lieferung'),
    ),
  )

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
    } catch (err) {
      /*
       * „Speichern fehlgeschlagen" war hier zu wenig, und das hat sich
       * sofort gerächt.
       *
       * Vincent hat eine gestellte Rechnung geöffnet, den Kunden geändert und
       * gespeichert. Der Server wies das ab — richtig so, sie liegt beim
       * Kunden. Am Bildschirm stand aber nur, es sei fehlgeschlagen, also
       * klang es wie ein Fehler der Anwendung: „hatte nochmal den Kunden
       * angepasst aber das wurde nicht übernommen, ich leg den nochmal neu an
       * dann oder?"
       *
       * Genau das darf nicht passieren. Eine zweite Rechnung für dieselbe
       * Leistung bekommt eine zweite Nummer, und die erste bleibt gültig im
       * Raum stehen — aus einer sauberen Sperre wird so ein doppeltes Papier.
       * Deshalb sagt die Meldung jetzt, was los ist **und** welcher Weg zum
       * Ziel führt.
       */
      if (err instanceof AbsendeFehler && err.daten?.error === 'schon-gestellt') {
        setMeldung(
          'Diese Rechnung ist gestellt und liegt beim Kunden — sie lässt sich nicht mehr ändern. ' +
            'Für eine Korrektur oben auf „Stornieren“ tippen: Das legt die Gegenrechnung an, ' +
            'danach eine neue mit den richtigen Angaben. Bitte keine zweite von Hand anlegen — ' +
            'sonst stehen zwei gültige Rechnungen für dieselbe Leistung im Raum.',
        )
        return
      }
      setMeldung('Speichern fehlgeschlagen.')
    } finally {
      setLaeuft(false)
    }
  }

  /**
   * Bezahlt melden — auf dem schmalen Weg.
   *
   * Der volle Datensatz darf hier nicht mehr durch: Eine gestellte Rechnung
   * weist der Server ab, und das ist richtig so. Eine eingegangene Zahlung
   * ändert die Rechnung aber nicht — sie stellt nur fest, dass das Geld da
   * ist. Deshalb dieselbe Aktion, die auch die Zahlungsliste benutzt: Es wird
   * genau das gesetzt, worum es geht.
   */
  async function bezahltMelden() {
    setLaeuft(true)
    setMeldung(null)
    try {
      await absenden({
        pfad: '/api/office/rechnung',
        bereich: 'rechnungen',
        koerper: { aktion: 'bezahlt', id: w.id, paidDate: new Date().toISOString() },
      })
      setzen({ status: 'bezahlt' })
      setMeldung('Als bezahlt vermerkt.')
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
      {/* Der Satz nur, solange es die Rechnung noch gibt: Auf einer bereits
          stornierten steht oben kein „Stornieren" mehr, und ein Hinweis auf
          einen Knopf, den es nicht gibt, schickt Leute suchen. */}
      {festgeschrieben && w.status !== 'storniert' && (
        <p className="buero-hinweis">
          Rechnung <strong>{w.invoiceNumber}</strong> ist gestellt und liegt beim Kunden — die
          Felder sind deshalb zu. Für eine Korrektur oben auf „Stornieren“ tippen; das legt die
          Gegenrechnung mit Verweis auf diese hier an.
        </p>
      )}
      <Rueckmeldung text={meldung} />

      <div className="buero-reihe">
        <PartnerBezug
          wert={w.customer}
          gesperrt={gesperrt}
          aendern={(id, partner) => {
            // Auswählen heißt übernehmen — wer abweichen will, tippt danach
            setzen({
              customer: id,
              ...(partner
                ? {
                    customerName: partner.name ?? '',
                    customerAddress: partnerAnschrift(partner),
                    customerSiret: partner.siret ?? '',
                    customerVatId: partner.vatId ?? '',
                  }
                : {}),
            })
            if (partner?.siret || partner?.vatId) setERechnungOffen(true)
          }}
        />
        <label className="buero-feld">
          <span>Kunde</span>
          <input
            value={w.customerName ?? ''}
            disabled={gesperrt}
            onChange={(e) => setzen({ customerName: e.target.value })}
            placeholder="z.B. Stadt Naila"
          />
        </label>
        <label className="buero-feld">
          <span>Rechnungsdatum</span>
          <input
            type="date"
            value={nurTag(w.issueDate)}
            disabled={gesperrt}
            onChange={(e) => setzen({ issueDate: e.target.value })}
          />
        </label>
        <label className="buero-feld">
          <span>Fällig am</span>
          <input
            type="date"
            value={nurTag(w.dueDate)}
            disabled={gesperrt}
            onChange={(e) => setzen({ dueDate: e.target.value })}
          />
        </label>
      </div>

      <label className="buero-feld">
        <span>Rechnungsanschrift</span>
        <textarea
          rows={3}
          value={w.customerAddress ?? ''}
          disabled={gesperrt}
          onChange={(e) => setzen({ customerAddress: e.target.value })}
          placeholder={'Straße 1\n12345 Ort\nFrankreich'}
        />
      </label>

      {/* Angaben für die elektronische Rechnung. Bei Privatkundschaft bleiben
          sie leer — dort verlangt sie niemand, also bleiben sie eingeklappt. */}
      <h2 style={{ marginTop: '1.5rem' }}>Elektronische Rechnung</h2>
      {!eRechnungOffen && (
        <p className="buero-unterzeile" style={{ marginTop: '-.4rem' }}>
          Bei Privatkundschaft bleibt hier alles leer.{' '}
          <button
            type="button"
            className="buero-knopf leise schmal"
            onClick={() => setERechnungOffen(true)}
          >
            Geschäftskunde — Felder zeigen
          </button>
        </p>
      )}
      {eRechnungOffen && (
        <>
      <p className="buero-unterzeile" style={{ marginTop: '-.4rem' }}>
        Bei Geschäftskunden gehört die Kennung des Empfängers dazu, sonst weist die Plattform die
        Rechnung ab.
      </p>
      <div className="buero-reihe">
        <label className="buero-feld">
          <span>SIRET/SIREN des Kunden</span>
          <input
            value={w.customerSiret ?? ''}
            disabled={gesperrt}
            onChange={(e) => setzen({ customerSiret: e.target.value })}
            placeholder="14-stellig"
          />
        </label>
        <label className="buero-feld">
          <span>TVA-Nummer des Kunden</span>
          <input
            value={w.customerVatId ?? ''}
            disabled={gesperrt}
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
            disabled={gesperrt}
            onChange={(e) => setzen({ buyerReference: e.target.value })}
            placeholder="Aktenzeichen, Vergabenummer …"
          />
        </label>
        <label className="buero-feld">
          <span>Liefer-/Leistungsdatum</span>
          <input
            type="date"
            value={nurTag(w.deliveryDate)}
            disabled={gesperrt}
            onChange={(e) => setzen({ deliveryDate: e.target.value })}
          />
        </label>
        <label className="buero-feld">
          <span>Art des Geschäfts</span>
          <select
            value={w.businessType ?? 'lieferung'}
            disabled={gesperrt}
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
          disabled={gesperrt}
          onChange={(e) => setzen({ deliveryAddress: e.target.value })}
          placeholder="nur wenn woandershin geliefert wurde"
        />
      </label>
        </>
      )}

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
              disabled={gesperrt}
              onChange={(e) => setzePosition(i, { description: e.target.value })}
              placeholder="z.B. Sitzbank Cortenstahl, 2,00 m, nach Zeichnung"
            />
          </label>
          <ArtikelBezug
            wert={p.product ?? ''}
            gesperrt={gesperrt}
            aendern={(id) => setzePosition(i, { product: id || undefined })}
          />
          <div className="buero-reihe">
            <label className="buero-feld">
              <span>Menge</span>
              <Zahleingabe
                wert={p.quantity}
                beiLeer={0}
                disabled={gesperrt}
                aendern={(v) => setzePosition(i, { quantity: v ?? 0 })}
              />
            </label>
            <label className="buero-feld">
              <span>Einheit</span>
              <input
                value={p.unit}
                disabled={gesperrt}
                onChange={(e) => setzePosition(i, { unit: e.target.value })}
              />
            </label>
            <label className="buero-feld">
              <span>Einzelpreis netto</span>
              <Zahleingabe
                wert={p.unitPrice}
                beiLeer={0}
                disabled={gesperrt}
                aendern={(v) => setzePosition(i, { unitPrice: v ?? 0 })}
              />
            </label>
            <label className="buero-feld">
              <span>Steuersatz (%)</span>
              <Zahleingabe
                wert={p.vatRate}
                beiLeer={0}
                disabled={gesperrt}
                aendern={(v) => setzePosition(i, { vatRate: v ?? 0 })}
              />
            </label>
          </div>
          {!gesperrt && (w.items ?? []).length > 1 && (
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

      {!gesperrt && (
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
      )}

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
          disabled={gesperrt}
          onChange={(e) => setzen({ reverseCharge: e.target.checked })}
        />
        Reverse Charge (Geschäftskunde im EU-Ausland, ohne Steuer)
      </label>

      <label className="buero-feld">
        <span>Hinweis auf der Rechnung</span>
        {/* Mitgesperrt, weil er auf dem Blatt steht: Was der Kunde liest,
            gehört zum festgeschriebenen Dokument. */}
        <textarea
          rows={2}
          value={w.note ?? ''}
          disabled={gesperrt}
          onChange={(e) => setzen({ note: e.target.value })}
        />
      </label>

      {/*
       * Genau eine Hauptsache, und sie steht zuletzt — am Handy heißt das:
       * unten und über die volle Breite. Solange die Rechnung ein Entwurf
       * ist, ist das Festschreiben die Hauptsache; danach das Verschicken.
       * „Als bezahlt markieren" kommt Tage später und ist deshalb zweite
       * Reihe, auch wenn es dann der nächste Schritt ist.
       */}
      <Fussleiste>
        {/* „Speichern" war der Weg, über den eine gestellte Rechnung doch noch
            geändert werden konnte — ein Klick, und das Papier beim Kunden
            stimmte nicht mehr mit dem hier überein. Danach gibt es nur noch
            Storno, Verschicken und „bezahlt". */}
        {!gesperrt && (
          <button
            type="button"
            className="buero-knopf leise"
            disabled={laeuft}
            onClick={() => void speichern()}
          >
            Speichern
          </button>
        )}
        {festgeschrieben && (
          <a
            className="buero-knopf leise"
            href={`/api/office/rechnung/${w.id}/pdf`}
            target="_blank"
            rel="noreferrer"
          >
            PDF ansehen
          </a>
        )}
        {festgeschrieben && w.status !== 'bezahlt' && w.status !== 'storniert' && (
          <button
            type="button"
            className="buero-knopf leise"
            disabled={laeuft}
            onClick={() => void bezahltMelden()}
          >
            Als bezahlt markieren
          </button>
        )}
        {!festgeschrieben && w.id && (
          <VerwerfenKnopf
            pfad="/api/office/rechnung"
            id={w.id}
            ziel="/office/rechnungen"
            was="Rechnungsentwurf"
          />
        )}
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
        {festgeschrieben && w.id && <VersandKnopf art="rechnung" id={w.id} />}
      </Fussleiste>
    </div>
  )
}
