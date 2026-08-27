'use client'

import React, { useMemo, useState } from 'react'
import { absenden } from '../../lib/buero/warteschlange'
import { Fussleiste } from './Fussleiste'
import { Zahleingabe } from './Zahleingabe'
import { Werkstattdateien } from './Werkstattdateien'
import { Rueckmeldung } from './Rueckmeldung'
import { Ablauf } from './Ablauf'
import type { Arbeitsschritt } from '../../lib/arbeitsplan'

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

/** Eine Variante mit ihrer eigenen Liste — leere Liste heißt „erbt die Grundliste". */
export type VariantenEingabe = {
  id: string
  titel: string
  preis?: number | null
  stueckliste: StuecklistenZeile[]
  dienstleister: DienstleisterZeile[]
  minuten?: number | null
  /** Der Ablauf als Vorlage — leer heißt „erbt die Vorlage vom Artikel" */
  ablauf?: Arbeitsschritt[]
}

const euro = (v: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v)

/**
 * Stückliste und Dienstleister eines Artikels.
 *
 * Der Artikel selbst — Titel, Preis, Bilder — bleibt in der Website-Verwaltung.
 * Was ihn kostet und wer daran mitarbeitet, ist Sache des Betriebs und steht
 * deshalb hier.
 *
 * **Varianten haben ihre eigene Liste.** Ein Kübel in 100 × 50 braucht mehr
 * Blech als derselbe in 60 × 30 und dauert länger — eine gemeinsame Liste
 * rechnet für den einen zu wenig und für den anderen zu viel. Oben wird
 * umgeschaltet: die Grundlage, dann jede Variante. Solange eine Variante keine
 * eigene Liste hat, gilt die Grundlage; das ist bei Farbvarianten der
 * Normalfall, und niemand soll dieselbe Liste dreimal pflegen.
 */
export function ArtikelFormular({
  produktId,
  stueckliste,
  dienstleister,
  posten,
  partner,
  verkaufspreis,
  arbeitsminuten,
  ablauf = [],
  varianten = [],
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
  /** Der Ablauf als Vorlage am Artikel — wird beim Anlegen eines Auftrags abgeschrieben */
  ablauf?: Arbeitsschritt[]
  varianten?: VariantenEingabe[]
  stundensatz: number
  wunschaufschlag: number
}) {
  const [basis, setBasis] = useState<StuecklistenZeile[]>(stueckliste)
  const [basisMinuten, setBasisMinuten] = useState<number>(arbeitsminuten ?? 0)
  const [basisDienste, setBasisDienste] = useState<DienstleisterZeile[]>(dienstleister)
  const [basisAblauf, setBasisAblauf] = useState<Arbeitsschritt[]>(ablauf)

  // '' ist die Grundlage, sonst die Kennung der Variante
  const [gewaehlt, setGewaehlt] = useState<string>('')
  const [listen, setListen] = useState<Record<string, StuecklistenZeile[]>>(() =>
    Object.fromEntries(varianten.map((v) => [v.id, v.stueckliste])),
  )
  const [minutenJe, setMinutenJe] = useState<Record<string, number>>(() =>
    Object.fromEntries(varianten.map((v) => [v.id, v.minuten ?? 0])),
  )
  const [diensteJe, setDiensteJe] = useState<Record<string, DienstleisterZeile[]>>(() =>
    Object.fromEntries(varianten.map((v) => [v.id, v.dienstleister])),
  )
  const [ablaufJe, setAblaufJe] = useState<Record<string, Arbeitsschritt[]>>(() =>
    Object.fromEntries(varianten.map((v) => [v.id, v.ablauf ?? []])),
  )

  const [laeuft, setLaeuft] = useState(false)
  const [meldung, setMeldung] = useState<string | null>(null)

  const variante = varianten.find((v) => v.id === gewaehlt)
  const eigene = gewaehlt ? (listen[gewaehlt] ?? []) : basis
  /** Zeigt diese Variante nur, was die Grundlage sagt? */
  const erbt = Boolean(gewaehlt) && eigene.length === 0

  // Was gerade bearbeitet wird — bei geerbter Liste ist es die Grundlage, und
  // die wird dann nur angezeigt, nicht verändert.
  const zeilen = erbt ? basis : eigene
  const setZeilen = (aendern: (v: StuecklistenZeile[]) => StuecklistenZeile[]) => {
    if (!gewaehlt) return setBasis(aendern)
    setListen((v) => ({ ...v, [gewaehlt]: aendern(v[gewaehlt] ?? []) }))
  }

  const eigeneDienste = gewaehlt ? (diensteJe[gewaehlt] ?? []) : basisDienste
  /** Zeigt diese Variante nur, was die Grundlage an Fremdleistung sagt? */
  const erbtDienste = Boolean(gewaehlt) && eigeneDienste.length === 0
  const dienste = erbtDienste ? basisDienste : eigeneDienste
  const setDienste = (aendern: (v: DienstleisterZeile[]) => DienstleisterZeile[]) => {
    if (!gewaehlt) return setBasisDienste(aendern)
    setDiensteJe((v) => ({ ...v, [gewaehlt]: aendern(v[gewaehlt] ?? []) }))
  }

  const eigenerAblauf = gewaehlt ? (ablaufJe[gewaehlt] ?? []) : basisAblauf
  /** Zeigt diese Variante nur, was die Grundlage an Ablauf sagt? */
  const erbtAblauf = Boolean(gewaehlt) && eigenerAblauf.length === 0
  const ablaufAktiv = erbtAblauf ? basisAblauf : eigenerAblauf
  const setAblauf = (plan: Arbeitsschritt[]) => {
    if (!gewaehlt) return setBasisAblauf(plan)
    setAblaufJe((v) => ({ ...v, [gewaehlt]: plan }))
  }

  const eigeneMinuten = gewaehlt ? (minutenJe[gewaehlt] ?? 0) : basisMinuten
  const minuten = gewaehlt && !eigeneMinuten ? basisMinuten : eigeneMinuten
  const setMinuten = (wert: number) => {
    if (!gewaehlt) return setBasisMinuten(wert)
    setMinutenJe((v) => ({ ...v, [gewaehlt]: wert }))
  }

  const preis = gewaehlt ? (variante?.preis ?? null) : (verkaufspreis ?? null)

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
    const sauber = (v: StuecklistenZeile[]) => v.filter((z) => z.item && z.quantity)
    const sauberDienste = (v: DienstleisterZeile[]) =>
      v.filter((d) => d.contact && d.service?.trim())
    const sauberAblauf = (v: Arbeitsschritt[]) => v.filter((s) => s.was?.trim())
    const variantenDaten = varianten.map((v) => ({
      id: v.id,
      zeilen: sauber(listen[v.id] ?? []),
      dienstleister: sauberDienste(diensteJe[v.id] ?? []),
      minuten: minutenJe[v.id] || null,
      ablauf: sauberAblauf(ablaufJe[v.id] ?? []),
    }))
    try {
      const { sofort } = await absenden({
        pfad: '/api/office/stueckliste',
        bereich: 'artikel',
        koerper: {
          produktId,
          zeilen: sauber(basis),
          dienstleister: sauberDienste(basisDienste),
          arbeitsminuten: basisMinuten || 0,
          ablauf: sauberAblauf(basisAblauf),
          varianten: variantenDaten,
        },
        // Der Schlüssel heißt hier produktId — der Bestand kennt nur `id`
        vorschau: {
          id: produktId,
          billOfMaterials: sauber(basis),
          serviceProviders: sauberDienste(basisDienste),
          productionMinutes: basisMinuten || 0,
          arbeitsplan: sauberAblauf(basisAblauf),
          variants: varianten.map((v) => ({
            id: v.id,
            title: v.titel,
            price: v.preis,
            billOfMaterials: sauber(listen[v.id] ?? []),
            serviceProviders: sauberDienste(diensteJe[v.id] ?? []),
            productionMinutes: minutenJe[v.id] || null,
            arbeitsplan: sauberAblauf(ablaufJe[v.id] ?? []),
          })),
        },
      })
      setMeldung(sofort ? 'Gespeichert.' : 'Gemerkt — geht raus, sobald wieder Netz da ist.')
    } catch {
      setMeldung('Das hat nicht geklappt.')
    } finally {
      setLaeuft(false)
    }
  }

  return (
    <div className="buero-karte">
      <Rueckmeldung text={meldung} />

      {/* Für welche Variante das alles gilt. Ohne Varianten fehlt die Reihe —
          dann gibt es nichts umzuschalten. */}
      {varianten.length > 0 && (
        <>
          <h2 style={{ marginTop: 0 }}>Wofür?</h2>
          <div className="buero-reiter" style={{ marginBottom: '.4rem' }}>
            <button
              type="button"
              className={gewaehlt === '' ? 'aktiv' : undefined}
              aria-current={gewaehlt === '' ? 'page' : undefined}
              onClick={() => setGewaehlt('')}
            >
              Grundlage
            </button>
            {varianten.map((v) => (
              <button
                key={v.id}
                type="button"
                className={gewaehlt === v.id ? 'aktiv' : undefined}
                aria-current={gewaehlt === v.id ? 'page' : undefined}
                onClick={() => setGewaehlt(v.id)}
              >
                {v.titel}
                {/* Ein Haken für „hat eine eigene Liste". Wer nichts Eigenes
                    hat, braucht auch kein Zeichen — der Normalfall bleibt
                    unbeschriftet. */}
                {(listen[v.id] ?? []).length > 0 ||
                (diensteJe[v.id] ?? []).length > 0 ||
                (ablaufJe[v.id] ?? []).length > 0
                  ? ' ✓'
                  : ''}
              </button>
            ))}
          </div>
          <p className="buero-unterzeile">
            {gewaehlt === ''
              ? 'Gilt für alle Varianten, die nichts Eigenes hinterlegt haben.'
              : erbt && erbtDienste && erbtAblauf
                ? 'Diese Variante übernimmt Material, Fremdleistung, Ablauf und Zeit von der Grundlage.'
                : `Eigenes hinterlegt: ${[!erbt && 'Material', !erbtDienste && 'Fremdleistung', !erbtAblauf && 'Ablauf', eigeneMinuten > 0 && 'Zeit']
                    .filter(Boolean)
                    .join(', ')}. Der Rest kommt von der Grundlage.`}
          </p>
        </>
      )}

      <h2>
        Material je Stück
        {variante ? ` · ${variante.titel}` : ''}
      </h2>
      {zeilen.length === 0 && (
        <p className="buero-unterzeile">
          Ohne Stückliste kann das System bei einer Bestellung nicht prüfen, ob alles da ist.
        </p>
      )}

      {/*
       * Eine geerbte Liste wird gezeigt, nicht bearbeitet. Eingabefelder, die
       * in Wahrheit die Grundlage ändern, wären eine Falle: Wer hier die Menge
       * für die große Variante hochsetzt, hätte sie für alle hochgesetzt.
       */}
      {erbt ? (
        <>
          <div className="buero-liste">
            {zeilen.length === 0 ? (
              <div className="buero-leer">Auch die Grundlage hat noch keine Stückliste.</div>
            ) : (
              zeilen.map((z, i) => {
                const p = posten.find((x) => x.id === Number(z.item))
                return (
                  <div key={i} className="buero-zeile">
                    <div className="buero-zeile-haupt">
                      <div className="buero-zeile-titel">{p?.name ?? 'unbekannter Posten'}</div>
                      <div className="buero-zeile-neben">
                        {z.quantity} {p?.unit ?? ''}
                        {z.note ? ` · ${z.note}` : ''}
                      </div>
                    </div>
                    <span className="buero-marker">von der Grundlage</span>
                  </div>
                )
              })
            )}
          </div>
          <button
            type="button"
            className="buero-knopf leise"
            onClick={() =>
              setListen((v) => ({
                ...v,
                [gewaehlt]: basis.length
                  ? basis.map((z) => ({ ...z }))
                  : [{ item: '', quantity: 1 }],
              }))
            }
          >
            Eigene Liste für „{variante?.titel}“ anlegen
          </button>
        </>
      ) : (
        <>
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
            <Zahleingabe
              wert={z.quantity}
              beiLeer={0}
              aendern={(v) =>
                setZeilen((alle) =>
                  alle.map((x, idx) => (idx === i ? { ...x, quantity: v ?? 0 } : x)),
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
      <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="buero-knopf leise"
          onClick={() => setZeilen((v) => [...v, { item: '', quantity: 1 }])}
        >
          Material hinzufügen
        </button>
        {gewaehlt !== '' && (
          <button
            type="button"
            className="buero-knopf leise"
            onClick={() => setListen((v) => ({ ...v, [gewaehlt]: [] }))}
          >
            Wieder die Grundlage verwenden
          </button>
        )}
      </div>
        </>
      )}

      <h2>
        Externe Dienstleister{variante ? ` · ${variante.titel}` : ''}
      </h2>
      {dienste.length === 0 && !erbtDienste && (
        <p className="buero-unterzeile">
          Verzinkerei, Beschichter, Laserschneider — wer von außen mitarbeitet, gehört hierher.
          {gewaehlt !== '' && ' Auch die Grundlage hat hier noch nichts stehen.'}
        </p>
      )}

      {/*
       * Wie beim Material: Was von der Grundlage kommt, wird gezeigt und nicht
       * bearbeitet. Verzinken wird nach Gewicht abgerechnet und Beschichten
       * nach Fläche — wer den Preis für die große Größe hier höher setzt,
       * hätte ihn sonst für alle höher gesetzt.
       */}
      {erbtDienste ? (
        <>
          <div className="buero-liste">
            {dienste.map((d, i) => {
              const betrieb = partner.find((x) => x.id === Number(d.contact))
              return (
                <div key={i} className="buero-zeile">
                  <div className="buero-zeile-haupt">
                    <div className="buero-zeile-titel">
                      {d.service || 'Leistung'}
                      {betrieb ? ` · ${betrieb.name}` : ''}
                    </div>
                    <div className="buero-zeile-neben">
                      {euro(d.cost ?? 0)} je Stück
                      {d.leadTime ? ` · ${d.leadTime}` : ''}
                    </div>
                  </div>
                  <span className="buero-marker">von der Grundlage</span>
                </div>
              )
            })}
          </div>
          <button
            type="button"
            className="buero-knopf leise"
            onClick={() =>
              setDiensteJe((v) => ({
                ...v,
                [gewaehlt]: basisDienste.length
                  ? basisDienste.map((d) => ({ ...d }))
                  : [{ contact: '', service: '', cost: 0 }],
              }))
            }
          >
            Eigene Preise für „{variante?.titel}“ anlegen
          </button>
        </>
      ) : (
        <>
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
            <Zahleingabe
              wert={d.cost}
              aendern={(v) =>
                setDienste((alle) => alle.map((x, idx) => (idx === i ? { ...x, cost: v } : x)))
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
      <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="buero-knopf leise"
          onClick={() => setDienste((v) => [...v, { contact: '', service: '', cost: 0 }])}
        >
          Dienstleister hinzufügen
        </button>
        {gewaehlt !== '' && (
          <button
            type="button"
            className="buero-knopf leise"
            onClick={() => setDiensteJe((v) => ({ ...v, [gewaehlt]: [] }))}
          >
            Wieder die Grundlage verwenden
          </button>
        )}
      </div>
        </>
      )}

      <h2 style={{ marginTop: '1.5rem' }}>
        Ablauf (Vorlage){variante ? ` · ${variante.titel}` : ''}
      </h2>
      <p className="buero-unterzeile">
        Die Reihenfolge, in der das Stück entsteht — wird beim Anlegen eines Auftrags
        abgeschrieben und dort abgehakt.
        {gewaehlt !== '' && ' Leer heißt: Es gilt die Vorlage der Grundlage.'}
      </p>
      {/*
       * Wie bei Material und Fremdleistung: Was von der Grundlage geerbt wird,
       * wird gezeigt und nicht bearbeitet — wer hier einen Schritt für die
       * große Variante einfügt, hätte ihn sonst für alle eingefügt.
       */}
      {erbtAblauf ? (
        <>
          {ablaufAktiv.length > 0 ? (
            <Ablauf plan={ablaufAktiv} />
          ) : (
            <div className="buero-leer">Auch die Grundlage hat noch keinen Ablauf.</div>
          )}
          <button
            type="button"
            className="buero-knopf leise"
            onClick={() =>
              setAblaufJe((v) => ({
                ...v,
                [gewaehlt]: basisAblauf.length
                  ? basisAblauf.map((s) => ({ ...s }))
                  : [{ was: '', art: 'eigen' }],
              }))
            }
          >
            Eigenen Ablauf für „{variante?.titel}“ anlegen
          </button>
        </>
      ) : (
        <>
          <Ablauf
            plan={ablaufAktiv}
            bearbeiten={{ ersetzen: setAblauf, mitStand: false }}
          />
          {gewaehlt !== '' && eigenerAblauf.length > 0 && (
            <button
              type="button"
              className="buero-knopf leise"
              style={{ marginLeft: '.6rem' }}
              onClick={() => setAblaufJe((v) => ({ ...v, [gewaehlt]: [] }))}
            >
              Wieder die Grundlage verwenden
            </button>
          )}
        </>
      )}

      <h2 style={{ marginTop: '1.5rem' }}>
        Arbeitszeit{variante ? ` · ${variante.titel}` : ''}
      </h2>
      <div className="buero-reihe">
        <label className="buero-feld">
          <span>Minuten je Stück</span>
          <input
            inputMode="numeric"
            value={eigeneMinuten || ''}
            onChange={(e) => setMinuten(Number(e.target.value.replace(/[^\d]/g, '')) || 0)}
            placeholder={gewaehlt ? `${basisMinuten || 240} (Grundlage)` : 'z.B. 240'}
          />
          {gewaehlt !== '' && (
            <span style={{ marginTop: '.4rem' }}>
              Leer heißt: Es gilt die Zeit der Grundlage.
            </span>
          )}
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
        {typeof preis === 'number' && preis > 0 && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              color: 'var(--buero-tinte-leise)',
              fontSize: '.85rem',
            }}
          >
            <span>bleibt vom Website-Preis</span>
            <span className="buero-betrag">{euro(preis - kosten.summe)}</span>
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
        {typeof preis === 'number' &&
          preis > 0 &&
          preis < kosten.summe && (
            <div className="buero-hinweis warn" style={{ marginTop: '.6rem' }}>
              Der Website-Preis liegt unter dem Einsatz. Jedes verkaufte Stück kostet die Werkstatt
              Geld.
            </div>
          )}
      </div>

      {/*
       * Die Bauunterlagen stehen unter derselben Variantenwahl wie Stückliste
       * und Fremdleistung — es ist dieselbe Frage: Was gilt für welche Größe?
       *
       * Sie speichern sich selbst und hängen deshalb nicht am Knopf unten:
       * Eine Datei, die erst beim Speichern des ganzen Artikels hochgeht,
       * wäre nach einem Fehler an ganz anderer Stelle weg.
       */}
      <Werkstattdateien
        produktId={produktId}
        variantId={gewaehlt}
        variantTitle={variante?.titel}
        darfAendern
      />

      <Fussleiste>
        <button type="button" className="buero-knopf" disabled={laeuft} onClick={() => void speichern()}>
          Speichern
        </button>
      </Fussleiste>
    </div>
  )
}
