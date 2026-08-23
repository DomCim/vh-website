'use client'

import { useRouter } from 'next/navigation'
import React, { useState } from 'react'

import { VersandKnopf } from './VersandKnopf'
import { AUFTRAG_STATUS } from '../../lib/listen'
import { useEntwurf } from '../../lib/buero/entwurf'
import { absenden } from '../../lib/buero/warteschlange'
import { EntwurfLeiste } from './EntwurfLeiste'
import { Fussleiste } from './Fussleiste'
import { Zahleingabe } from './Zahleingabe'
import { ArtikelBezug } from './ArtikelBezug'
import { PartnerBezug } from './PartnerBezug'
import { Ablauf } from './Ablauf'
import type { Arbeitsschritt } from '../../lib/arbeitsplan'
import { Meldestand } from './Meldestand'
import { Rueckmeldung } from './Rueckmeldung'

export type AuftragPosition = {
  description: string
  quantity: number
  price?: number | null
  /** Nur für das Bild auf dem Papier — ändert an keiner Zahl etwas */
  product?: number | '' | null
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
  const entwurf = useEntwurf(`auftraege:${werte.id ?? 'neu'}`, w, anfang)
  const [laeuft, setLaeuft] = useState(false)
  const [meldung, setMeldung] = useState<string | null>(null)

  const setzen = (teil: Partial<AuftragWerte>) => setW((v) => ({ ...v, ...teil }))

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
        <label className="buero-feld">
          <span>Kunde</span>
          <input
            value={w.customerName ?? ''}
            onChange={(e) => setzen({ customerName: e.target.value })}
          />
        </label>
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

      <h2>Lieferung und Meldungen</h2>
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

      <h2>Bestellung des Kunden</h2>
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

      <h2>Bezahlt wird in Stufen</h2>
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

      <h2>Was gefertigt wird</h2>
      {(w.positions ?? []).map((p, i) => (
        <div key={i} className="buero-reihe">
          <label className="buero-feld" style={{ gridColumn: 'span 2' }}>
            <span>Beschreibung</span>
            <input
              value={p.description}
              onChange={(e) =>
                setzen({
                  positions: (w.positions ?? []).map((x, idx) =>
                    idx === i ? { ...x, description: e.target.value } : x,
                  ),
                })
              }
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
        </div>
      ))}
      <button
        type="button"
        className="buero-knopf leise"
        onClick={() =>
          setzen({ positions: [...(w.positions ?? []), { description: '', quantity: 1 }] })
        }
      >
        Position hinzufügen
      </button>

      {/*
        * Der Ablauf steht über dem Material: In der Werkstatt fragt man
        * zuerst „was ist jetzt dran?" und erst dann „was brauche ich dafür?".
        */}
      <h2>Ablauf</h2>
      <Ablauf
        plan={w.arbeitsplan ?? []}
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

      <h2>Geplantes Material</h2>
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

      <label className="buero-feld" style={{ marginTop: '1.5rem' }}>
        <span>Notizen zur Fertigung</span>
        <textarea
          rows={3}
          value={w.notes ?? ''}
          onChange={(e) => setzen({ notes: e.target.value })}
        />
      </label>

      <Fussleiste>
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
