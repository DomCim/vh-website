'use client'

import Link from 'next/link'
import React, { useMemo, useState } from 'react'

import { Zahleingabe } from '../../../../components/office/Zahleingabe'
import { useBestand, useRahmen } from '../../../../lib/buero/bestand'
import { datum } from '../../../../lib/format'
import {
  anfrageText,
  nachLieferanten,
  type Bestellzeile,
  type Lagerposten,
} from '../../../../lib/nachbestellung'

/**
 * Nachbestellen: was knapp ist, nach Lieferant sortiert.
 *
 * Der Mindestbestand wurde bisher angezeigt und damit hatte es sich. Der
 * Schritt danach — bestellen — fing wieder bei null an: Wer liefert das, wie
 * hieß die Artikelnummer, wie viel nehmen wir? Hier steht das beieinander, und
 * ein Knopf schickt die Anfrage raus.
 *
 * Bewusst eine **Anfrage** und keine Bestellung: Preis und Verfügbarkeit
 * stehen nicht fest. Der Lieferant antwortet mit beidem, und dann wird
 * bestellt — eine „Bestellung" mit falschem Preis ist eine Reklamation in spe.
 *
 * Gerechnet wird aus dem Bestand im Gerät; verschickt wird über den Server,
 * dafür braucht es Netz.
 */

type Partner = { id: number | string; name?: string | null; email?: string | null }

export function NachbestellenAnsicht() {
  const inventar = useBestand<Lagerposten>('inventar')
  const partner = useBestand<Partner>('partner')
  const { benutzer } = useRahmen()

  const [mengen, setMengen] = useState<Record<string, number>>({})
  const [laeuft, setLaeuft] = useState<string | null>(null)
  const [meldung, setMeldung] = useState<Record<string, string>>({})

  const bloecke = useMemo(
    () =>
      nachLieferanten(
        inventar,
        partner.map((p) => ({ id: p.id, name: p.name, email: p.email })),
      ),
    [inventar, partner],
  )

  const menge = (z: Bestellzeile) => mengen[String(z.id)] ?? z.menge

  /** Alles, was schon bestellt ist, steht unten und nicht mehr im Weg. */
  const offen = bloecke
    .map((b) => ({ ...b, zeilen: b.zeilen.filter((z) => !z.bestelltAm) }))
    .filter((b) => b.zeilen.length > 0)
  const unterwegs = bloecke.flatMap((b) =>
    b.zeilen
      .filter((z) => z.bestelltAm)
      .map((z) => ({ ...z, lieferant: b.name, lieferantId: b.lieferant })),
  )

  async function schicken(
    schluessel: string,
    koerper: Record<string, unknown>,
    erfolg: string,
  ) {
    setLaeuft(schluessel)
    setMeldung((m) => ({ ...m, [schluessel]: '' }))
    try {
      const res = await fetch('/api/office/nachbestellung', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(koerper),
      })
      const daten = await res.json()
      if (!res.ok) {
        setMeldung((m) => ({
          ...m,
          [schluessel]:
            daten.error === 'keine-adresse'
              ? 'Für diesen Lieferanten ist keine E-Mail-Adresse hinterlegt.'
              : 'Das hat nicht geklappt.',
        }))
        return
      }
      setMeldung((m) => ({ ...m, [schluessel]: erfolg }))
    } catch {
      setMeldung((m) => ({ ...m, [schluessel]: 'Das hat nicht geklappt — dafür braucht es Netz.' }))
    } finally {
      setLaeuft(null)
    }
  }

  return (
    <>
      <h1>Nachbestellen</h1>
      <p className="buero-unterzeile">
        Alles, was unter seinem Mindestbestand liegt — nach Lieferant sortiert. Die Anfrage geht als
        Mail raus und fragt nach Preis und Liefertermin.
      </p>

      {offen.length === 0 && unterwegs.length === 0 && (
        <div className="buero-leer">
          Nichts ist knapp. Mindestbestände pflegt man am Posten unter{' '}
          <Link href="/office/inventar" style={{ textDecoration: 'underline' }}>
            Inventar
          </Link>
          .
        </div>
      )}

      {offen.map((block) => {
        const schluessel = String(block.lieferant ?? 'ohne')
        const zeilen = block.zeilen.map((z) => ({ ...z, menge: menge(z) }))
        const text = anfrageText(zeilen, { name: benutzer?.name })
        return (
          <div key={schluessel} className="buero-karte">
            <h2>{block.name}</h2>
            <p className="buero-unterzeile">
              {block.lieferant === null
                ? 'Ohne hinterlegten Lieferanten — am Posten eintragen, dann geht die Anfrage von hier aus raus.'
                : block.email
                  ? `Anfrage geht an ${block.email}`
                  : 'Für diesen Lieferanten ist keine E-Mail-Adresse hinterlegt — am Partner nachtragen.'}
            </p>

            <div className="buero-liste">
              {block.zeilen.map((z) => (
                <div key={z.id} className="buero-zeile">
                  <div className="buero-zeile-haupt">
                    <div className="buero-zeile-titel">
                      <Link href={`/office/inventar/${z.id}`}>{z.name}</Link>
                      {z.artikelnummer ? ` · Art.-Nr. ${z.artikelnummer}` : ''}
                    </div>
                    <div className="buero-zeile-neben">
                      Bestand {z.bestand} {z.einheit} · Mindestbestand {z.mindest} {z.einheit} · es
                      fehlen {z.fehlt} {z.einheit}
                    </div>
                  </div>
                  <label className="buero-feld" style={{ width: '8rem', margin: 0 }}>
                    <span style={{ fontSize: '.7rem' }}>bestellen ({z.einheit})</span>
                    <Zahleingabe
                      wert={menge(z)}
                      beiLeer={0}
                      aendern={(v) => setMengen((m) => ({ ...m, [String(z.id)]: v ?? 0 }))}
                    />
                  </label>
                </div>
              ))}
            </div>

            <details style={{ margin: '.8rem 0' }}>
              <summary style={{ cursor: 'pointer', color: 'var(--buero-tinte-leise)' }}>
                Text der Anfrage ansehen
              </summary>
              <pre
                style={{
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'inherit',
                  fontSize: '.85rem',
                  color: 'var(--buero-tinte-leise)',
                  marginTop: '.6rem',
                }}
              >
                {text}
              </pre>
            </details>

            <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>
              {block.email && (
                <button
                  type="button"
                  className="buero-knopf"
                  disabled={laeuft === schluessel}
                  onClick={() =>
                    void schicken(
                      schluessel,
                      {
                        aktion: 'senden',
                        an: block.email,
                        betreff: `Bestellanfrage — ${zeilen.length} ${zeilen.length === 1 ? 'Posten' : 'Posten'}`,
                        text,
                        posten: zeilen.map((z) => z.id),
                      },
                      'Anfrage ist raus. Die Posten stehen jetzt unter „unterwegs“.',
                    )
                  }
                >
                  Anfrage an {block.name} senden
                </button>
              )}
              {/* Manche Lieferanten nehmen Bestellungen am Telefon oder im
                  eigenen Portal an. Dann fehlt nur der Vermerk, damit die
                  Liste morgen nicht wieder danach fragt. */}
              <button
                type="button"
                className="buero-knopf leise"
                disabled={laeuft === schluessel}
                onClick={() =>
                  void schicken(
                    schluessel,
                    { aktion: 'vermerken', posten: zeilen.map((z) => z.id) },
                    'Als bestellt vermerkt.',
                  )
                }
              >
                Anderswo bestellt — nur vermerken
              </button>
            </div>
            {meldung[schluessel] && <p className="buero-hinweis">{meldung[schluessel]}</p>}
          </div>
        )
      })}

      {unterwegs.length > 0 && (
        <>
          <h2>Unterwegs</h2>
          <p className="buero-unterzeile">
            Bestellt, aber noch nicht da. Wenn die Lieferung kommt: Wareneingang buchen — dann sind
            Bestand, Lieferschein und diese Liste in einem Zug erledigt.
          </p>
          <div className="buero-liste">
            {unterwegs.map((z) => (
              <div key={z.id} className="buero-zeile">
                <div className="buero-zeile-haupt">
                  <div className="buero-zeile-titel">
                    <Link href={`/office/inventar/${z.id}`}>{z.name}</Link> · {z.lieferant}
                  </div>
                  <div className="buero-zeile-neben">
                    bestellt am {datum(z.bestelltAm)} · Bestand {z.bestand} {z.einheit}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}>
                <Link
                  href={`/office/wareneingang/neu${
                    z.lieferantId ? `?lieferant=${z.lieferantId}` : ''
                  }`}
                  className="buero-knopf stumm schmal"
                >
                  Lieferung buchen
                </Link>
                <button
                  type="button"
                  className="buero-knopf stumm schmal"
                  disabled={laeuft === `zurueck-${z.id}`}
                  onClick={() =>
                    void schicken(
                      `zurueck-${z.id}`,
                      { aktion: 'zuruecksetzen', posten: [z.id] },
                      '',
                    )
                  }
                >
                  doch nicht bestellt
                </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  )
}
