'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { useMemo, useRef, useState } from 'react'
import { useBestand } from '../../lib/buero/bestand'
import { useEntwurf } from '../../lib/buero/entwurf'
import { AbsendeFehler, absenden } from '../../lib/buero/warteschlange'
import { doppelgaenger, naechsterPosten } from '../../lib/inventarerfassung'
import { EntwurfLeiste } from './EntwurfLeiste'
import { Fussleiste } from './Fussleiste'
import { LieferantFeld } from './LieferantFeld'
import { Zahleingabe } from './Zahleingabe'
import { Rueckmeldung } from './Rueckmeldung'

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
  /** Ohne Netz eine vorläufige Kennung (`neu:…`) — siehe LieferantFeld */
  supplier?: number | string | '' | null
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
export function InventarFormular({ werte }: { werte: InventarWerte }) {
  const router = useRouter()
  const [anfang] = useState<InventarWerte>(() => ({
    type: 'material',
    unit: 'Stück',
    quantity: 0,
    ...werte,
  }))
  const [w, setW] = useState<InventarWerte>(anfang)
  const nameFeld = useRef<HTMLInputElement>(null)

  // Angefangenes überlebt den Gerätewechsel — siehe lib/buero/entwurf.ts
  const entwurf = useEntwurf(`inventar:${werte.id ?? 'neu'}`, w, anfang)
  const [laeuft, setLaeuft] = useState(false)
  const [meldung, setMeldung] = useState<string | null>(null)
  const [angelegt, setAngelegt] = useState(0)

  const setzen = (teil: Partial<InventarWerte>) => setW((v) => ({ ...v, ...teil }))

  /** Ein neuer Posten ist es, solange das Formular nicht auf einem vorhandenen sitzt */
  const neu = !werte.id

  /*
   * Gibt es diese Bezeichnung schon? Geprüft bei jedem Tastendruck gegen den
   * Bestand im Gerät — der kennt auch, was in dieser Runde gerade angelegt
   * wurde. Das ist die Sperre, die es erlaubt, die Bezeichnung nach
   * „& nächster" stehen zu lassen: Solange sie unverändert dasteht, zeigt das
   * Feld den vorhandenen Posten und der Knopf legt nichts an.
   */
  const alle = useBestand<{ id: number | string; name?: string | null }>('inventar')
  const doppelt = useMemo(() => doppelgaenger(w.name, alle, werte.id), [w.name, alle, werte.id])

  async function speichern(weiter = false) {
    const bezeichnung = w.name?.trim()
    if (!bezeichnung) {
      setMeldung('Eine Bezeichnung wird gebraucht.')
      nameFeld.current?.focus()
      return
    }
    if (doppelt) {
      setMeldung(`„${bezeichnung}" gibt es schon — die Bezeichnung muss sich unterscheiden.`)
      nameFeld.current?.select()
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

      if (weiter) {
        /*
         * Kein Sprung auf die Detailseite: Wer „& nächster" drückt, will
         * weitertippen und nicht erst zurücknavigieren. Übernommen wird nur,
         * was sich zwischen zwei Posten derselben Kiste nicht ändert — die
         * Bezeichnung eingeschlossen, und zwar markiert: Der nächste
         * Tastendruck ersetzt sie, ein Klick ans Ende ändert nur die Größe.
         */
        const gezaehlt = angelegt + 1
        setW(naechsterPosten(w))
        setAngelegt(gezaehlt)
        setMeldung(
          `${bezeichnung} ist angelegt${sofort ? '' : ' und geht raus, sobald wieder Netz da ist'} — ` +
            `${gezaehlt} in dieser Runde.`,
        )
        nameFeld.current?.select()
        return
      }

      if (neu && sofort) router.push(`/office/inventar/${id}`)
      else setMeldung(sofort ? 'Gespeichert.' : 'Gemerkt — geht raus, sobald wieder Netz da ist.')
    } catch (err) {
      // Der Server hat einen Posten gleichen Namens, den das Gerät noch nicht
      // kannte — etwa von einem zweiten Gerät, das seit dem letzten Abgleich
      // etwas angelegt hat.
      if (err instanceof AbsendeFehler && err.daten?.error === 'doppelt') {
        setMeldung(`„${bezeichnung}" gibt es schon — die Bezeichnung muss sich unterscheiden.`)
        nameFeld.current?.select()
        return
      }
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
      <Rueckmeldung text={meldung} />

      <label className="buero-feld">
        <span>Bezeichnung</span>
        <input
          ref={nameFeld}
          value={w.name ?? ''}
          aria-invalid={doppelt ? true : undefined}
          onChange={(e) => setzen({ name: e.target.value })}
        />
        {doppelt && (
          <span className="buero-feld-hinweis" role="status">
            Gibt es schon
            {typeof doppelt.id === 'number' ? (
              <>
                {' '}
                — <Link href={`/office/inventar/${doppelt.id}`}>zum vorhandenen Posten</Link>
              </>
            ) : (
              ' — gerade angelegt, noch nicht beim Server'
            )}
            . Zum Speichern muss sich die Bezeichnung unterscheiden.
          </span>
        )}
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
          <Zahleingabe
            wert={w.quantity}
            beiLeer={0}
            aendern={(v) => setzen({ quantity: v ?? 0 })}
          />
        </label>
        <label className="buero-feld">
          <span>Einheit</span>
          <input value={w.unit ?? ''} onChange={(e) => setzen({ unit: e.target.value })} />
        </label>
        <label className="buero-feld">
          <span>Mindestbestand</span>
          {/* Geleert heißt „kein Mindestbestand" — nicht „Mindestbestand null" */}
          <Zahleingabe wert={w.minQuantity} aendern={(v) => setzen({ minQuantity: v })} />
          <span style={{ marginTop: '.4rem' }}>
            Darunter meldet sich das Büro und der Posten steht unter „Nachbestellen“.
          </span>
        </label>
      </div>

      <div className="buero-reihe">
        <label className="buero-feld">
          <span>Nachbestellmenge</span>
          <Zahleingabe
            wert={w.orderQuantity}
            aendern={(v) => setzen({ orderQuantity: v })}
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
          <Zahleingabe wert={w.unitValue} aendern={(v) => setzen({ unitValue: v })} />
        </label>
        <label className="buero-feld">
          <span>Lagerort</span>
          <input value={w.location ?? ''} onChange={(e) => setzen({ location: e.target.value })} />
        </label>
        <LieferantFeld wert={w.supplier} aendern={(id) => setzen({ supplier: id })} />
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
          <Zahleingabe wert={w.purchaseValue} aendern={(v) => setzen({ purchaseValue: v })} />
        </label>
      </div>

      <label className="buero-feld">
        <span>Notiz</span>
        <textarea rows={2} value={w.notes ?? ''} onChange={(e) => setzen({ notes: e.target.value })} />
      </label>

      {/*
       * Beim Anlegen ist „& nächster" die Hauptsache und nicht die Zugabe: Wer
       * eine Kiste Kleinteile erfasst, drückt neunzehnmal ihn und einmal den
       * anderen. Die Fußleiste lässt genau eine Hauptaktion unten stehen und
       * schiebt alles `leise` am Handy hinter „⋯" — stünde der häufige Knopf
       * dort, kostete jeder Posten zwei Tipper statt einem, und zwar an der
       * Werkbank, wo genau das niemand will.
       */}
      <Fussleiste>
        {neu ? (
          <>
            <button
              type="button"
              className="buero-knopf"
              disabled={laeuft}
              onClick={() => void speichern(true)}
            >
              Speichern &amp; nächster Posten
            </button>
            <button
              type="button"
              className="buero-knopf leise"
              disabled={laeuft}
              onClick={() => void speichern()}
            >
              Speichern &amp; schließen
            </button>
          </>
        ) : (
          <button
            type="button"
            className="buero-knopf"
            disabled={laeuft}
            onClick={() => void speichern()}
          >
            Speichern
          </button>
        )}
      </Fussleiste>
    </div>
  )
}
