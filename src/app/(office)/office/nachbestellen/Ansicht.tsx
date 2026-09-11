'use client'

import Link from 'next/link'
import React, { useMemo, useState } from 'react'

import { Zahleingabe } from '../../../../components/office/Zahleingabe'
import { useBestand, useRahmen } from '../../../../lib/buero/bestand'
import { datum, euro } from '../../../../lib/format'
import {
  anfrageText,
  lieferantenId,
  nachLieferanten,
  OFFENE_STAENDE,
  type Bestellzeile,
  type Lagerposten,
  type Lieferantenbestellung,
} from '../../../../lib/nachbestellung'
import { Rueckmeldung } from '../../../../components/office/Rueckmeldung'

/**
 * Nachbestellen: was knapp ist, was angefragt ist, was unterwegs ist.
 *
 * **Der Weg, den das Papier im Betrieb wirklich geht** — und den diese Seite
 * bis vor Kurzem nur zur Hälfte kannte:
 *
 *  1. Ein Posten rutscht unter seinen Mindestbestand. Er steht oben.
 *  2. Entweder geht eine **Anfrage** an den Lieferanten (Preis und Termin
 *     stehen ja noch nicht fest), oder es wird **woanders bestellt** — im
 *     Netz, am Telefon, im Laden. Dafür muss niemand einen Geschäftspartner
 *     anlegen; wo bestellt wurde, ist freier Text.
 *  3. Antwortet der Lieferant, wird aus der Anfrage eine Bestellung. Termin
 *     und Preise wandern mit hinein.
 *  4. Die Lieferung kommt — ganz oder teilweise. Der Wareneingang schreibt
 *     mit, was ankam.
 *
 * Früher endete die Seite nach Schritt 2, und zwar mit einem Datum am Posten.
 * Damit war die bestellte Menge weg, eine Anfrage galt als Bestellung, und
 * eine halbe Lieferung setzte den Merker zurück — der Posten wäre ein zweites
 * Mal bestellt worden.
 *
 * Gerechnet wird aus dem Bestand im Gerät; verschickt wird über den Server,
 * dafür braucht es Netz.
 */

type Partner = { id: number | string; name?: string | null; email?: string | null }

const STAND_TEXT: Record<string, string> = {
  angefragt: 'angefragt',
  bestellt: 'bestellt',
  teilgeliefert: 'teilgeliefert',
}

export function NachbestellenAnsicht() {
  const inventar = useBestand<Lagerposten>('inventar')
  const partner = useBestand<Partner>('partner')
  const bestellungen = useBestand<Lieferantenbestellung>('lieferantenbestellungen')
  const { benutzer } = useRahmen()

  const [mengen, setMengen] = useState<Record<string, number>>({})
  const [wo, setWo] = useState<Record<string, string>>({})
  const [termin, setTermin] = useState<Record<string, string>>({})
  const [laeuft, setLaeuft] = useState<string | null>(null)
  /*
   * Etwas bestellen, das es im Lager noch nicht gibt.
   *
   * Vorher ging das nur rückwärts: erst im Inventar anlegen, Mindestbestand
   * setzen, warten, bis es darunter rutscht — und dann stand es hier. Wer
   * einmal eine neue Sorte Draht braucht, will sie bestellen und nicht
   * verwalten.
   */
  const [neu, setNeu] = useState({
    name: '',
    menge: 1,
    einheit: 'Stück',
    artikelnummer: '',
    lieferant: '' as number | '',
    wo: '',
  })
  const [meldung, setMeldung] = useState<Record<string, string>>({})

  const namen = useMemo(
    () => new Map(inventar.map((p) => [String(p.id), p])),
    [inventar],
  )

  const bloecke = useMemo(
    () =>
      nachLieferanten(
        inventar,
        partner.map((p) => ({ id: p.id, name: p.name, email: p.email })),
        bestellungen,
      ),
    [inventar, partner, bestellungen],
  )

  /** Angefragt, bestellt, teilgeliefert — was noch nicht abgeschlossen ist. */
  const offeneBestellungen = useMemo(
    () =>
      bestellungen
        .filter((b) => OFFENE_STAENDE.includes((b.status ?? '') as 'angefragt'))
        .sort((a, b) =>
          String(b.orderNumber ?? '').localeCompare(String(a.orderNumber ?? ''), 'de', {
            numeric: true,
          }),
        ),
    [bestellungen],
  )

  const angefragt = offeneBestellungen.filter((b) => b.status === 'angefragt')
  const unterwegs = offeneBestellungen.filter((b) => b.status !== 'angefragt')

  const menge = (z: Bestellzeile) => mengen[String(z.id)] ?? z.menge

  const lieferantName = (b: Lieferantenbestellung) => {
    const id = lieferantenId(b.supplier)
    const p = id == null ? null : partner.find((x) => String(x.id) === String(id))
    return p?.name || b.supplierName || 'ohne Angabe'
  }

  async function schicken(schluessel: string, koerper: Record<string, unknown>, erfolg: string) {
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

  /** Die Zeilen einer Bestellung, aufgelöst mit Namen und Einheit aus dem Inventar. */
  const zeilenVon = (b: Lieferantenbestellung) =>
    (b.lines ?? []).map((z) => {
      const posten = namen.get(String(lieferantenId(z.item)))
      return {
        id: lieferantenId(z.item),
        name: posten?.name ?? 'Posten',
        einheit: posten?.unit ?? '',
        bestellt: z.quantity ?? 0,
        geliefert: z.deliveredQuantity ?? 0,
        preis: z.price ?? null,
      }
    })

  return (
    <>
      <h1>Nachbestellen</h1>
      <p className="buero-unterzeile">
        Alles, was unter seinem Mindestbestand liegt — nach Lieferant sortiert. Die Anfrage geht als
        Mail raus und fragt nach Preis und Liefertermin. Wer woanders bestellt, vermerkt es nur.
      </p>

      {bloecke.length === 0 && offeneBestellungen.length === 0 && (
        <div className="buero-leer">
          Nichts ist knapp. Mindestbestände pflegt man am Posten unter{' '}
          <Link href="/office/inventar" style={{ textDecoration: 'underline' }}>
            Inventar
          </Link>
          .
        </div>
      )}

      {/* ── Was bestellt werden muss ─────────────────────────────────────── */}
      {bloecke.map((block) => {
        const schluessel = String(block.lieferant ?? 'ohne')
        const zeilen = block.zeilen.map((z) => ({ ...z, menge: menge(z) }))
        const text = anfrageText(zeilen, { name: benutzer?.name })
        const posten = zeilen.map((z) => ({ item: z.id, menge: z.menge }))
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
                /*
                 * Bewusst ohne Statusbalken.
                 *
                 * Diese Liste enthält ausschließlich Material unter dem
                 * Mindestbestand — jede Zeile ist gleich dringlich. Ein roter
                 * Balken an allen sagt nichts mehr; er würde nur die Farbe
                 * abnutzen, mit der anderswo das Eilige gekennzeichnet ist
                 * (siehe office.css, „Der Statusbalken links").
                 */
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

            <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
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
                        zeilen: posten,
                        lieferant: block.lieferant,
                        wo: block.name,
                      },
                      'Anfrage ist raus. Die Bestellung steht jetzt unter „Angefragt“.',
                    )
                  }
                >
                  Anfrage an {block.name} senden
                </button>
              )}

              {/*
                * Der zweite Weg, und er ist heute der häufigere: bestellt wird
                * im Netz, am Telefon oder im Laden. Dafür soll niemand eine
                * Plattform als Geschäftspartner anlegen müssen — es genügt der
                * Name im Feld daneben.
                */}
              <label className="buero-feld" style={{ width: '12rem', margin: 0 }}>
                <span style={{ fontSize: '.7rem' }}>Wo bestellt?</span>
                <input
                  value={wo[schluessel] ?? ''}
                  placeholder="z.B. im Netz, Laden, Telefon"
                  onChange={(e) => setWo((w) => ({ ...w, [schluessel]: e.target.value }))}
                />
              </label>
              <button
                type="button"
                className="buero-knopf leise"
                disabled={laeuft === schluessel}
                onClick={() =>
                  void schicken(
                    schluessel,
                    {
                      aktion: 'vermerken',
                      zeilen: posten,
                      lieferant: block.lieferant,
                      wo: (wo[schluessel] ?? '').trim() || block.name,
                    },
                    'Als bestellt vermerkt.',
                  )
                }
              >
                Woanders bestellt — nur vermerken
              </button>
            </div>
            <Rueckmeldung text={meldung[schluessel]} />
          </div>
        )
      })}

      {/* ── Etwas Neues bestellen ────────────────────────────────────────── */}
      <div className="buero-karte">
        <h2>Etwas Neues bestellen</h2>
        <p className="buero-unterzeile">
          Was es im Lager noch nicht gibt. Der Posten wird dabei angelegt — mit Bestand 0, den
          füllt die Lieferung. Einen Mindestbestand kann man später am Posten setzen, wenn klar
          ist, ob es dauerhaft dazugehört.
        </p>
        <div className="buero-reihe">
          <label className="buero-feld" style={{ gridColumn: 'span 2' }}>
            <span>Was</span>
            <input
              value={neu.name}
              placeholder="z.B. Schleifscheiben 125 mm"
              onChange={(e) => setNeu((n) => ({ ...n, name: e.target.value }))}
            />
          </label>
          <label className="buero-feld">
            <span>Menge</span>
            <Zahleingabe
              wert={neu.menge}
              beiLeer={0}
              aendern={(v) => setNeu((n) => ({ ...n, menge: v ?? 0 }))}
            />
          </label>
          <label className="buero-feld">
            <span>Einheit</span>
            <input
              value={neu.einheit}
              onChange={(e) => setNeu((n) => ({ ...n, einheit: e.target.value }))}
            />
          </label>
          <label className="buero-feld">
            <span>Artikelnummer</span>
            <input
              value={neu.artikelnummer}
              placeholder="beim Lieferanten"
              onChange={(e) => setNeu((n) => ({ ...n, artikelnummer: e.target.value }))}
            />
          </label>
          <label className="buero-feld">
            <span>Lieferant</span>
            <select
              value={neu.lieferant}
              onChange={(e) =>
                setNeu((n) => ({ ...n, lieferant: e.target.value ? Number(e.target.value) : '' }))
              }
            >
              <option value="">— woanders —</option>
              {[...partner]
                .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'de'))
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="buero-feld">
            <span>Wo bestellt?</span>
            <input
              value={neu.wo}
              placeholder="z.B. im Netz, Laden, Telefon"
              onChange={(e) => setNeu((n) => ({ ...n, wo: e.target.value }))}
            />
          </label>
        </div>

        <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>
          {(() => {
            const gewaehlt = partner.find((p) => String(p.id) === String(neu.lieferant))
            const bereit = neu.name.trim().length > 0 && neu.menge > 0
            const nutzlast = {
              neu: [
                {
                  name: neu.name.trim(),
                  menge: neu.menge,
                  einheit: neu.einheit,
                  artikelnummer: neu.artikelnummer,
                },
              ],
              lieferant: neu.lieferant || null,
            }
            const leeren = () =>
              setNeu({ name: '', menge: 1, einheit: 'Stück', artikelnummer: '', lieferant: '', wo: '' })
            return (
              <>
                {gewaehlt?.email && (
                  <button
                    type="button"
                    className="buero-knopf"
                    disabled={!bereit || laeuft === 'neu'}
                    onClick={() =>
                      void schicken(
                        'neu',
                        {
                          ...nutzlast,
                          aktion: 'senden',
                          an: gewaehlt.email,
                          betreff: 'Bestellanfrage',
                          text: anfrageText(
                            [
                              {
                                id: 0,
                                name: neu.name.trim(),
                                einheit: neu.einheit,
                                bestand: 0,
                                mindest: 0,
                                fehlt: 0,
                                menge: neu.menge,
                                artikelnummer: neu.artikelnummer || null,
                              },
                            ],
                            { name: benutzer?.name },
                          ),
                          wo: gewaehlt.name,
                        },
                        'Anfrage ist raus, der Posten ist angelegt.',
                      ).then(leeren)
                    }
                  >
                    Anfrage senden
                  </button>
                )}
                <button
                  type="button"
                  className="buero-knopf leise"
                  disabled={!bereit || laeuft === 'neu'}
                  onClick={() =>
                    void schicken(
                      'neu',
                      {
                        ...nutzlast,
                        aktion: 'vermerken',
                        wo: neu.wo.trim() || gewaehlt?.name || 'woanders bestellt',
                      },
                      'Vermerkt, der Posten ist angelegt.',
                    ).then(leeren)
                  }
                >
                  Schon bestellt — nur vermerken
                </button>
              </>
            )
          })()}
        </div>
        <Rueckmeldung text={meldung['neu']} />
      </div>

      {/* ── Angefragt: warten auf Preis und Termin ───────────────────────── */}
      {angefragt.length > 0 && (
        <>
          <h2>Angefragt</h2>
          <p className="buero-unterzeile">
            Die Anfrage ist raus, Preis und Termin stehen aus. Antwortet der Lieferant, hier
            eintragen — dann gilt es als bestellt.
          </p>
          {angefragt.map((b) => {
            const s = `anfrage-${b.id}`
            return (
              <div key={b.id} className="buero-karte">
                <h3 style={{ margin: 0 }}>
                  {b.orderNumber} · {lieferantName(b)}
                </h3>
                <p className="buero-unterzeile">angefragt am {datum(b.requestedAt)}</p>
                <div className="buero-liste">
                  {zeilenVon(b).map((z, i) => (
                    <div key={i} className="buero-zeile">
                      <div className="buero-zeile-haupt">
                        <div className="buero-zeile-titel">{z.name}</div>
                        <div className="buero-zeile-neben">
                          {z.bestellt} {z.einheit}
                          {z.preis != null ? ` · ${euro(z.preis)} je ${z.einheit || 'Einheit'}` : ''}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div
                  style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap', alignItems: 'flex-end' }}
                >
                  <label className="buero-feld" style={{ width: '11rem', margin: 0 }}>
                    <span style={{ fontSize: '.7rem' }}>Zugesagt zum</span>
                    <input
                      type="date"
                      value={termin[s] ?? ''}
                      onChange={(e) => setTermin((t) => ({ ...t, [s]: e.target.value }))}
                    />
                  </label>
                  <button
                    type="button"
                    className="buero-knopf"
                    disabled={laeuft === s}
                    onClick={() =>
                      void schicken(
                        s,
                        { aktion: 'bestellen', bestellung: b.id, zugesagtAm: termin[s] || null },
                        'Gilt jetzt als bestellt.',
                      )
                    }
                  >
                    Ist bestellt
                  </button>
                  <button
                    type="button"
                    className="buero-knopf stumm"
                    disabled={laeuft === s}
                    onClick={() =>
                      void schicken(
                        s,
                        { aktion: 'stornieren', bestellung: b.id },
                        'Storniert — die Posten stehen wieder oben.',
                      )
                    }
                  >
                    Kommt nicht
                  </button>
                </div>
                <Rueckmeldung text={meldung[s]} />
              </div>
            )
          })}
        </>
      )}

      {/* ── Unterwegs ────────────────────────────────────────────────────── */}
      {unterwegs.length > 0 && (
        <>
          <h2>Unterwegs</h2>
          <p className="buero-unterzeile">
            Bestellt, aber noch nicht (vollständig) da. Wenn die Lieferung kommt: Wareneingang
            buchen — dann sind Bestand, Lieferschein und diese Liste in einem Zug erledigt.
          </p>
          {unterwegs.map((b) => {
            const s = `unterwegs-${b.id}`
            const id = lieferantenId(b.supplier)
            return (
              <div key={b.id} className="buero-karte">
                <h3 style={{ margin: 0 }}>
                  {b.orderNumber} · {lieferantName(b)}{' '}
                  <span className={`buero-marker ${b.status === 'teilgeliefert' ? 'offen' : ''}`}>
                    {STAND_TEXT[b.status ?? ''] ?? b.status}
                  </span>
                </h3>
                <p className="buero-unterzeile">
                  bestellt am {datum(b.orderedAt)}
                  {b.expectedAt ? ` · zugesagt zum ${datum(b.expectedAt)}` : ''}
                </p>
                <div className="buero-liste">
                  {zeilenVon(b).map((z, i) => (
                    <div key={i} className="buero-zeile">
                      <div className="buero-zeile-haupt">
                        <div className="buero-zeile-titel">{z.name}</div>
                        <div className="buero-zeile-neben">
                          {z.geliefert > 0
                            ? `${z.geliefert} von ${z.bestellt} ${z.einheit} da`
                            : `${z.bestellt} ${z.einheit} bestellt`}
                          {z.preis != null ? ` · ${euro(z.preis)} je ${z.einheit || 'Einheit'}` : ''}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>
                  <Link
                    href={`/office/wareneingang/neu${id ? `?lieferant=${id}` : ''}`}
                    className="buero-knopf"
                  >
                    Lieferung buchen
                  </Link>
                  <button
                    type="button"
                    className="buero-knopf stumm"
                    disabled={laeuft === s}
                    onClick={() =>
                      void schicken(
                        s,
                        { aktion: 'stornieren', bestellung: b.id },
                        'Storniert — die Posten stehen wieder oben.',
                      )
                    }
                  >
                    Kommt doch nicht
                  </button>
                </div>
                <Rueckmeldung text={meldung[s]} />
              </div>
            )
          })}
        </>
      )}
    </>
  )
}
