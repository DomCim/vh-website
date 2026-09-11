'use client'

import { useRouter } from 'next/navigation'
import React, { useMemo, useState } from 'react'

import { VersandKnopf } from './VersandKnopf'
import { AUFTRAG_STATUS } from '../../lib/listen'
import { useBestand } from '../../lib/buero/bestand'
import { useEntwurf } from '../../lib/buero/entwurf'
import { absenden } from '../../lib/buero/warteschlange'
import { EntwurfLeiste } from './EntwurfLeiste'
import { Fussleiste } from './Fussleiste'
import { Zahleingabe } from './Zahleingabe'
import { ArtikelBezug } from './ArtikelBezug'
import { PartnerBezug } from './PartnerBezug'
import { Ablauf } from './Ablauf'
import { KundenAngaben } from './KundenAngaben'
import type { Arbeitsschritt } from '../../lib/arbeitsplan'
import { planStand } from '../../lib/arbeitsplan'
import { euro } from '../../lib/format'
import { Abschnitt } from './Abschnitt'
import { useAblaufVorschlaege } from '../../lib/buero/ablaufvorschlaege'
import { Meldestand } from './Meldestand'
import { Rueckmeldung } from './Rueckmeldung'

export type AuftragPosition = {
  description: string
  quantity: number
  price?: number | null
  /** Nur für das Bild auf dem Papier — ändert an keiner Zahl etwas */
  product?: number | '' | null
  /** Sieht der Beschichter über die Laufmarke — der Text auf dem Papier nicht */
  farbe?: string | null
}

export type AuftragMaterial = {
  item: number | ''
  quantity: number
  /** Vom Auftraggeber mitgebracht — zieht nichts vom Bestand ab */
  beigestellt?: boolean
}

export type AuftragWerte = {
  id?: number | string
  jobNumber?: string | null
  status?: string
  source?: string
  title?: string | null
  customerName?: string | null
  startDate?: string | null
  dueDate?: string | null
  /** Geplante Fertigungszeit in Minuten — im Formular in Stunden eingegeben */
  plannedMinutes?: number | null
  positions?: AuftragPosition[]
  material?: AuftragMaterial[]
  arbeitsplan?: Arbeitsschritt[]
  contact?: number | string
  lieferart?: string
  trackingNumber?: string
  trackingUrl?: string
  kundeEmail?: string
  kundeBenachrichtigen?: boolean
  /** Nur zum Anzeigen — geschrieben wird das vom Auslöser am Datenmodell */
  gemeldet?: {
    inFertigung?: string | null
    fertig?: string | null
    geliefert?: string | null
    hinweis?: string | null
  }
  notes?: string | null
  materialGebucht?: boolean
  customerOrderRef?: string | null
  orderedAt?: string | null
  confirmedAt?: string | null
  anzahlungProzent?: number | null
  zwischenProzent?: number | null
  meilensteinBezeichnung?: string | null
  meilensteinErreichtAm?: string | null
  rechnungsBasis?: string | null
}

export type PostenAuswahl = { id: number; name: string; unit: string; quantity: number }

/** Ein Artikel, wie ihn die Vorschlagsliste der Positionen braucht */
type ArtikelVorschlag = { id: number | string; title?: string | null; intern?: boolean | null }

const nurTag = (v?: string | null) => (v ? String(v).slice(0, 10) : '')

const STATUS = AUFTRAG_STATUS.map((s) => ({ wert: s.value, text: s.label }))

/**
 * Ein Stück durch die Werkstatt begleiten.
 *
 * Das Material steht hier als Plan. Abgebucht wird es erst, wenn der Auftrag
 * auf „Fertig" springt — vorher wäre der Bestand falsch, sobald ein Auftrag
 * doch nicht gebaut wird.
 */
export function AuftragFormular({
  werte,
  posten,
}: {
  werte: AuftragWerte
  posten: PostenAuswahl[]
}) {
  const router = useRouter()
  const [anfang] = useState<AuftragWerte>(() => ({
    status: 'geplant',
    positions: [{ description: '', quantity: 1 }],
    material: [],
    arbeitsplan: [],
    lieferart: 'versand',
    kundeBenachrichtigen: true,
    ...werte,
  }))
  const [w, setW] = useState<AuftragWerte>(anfang)

  // Angefangenes überlebt den Gerätewechsel — siehe lib/buero/entwurf.ts
  /* Schon einmal benutzte Ablaufschritte — kommen aus dem Bestand im Gerät. */
  const ablaufVorschlaege = useAblaufVorschlaege()

  /*
   * Vorhandene Artikel als Vorschlag beim Tippen einer Position.
   *
   * Wer aus einem Angebot kommt, hat die Verknüpfung längst; wer den Auftrag
   * von Hand anlegt, tippte die Bezeichnung bisher neu und suchte den Artikel
   * danach im Ausklappfeld daneben — oder eben nicht, und dann stand dasselbe
   * Stück zum dritten Mal unter einem leicht anderen Namen da.
   *
   * **Interne sind dabei**, und zwar ausdrücklich: Genau die Lohnarbeits-
   * Vorlagen will man wiederfinden. Sie tragen in der Liste den Zusatz
   * „intern", damit niemand glaubt, er verlinke etwas Öffentliches.
   */
  const alleArtikel = useBestand<ArtikelVorschlag>('artikel')
  const artikelVorschlaege = useMemo(
    () =>
      [...alleArtikel]
        .filter((a) => (a.title ?? '').trim())
        .sort((a, b) => (a.title ?? '').localeCompare(b.title ?? '', 'de')),
    [alleArtikel],
  )
  const artikelListeId = React.useId()

  /*
   * Trifft die Eingabe genau einen Artikel, wird er gleich verknüpft — dann
   * steht sein Bild auf den Papieren und der nächste gleiche Auftrag findet
   * Stückliste und Ablauf. Getippt wird trotzdem frei: Wer etwas Neues
   * schreibt, wird nicht aufgehalten.
   */
  const positionSetzen = (i: number, text: string) => {
    const treffer = artikelVorschlaege.find(
      (a) => (a.title ?? '').toLocaleLowerCase('de') === text.trim().toLocaleLowerCase('de'),
    )
    setzen({
      positions: (w.positions ?? []).map((x, idx) =>
        idx === i
          ? { ...x, description: text, ...(treffer && !x.product ? { product: Number(treffer.id) } : {}) }
          : x,
      ),
    })
  }

  const entwurf = useEntwurf(`auftraege:${werte.id ?? 'neu'}`, w, anfang)
  const [laeuft, setLaeuft] = useState(false)
  const [meldung, setMeldung] = useState<string | null>(null)

  const setzen = (teil: Partial<AuftragWerte>) => setW((v) => ({ ...v, ...teil }))

  /*
   * Was in der Kopfzeile eines zugeklappten Abschnitts steht.
   *
   * Eine Zeile je Abschnitt, und sie muss die Frage beantworten „muss ich
   * hier aufklappen?". Ohne sie wäre Zuklappen nur Verstecken — man müsste
   * jeden Abschnitt einmal aufmachen, um zu wissen, ob etwas drinsteht.
   */
  const positionen = w.positions ?? []
  const summe = positionen.reduce(
    (s, pos) => s + (Number(pos.price) || 0) * (Number(pos.quantity) || 0),
    0,
  )
  const ablauf = planStand(w.arbeitsplan)
  const material = w.material ?? []
  const stufig = Boolean(w.anzahlungProzent || w.zwischenProzent)
  const fertigOderWeg = w.status === 'fertig' || w.status === 'geliefert'

  // Fehlmengen sofort sichtbar, ohne die Seite neu zu laden
  const knapp = (w.material ?? [])
    .map((m) => {
      const p = posten.find((x) => x.id === Number(m.item))
      if (!p) return null
      const fehlt = Math.round(((m.quantity || 0) - p.quantity) * 1000) / 1000
      return fehlt > 0 ? { name: p.name, fehlt, einheit: p.unit } : null
    })
    .filter(Boolean) as { name: string; fehlt: number; einheit: string }[]

  async function speichern(neuerStatus?: string) {
    if (!w.title?.trim()) {
      setMeldung('Eine Bezeichnung wird gebraucht.')
      return
    }
    setLaeuft(true)
    setMeldung(null)
    try {
      const { id, sofort } = await absenden({
        pfad: '/api/office/auftrag',
        bereich: 'auftraege',
        koerper: { ...w, status: neuerStatus ?? w.status },
      })
      entwurf.erledigt()
      if (!w.id && sofort) router.push(`/office/auftraege/${id}`)
      else {
        setzen({ status: neuerStatus ?? w.status })
        setMeldung(sofort ? 'Gespeichert.' : 'Gemerkt — geht raus, sobald wieder Netz da ist.')
      }
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
      <Rueckmeldung text={meldung} />
      {knapp.length > 0 && (
        <p className="buero-hinweis">
          Nicht alles im Haus:{' '}
          {knapp.map((k) => `${k.name} (${k.fehlt} ${k.einheit} fehlen)`).join(', ')} — bestellen,
          bevor es losgeht.
        </p>
      )}

      <Abschnitt
        merk="auftrag:grunddaten"
        titel="Auftrag"
        vorgabe
        kurz={[w.customerName || 'ohne Kunde', AUFTRAG_STATUS.find((x) => x.value === w.status)?.label]
          .filter(Boolean)
          .join(' · ')}
      >
      <label className="buero-feld">
        <span>Bezeichnung</span>
        <input value={w.title ?? ''} onChange={(e) => setzen({ title: e.target.value })} />
      </label>

      <div className="buero-reihe">
        <PartnerBezug
          wert={typeof w.contact === 'string' ? Number(w.contact) || '' : w.contact}
          aendern={(id, partner) =>
            // Am Partner hängen Mailadresse und Sprache der Statusmeldungen
            setzen({
              contact: id,
              ...(partner ? { customerName: partner.name ?? '' } : {}),
            })
          }
        />
        <KundenAngaben
          partnerId={w.contact}
          werte={w}
          aendern={setzen}
          teil="name"
          fuehrt="name"
        />
        <label className="buero-feld">
          <span>Start</span>
          <input
            type="date"
            value={nurTag(w.startDate)}
            onChange={(e) => setzen({ startDate: e.target.value })}
          />
        </label>
        <label className="buero-feld">
          <span>Fertig bis</span>
          <input
            type="date"
            value={nurTag(w.dueDate)}
            onChange={(e) => setzen({ dueDate: e.target.value })}
          />
        </label>
        <label className="buero-feld">
          <span>Fertigungszeit (Stunden)</span>
          {/*
            Gespeichert wird in Minuten, eingetippt in Stunden — „1,5" sind
            90 Minuten. Genau dafür braucht es ein Feld, das ein Komma
            aushält; mit `type="number"` ging bis hierher nur die volle Stunde.
          */}
          <Zahleingabe
            wert={w.plannedMinutes == null ? null : Math.round((w.plannedMinutes / 60) * 10) / 10}
            aendern={(v) => setzen({ plannedMinutes: v == null ? null : Math.round(v * 60) })}
            placeholder="z.B. 20"
          />
          <span style={{ marginTop: '.4rem' }}>
            Zählt in der Wochen-Auslastung. Leer heißt „noch nicht geschätzt“ — dann fehlt dieser
            Auftrag dort.
          </span>
        </label>
        <label className="buero-feld">
          <span>Status</span>
          <select value={w.status} onChange={(e) => setzen({ status: e.target.value })}>
            {STATUS.map((s) => (
              <option key={s.wert} value={s.wert}>
                {s.text}
              </option>
            ))}
          </select>
        </label>
      </div>

      </Abschnitt>

      <Abschnitt
        merk="auftrag:lieferung"
        titel="Lieferung und Meldungen"
        vorgabe={fertigOderWeg}
        kurz={[
          w.lieferart === 'abholung' ? 'Abholung' : 'Versand',
          w.trackingNumber ? `Sendung ${w.trackingNumber}` : null,
          w.kundeBenachrichtigen === false ? 'ohne Meldungen' : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      >
      {/*
        * Was hier steht, entscheidet, was die Kundschaft erfährt. Deshalb steht
        * es beieinander und nicht verstreut: Lieferart, Adresse, Schalter — und
        * darunter, was tatsächlich rausging.
        */}
      <div className="buero-reihe">
        <label className="buero-feld">
          <span>Lieferung</span>
          <select value={w.lieferart ?? 'versand'} onChange={(e) => setzen({ lieferart: e.target.value })}>
            <option value="versand">Versand</option>
            <option value="abholung">Abholung</option>
          </select>
          <span className="buero-unterzeile">
            Bei Abholung sagt schon &bdquo;fertig&ldquo;, dass das Stück bereitsteht — eine
            Liefermeldung gibt es dann nicht.
          </span>
        </label>
        {w.lieferart !== 'abholung' && (
          <label className="buero-feld">
            <span>Sendungsnummer</span>
            <input
              value={w.trackingNumber ?? ''}
              onChange={(e) => setzen({ trackingNumber: e.target.value })}
              placeholder="z.B. 00340434…"
            />
            <span className="buero-unterzeile">
              Geht mit der Liefermeldung raus. Leer lassen, wenn du selbst lieferst.
            </span>
          </label>
        )}
      </div>

      <label className="buero-feld buero-haken">
        <input
          type="checkbox"
          checked={w.kundeBenachrichtigen !== false}
          onChange={(e) => setzen({ kundeBenachrichtigen: e.target.checked })}
        />
        <span>Kunde über den Fortschritt benachrichtigen</span>
      </label>

      {/*
        * Die Rückfalladresse erscheint nur, wenn sie gebraucht wird: Steht ein
        * Geschäftspartner am Auftrag, gilt dessen Adresse, und ein zweites Feld
        * daneben wäre eine Einladung, sie auseinanderlaufen zu lassen.
        */}
      {!w.contact && (
        <label className="buero-feld">
          <span>E-Mail des Kunden</span>
          <input
            type="email"
            value={w.kundeEmail ?? ''}
            onChange={(e) => setzen({ kundeEmail: e.target.value })}
          />
          <span className="buero-unterzeile">
            Nur nötig, solange kein Geschäftspartner verknüpft ist — sonst gilt dessen Adresse.
          </span>
        </label>
      )}

      <Meldestand gemeldet={w.gemeldet} />
      </Abschnitt>

      <Abschnitt
        merk="auftrag:bestellung"
        titel="Bestellung des Kunden"
        vorgabe={Boolean(w.customerOrderRef)}
        kurz={w.customerOrderRef ? `Nr. ${w.customerOrderRef}` : 'keine Bestellnummer'}
      >
      <div className="buero-reihe">
        <label className="buero-feld">
          <span>Bestellnummer des Kunden</span>
          <input
            value={w.customerOrderRef ?? ''}
            onChange={(e) => setzen({ customerOrderRef: e.target.value })}
            placeholder="steht auf Bestätigung und Rechnung"
          />
        </label>
        <label className="buero-feld">
          <span>Bestellt am</span>
          <input
            type="date"
            value={nurTag(w.orderedAt)}
            onChange={(e) => setzen({ orderedAt: e.target.value })}
          />
        </label>
        {w.id && (
          <div style={{ display: 'flex', alignItems: 'center', paddingBottom: '.9rem' }}>
            <a
              className="buero-knopf leise"
              href={`/api/office/auftrag/${w.id}/bestaetigung`}
              target="_blank"
              rel="noreferrer"
            >
              Bestätigung ansehen
            </a>
          </div>
        )}
      </div>

      {w.id && (
        <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <VersandKnopf art="bestaetigung" id={w.id} leise />
        </div>
      )}

      </Abschnitt>

      <Abschnitt
        merk="auftrag:stufen"
        titel="Bezahlt wird in Stufen"
        vorgabe={stufig}
        kurz={
          stufig
            ? [
                w.anzahlungProzent ? `${w.anzahlungProzent} % Anzahlung` : null,
                w.zwischenProzent ? `${w.zwischenProzent} % Zwischenrechnung` : null,
              ]
                .filter(Boolean)
                .join(' · ')
            : 'eine Rechnung am Ende'
        }
      >
      <p className="buero-unterzeile">
        Beide Felder leer oder 0: eine Rechnung am Ende. Sonst legt das Büro die Rechnungen von
        selbst als <strong>Entwurf</strong> an — bei der Auftragsanlage, beim erreichten Meilenstein
        und wenn der Auftrag auf „Fertig“ steht. Verschickt wird jede von Hand.
      </p>
      <div className="buero-reihe">
        <label className="buero-feld">
          <span>Anzahlung (%)</span>
          <Zahleingabe
            wert={w.anzahlungProzent}
            aendern={(v) => setzen({ anzahlungProzent: v })}
            disabled={Boolean(w.rechnungsBasis)}
          />
        </label>
        <label className="buero-feld">
          <span>Zwischenrechnung (%)</span>
          <Zahleingabe
            wert={w.zwischenProzent}
            aendern={(v) => setzen({ zwischenProzent: v })}
            disabled={Boolean(w.rechnungsBasis)}
          />
        </label>
        <label className="buero-feld">
          <span>Meilenstein</span>
          <input
            value={w.meilensteinBezeichnung ?? ''}
            onChange={(e) => setzen({ meilensteinBezeichnung: e.target.value })}
            placeholder="Rohbau fertig"
          />
        </label>
        <label className="buero-feld">
          <span>Erreicht am</span>
          <input
            type="date"
            value={nurTag(w.meilensteinErreichtAm)}
            onChange={(e) => setzen({ meilensteinErreichtAm: e.target.value })}
          />
        </label>
      </div>
      {w.rechnungsBasis && (
        <p className="buero-unterzeile">
          Erste Rechnung ist gestellt ({w.rechnungsBasis}) — die Anteile stehen damit fest.
        </p>
      )}

      </Abschnitt>

      <Abschnitt
        merk="auftrag:positionen"
        titel="Was gefertigt wird"
        vorgabe={!fertigOderWeg}
        kurz={
          positionen.length
            ? `${positionen.length} ${positionen.length === 1 ? 'Position' : 'Positionen'}${
                summe ? ` · ${euro(summe)}` : ''
              }`
            : 'noch nichts eingetragen'
        }
      >
      {artikelVorschlaege.length > 0 && (
        <datalist id={artikelListeId}>
          {artikelVorschlaege.map((a) => (
            <option key={a.id} value={a.title ?? ''} label={a.intern ? 'intern' : undefined} />
          ))}
        </datalist>
      )}
      {(w.positions ?? []).map((p, i) => (
        <div key={i}>
        <div className="buero-reihe">
          <label className="buero-feld" style={{ gridColumn: 'span 2' }}>
            <span>Beschreibung</span>
            <input
              value={p.description}
              list={artikelVorschlaege.length ? artikelListeId : undefined}
              onChange={(e) => positionSetzen(i, e.target.value)}
            />
          </label>
          <ArtikelBezug
            wert={p.product ?? ''}
            aendern={(id) =>
              setzen({
                positions: (w.positions ?? []).map((x, idx) =>
                  idx === i ? { ...x, product: id || undefined } : x,
                ),
              })
            }
          />
          <label className="buero-feld">
            <span>Menge</span>
            <Zahleingabe
              wert={p.quantity}
              beiLeer={0}
              aendern={(v) =>
                setzen({
                  positions: (w.positions ?? []).map((x, idx) =>
                    idx === i ? { ...x, quantity: v ?? 0 } : x,
                  ),
                })
              }
            />
          </label>
          <label className="buero-feld">
            <span>Preis (EUR)</span>
            <Zahleingabe
              wert={p.price}
              aendern={(v) =>
                setzen({
                  positions: (w.positions ?? []).map((x, idx) => (idx === i ? { ...x, price: v } : x)),
                })
              }
            />
          </label>
          <label className="buero-feld">
            <span>Farbe</span>
            <input
              value={p.farbe ?? ''}
              placeholder="z.B. Rubinrot (RAL 3003)"
              onChange={(e) =>
                setzen({
                  positions: (w.positions ?? []).map((x, idx) =>
                    idx === i ? { ...x, farbe: e.target.value } : x,
                  ),
                })
              }
            />
          </label>
        </div>
        {/*
          * Ablegen je Position, nicht je Auftrag.
          *
          * Vorher stand hier ein Knopf für den ganzen Auftrag: Er machte
          * einen Artikel mit der Auftragsbezeichnung und hängte ihn an die
          * erste Position. Ein Auftrag über „Auflagebacken" und
          * „Anschlagblech" sind aber zwei Stücke und zwei Vorlagen.
          *
          * Gezeigt nur an einem gespeicherten Auftrag und nur, solange diese
          * Position auf keinen Artikel zeigt — sonst gibt es nichts abzulegen.
          */}
        {w.id && !p.product && (p.description ?? '').trim() && (
          <div style={{ margin: '-.4rem 0 .9rem' }}>
            <AlsArtikelDialog
              auftragId={w.id}
              position={i}
              bezeichnung={p.description ?? ''}
              einzige={(w.positions ?? []).length === 1}
            />
          </div>
        )}
        </div>
      ))}
      <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="buero-knopf leise"
          onClick={() =>
            setzen({ positions: [...(w.positions ?? []), { description: '', quantity: 1 }] })
          }
        >
          Position hinzufügen
        </button>
      </div>

      {/*
        * Der Ablauf steht über dem Material: In der Werkstatt fragt man
        * zuerst „was ist jetzt dran?" und erst dann „was brauche ich dafür?".
        */}
      </Abschnitt>

      <Abschnitt
        merk="auftrag:ablauf"
        titel="Ablauf"
        vorgabe={!fertigOderWeg}
        kurz={
          ablauf.gesamt
            ? `${ablauf.erledigt} von ${ablauf.gesamt} erledigt`
            : 'kein Ablauf hinterlegt'
        }
      >
      <Ablauf
        vorschlaege={ablaufVorschlaege}
        plan={w.arbeitsplan ?? []}
        bearbeiten={{
          ersetzen: (plan) => setzen({ arbeitsplan: plan }),
          mitStand: true,
        }}
        aendern={(index, stand) =>
          setzen({
            arbeitsplan: (w.arbeitsplan ?? []).map((s, i) =>
              i === index
                ? {
                    ...s,
                    stand,
                    // Das Datum wird mitgeführt, nicht getippt: Wer abhakt,
                    // hat gerade fertiggemacht, und ein leeres Datumsfeld
                    // bliebe für immer leer.
                    erledigtAm: stand === 'erledigt' ? new Date().toISOString() : null,
                  }
                : s,
            ),
          })
        }
      />

      </Abschnitt>

      <Abschnitt
        merk="auftrag:material"
        titel="Geplantes Material"
        vorgabe={w.status === 'inFertigung'}
        kurz={
          material.length
            ? `${material.length} ${material.length === 1 ? 'Posten' : 'Posten'}${
                w.materialGebucht ? ' · abgebucht' : ''
              }`
            : 'kein Material geplant'
        }
      >
      {w.materialGebucht && (
        <p className="buero-unterzeile">Bereits vom Inventar abgezogen — Änderungen wirken nicht mehr nach.</p>
      )}
      {(w.material ?? []).map((m, i) => (
        <div key={i} className="buero-reihe">
          <label className="buero-feld" style={{ gridColumn: 'span 2' }}>
            <span>Posten</span>
            <select
              value={m.item}
              onChange={(e) =>
                setzen({
                  material: (w.material ?? []).map((x, idx) =>
                    idx === i ? { ...x, item: Number(e.target.value) || '' } : x,
                  ),
                })
              }
            >
              <option value="">— wählen —</option>
              {posten.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.quantity} {p.unit} da)
                </option>
              ))}
            </select>
          </label>
          <label className="buero-feld">
            <span>Menge</span>
            <Zahleingabe
              wert={m.quantity}
              beiLeer={0}
              aendern={(v) =>
                setzen({
                  material: (w.material ?? []).map((x, idx) =>
                    idx === i ? { ...x, quantity: v ?? 0 } : x,
                  ),
                })
              }
            />
          </label>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '.7rem',
              flexWrap: 'wrap',
            }}
          >
            {/* Bei Lohnfertigung bringt der Kunde sein Blech mit. Das darf
                beim Fertigmelden nichts abziehen und kostet in der
                Nachkalkulation nichts — sonst sieht jeder Lohnauftrag nach
                einem Verlustgeschäft aus. */}
            <label style={{ display: 'flex', gap: '.35rem', alignItems: 'center', fontSize: '.85rem' }}>
              <input
                type="checkbox"
                checked={Boolean(m.beigestellt)}
                onChange={(e) =>
                  setzen({
                    material: (w.material ?? []).map((x, idx) =>
                      idx === i ? { ...x, beigestellt: e.target.checked } : x,
                    ),
                  })
                }
              />
              beigestellt
            </label>
            <button
              type="button"
              className="buero-knopf leise"
              onClick={() => setzen({ material: (w.material ?? []).filter((_, idx) => idx !== i) })}
            >
              Entfernen
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        className="buero-knopf leise"
        onClick={() => setzen({ material: [...(w.material ?? []), { item: '', quantity: 1 }] })}
      >
        Material hinzufügen
      </button>

      </Abschnitt>

      <Abschnitt
        merk="auftrag:notizen"
        titel="Notizen zur Fertigung"
        vorgabe={Boolean(w.notes?.trim())}
        kurz={w.notes?.trim() ? w.notes.trim().split('\n')[0].slice(0, 60) : 'keine Notizen'}
      >
        <label className="buero-feld">
          <textarea
            rows={3}
            aria-label="Notizen zur Fertigung"
            value={w.notes ?? ''}
            onChange={(e) => setzen({ notes: e.target.value })}
          />
        </label>
      </Abschnitt>

      <Fussleiste geaendert={entwurf.geaendert}>
        {w.status === 'geplant' && (
          <button
            type="button"
            className="buero-knopf leise"
            disabled={laeuft}
            onClick={() => void speichern('inFertigung')}
          >
            In Fertigung nehmen
          </button>
        )}
        {w.status === 'inFertigung' && (
          <button
            type="button"
            className="buero-knopf leise"
            disabled={laeuft}
            onClick={() => void speichern('fertig')}
          >
            Fertig melden &amp; Material abbuchen
          </button>
        )}
        <button
          type="button"
          className="buero-knopf"
          disabled={laeuft}
          onClick={() => void speichern()}
        >
          Speichern
        </button>
      </Fussleiste>
    </div>
  )
}

/**
 * Aus dem Auftrag einen Artikel machen — der Weg zurück zur Vorlage.
 *
 * Eine Lohnarbeit, die zum zweiten Mal kommt, soll nicht wieder bei null
 * anfangen: Material, Ablauf und Zeit wandern an einen neuen Artikel, der
 * nicht im Shop erscheint. Kategorie und Bild fragt der Dialog ab, weil der
 * Artikel beides verlangt.
 *
 * Direkt gesendet, nicht über die Warteschlange: Die Antwort trägt die
 * Kennung des neuen Artikels, und ohne Netz gäbe es niemanden, der sie
 * entgegennimmt. Der Server hat den Doppel-Riegel — zweimal getippt gibt
 * keinen zweiten Artikel.
 */
function AlsArtikelDialog({
  auftragId,
  position,
  bezeichnung,
  einzige,
}: {
  auftragId: number | string
  /** Welche Position abgelegt wird — der Artikel trägt ihre Beschreibung */
  position: number
  bezeichnung: string
  /** Hat der Auftrag nur diese eine Position? Dann ist die Vorlage eindeutig. */
  einzige: boolean
}) {
  const medien = useBestand<{ id: number | string; alt?: string | null; filename?: string | null }>(
    'medien',
  )
  const [offen, setOffen] = useState(false)
  const [kategorien, setKategorien] = useState<{ id: number; titel: string }[]>([])
  const [kategorie, setKategorie] = useState<number | ''>('')
  const [bild, setBild] = useState<number | ''>('')
  const [laeuft, setLaeuft] = useState(false)
  const [meldung, setMeldung] = useState<string | null>(null)
  const [fertig, setFertig] = useState(false)
  const [intern, setIntern] = useState(true)
  /*
   * Bei einer einzigen Position ist klar, wozu Material und Ablauf gehören —
   * dann an. Bei mehreren wäre es geraten, und geraten wird nicht: Das Büro
   * hakt es an der Position an, die die Hauptsache ist.
   */
  const [mitVorlage, setMitVorlage] = useState(einzige)

  async function oeffnen() {
    setOffen(true)
    try {
      const r = await fetch('/api/office/kategorien')
      if (r.ok) setKategorien(((await r.json()) as { kategorien: typeof kategorien }).kategorien)
      else setMeldung('Kategorien nicht ladbar — dafür braucht es das Website-Recht.')
    } catch {
      setMeldung('Kategorien nicht ladbar — dafür braucht es Netz.')
    }
  }

  async function ablegen() {
    setLaeuft(true)
    setMeldung(null)
    try {
      const r = await fetch('/api/office/auftrag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aktion: 'alsArtikel',
          id: auftragId,
          position,
          kategorie,
          bild,
          intern,
          mitVorlage,
        }),
      })
      if (r.status === 409) setMeldung('Diese Position zeigt schon auf einen Artikel.')
      else if (!r.ok) setMeldung('Das hat nicht geklappt.')
      else {
        setFertig(true)
        setMeldung(
          mitVorlage
            ? `Abgelegt als ${intern ? 'interner' : 'öffentlicher'} Artikel — Stückliste, Ablauf und Zeit sind jetzt Vorlage.`
            : `Abgelegt als ${intern ? 'interner' : 'öffentlicher'} Artikel.`,
        )
      }
    } catch {
      setMeldung('Das hat nicht geklappt — dafür braucht es Netz.')
    } finally {
      setLaeuft(false)
    }
  }

  if (!offen) {
    return (
      <button
        type="button"
        className="buero-knopf leise schmal"
        onClick={() => void oeffnen()}
        title={`„${bezeichnung || 'diese Position'}" als Artikel ablegen`}
      >
        Als Artikel ablegen
      </button>
    )
  }

  return (
    <div style={{ flexBasis: '100%' }}>
      <Rueckmeldung text={meldung} />
      {!fertig && !einzige && (
        <p className="buero-unterzeile">
          Stückliste und Ablauf gehören dem ganzen Auftrag. Bei mehreren Positionen sagen die
          Daten nicht, welches Material zu welchem Stück gehört — hake es an der Position an, die
          die Hauptsache ist.
        </p>
      )}
      {!fertig && (
        <div className="buero-reihe" style={{ alignItems: 'end' }}>
          <label className="buero-feld">
            <span>Kategorie</span>
            <select value={kategorie} onChange={(e) => setKategorie(Number(e.target.value) || '')}>
              <option value="">— wählen —</option>
              {kategorien.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.titel}
                </option>
              ))}
            </select>
          </label>
          <label className="buero-feld">
            <span>Bild (aus der Mediathek)</span>
            <select value={bild} onChange={(e) => setBild(Number(e.target.value) || '')}>
              <option value="">— wählen —</option>
              {[...medien]
                .sort((a, b) =>
                  String(a.alt ?? a.filename ?? '').localeCompare(
                    String(b.alt ?? b.filename ?? ''),
                    'de',
                  ),
                )
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.alt || m.filename || m.id}
                  </option>
                ))}
            </select>
          </label>
          <label className="buero-haken" style={{ alignSelf: 'end', marginBottom: '.9rem' }}>
            <input type="checkbox" checked={intern} onChange={(e) => setIntern(e.target.checked)} />
            <span>Intern (nicht auf der Website)</span>
          </label>
          <label className="buero-haken" style={{ alignSelf: 'end', marginBottom: '.9rem' }}>
            <input
              type="checkbox"
              checked={mitVorlage}
              onChange={(e) => setMitVorlage(e.target.checked)}
            />
            <span>Stückliste und Ablauf mitnehmen</span>
          </label>
          <div style={{ paddingBottom: '.2rem', display: 'flex', gap: '.6rem' }}>
            <button
              type="button"
              className="buero-knopf"
              disabled={laeuft || !kategorie || !bild}
              onClick={() => void ablegen()}
            >
              Ablegen
            </button>
            <button type="button" className="buero-knopf leise" onClick={() => setOffen(false)}>
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
