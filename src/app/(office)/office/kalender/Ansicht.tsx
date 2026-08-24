'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import React, { useMemo } from 'react'

import { useBestand } from '../../../../lib/buero/bestand'
import { euro } from '../../../../lib/format'

/**
 * Kalender: was wann fällig ist.
 *
 * Vorher standen Termine in vier Listen — Aufträge, Bestellungen, Angebote,
 * Belege — und ob eine Woche überladen ist, sah man erst, wenn es zu spät
 * war. Hier liegt alles nebeneinander auf einem Blatt.
 *
 * Die vier Abfragen von früher sind vier Filter über den Bestand im Gerät
 * geworden. Das Blättern durch die Monate ist damit ohne Wartezeit.
 */

type Eintrag = {
  tag: string
  titel: string
  neben?: string
  href: string
  art: 'auftrag' | 'bestellung' | 'angebot' | 'beleg'
}

const ART_TEXT: Record<Eintrag['art'], string> = {
  auftrag: 'Auftrag',
  bestellung: 'Bestellung',
  angebot: 'Angebot',
  beleg: 'Beleg',
}

const tagesStempel = (v: string | Date) => {
  const d = new Date(v)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

type Auftrag = {
  id: number | string
  dueDate?: string | null
  status?: string | null
  title?: string | null
  jobNumber?: string | null
  customerName?: string | null
}
type Bestellung = {
  id: number | string
  expectedReady?: string | null
  status?: string | null
  orderNumber?: string | null
  customer?: { name?: string | null } | null
}
type Angebot = {
  id: number | string
  validUntil?: string | null
  status?: string | null
  quoteNumber?: string | null
  customerName?: string | null
}
type Beleg = {
  id: number | string
  dueDate?: string | null
  paid?: boolean | null
  supplierName?: string | null
  title?: string | null
  grossAmount?: number | null
}

export function KalenderAnsicht() {
  const suche = useSearchParams()
  const monat = suche.get('monat') ?? undefined

  const auftraege = useBestand<Auftrag>('auftraege')
  const bestellungen = useBestand<Bestellung>('bestellungen')
  const angebote = useBestand<Angebot>('angebote')
  const belege = useBestand<Beleg>('belege')

  const heute = new Date()
  const gewaehlt = /^\d{4}-\d{2}$/.test(monat ?? '')
    ? new Date(`${monat}-01T00:00:00`)
    : new Date(heute.getFullYear(), heute.getMonth(), 1)

  const beginn = new Date(gewaehlt.getFullYear(), gewaehlt.getMonth(), 1)
  const ende = new Date(gewaehlt.getFullYear(), gewaehlt.getMonth() + 1, 1)

  const imMonat = (wert: string | null | undefined) => {
    if (!wert) return false
    const zeit = new Date(wert).getTime()
    return zeit >= beginn.getTime() && zeit < ende.getTime()
  }

  const eintraege = useMemo<Eintrag[]>(
    () => [
      ...auftraege
        .filter(
          (a) =>
            ['geplant', 'inFertigung', 'fertig'].includes(a.status ?? '') && imMonat(a.dueDate),
        )
        .map((a) => ({
          tag: tagesStempel(a.dueDate!),
          titel: a.title ?? a.jobNumber ?? 'Auftrag',
          neben: a.customerName ?? undefined,
          href: `/office/auftraege/${a.id}`,
          art: 'auftrag' as const,
        })),
      ...bestellungen
        .filter(
          (b) => ['paid', 'inProduction'].includes(b.status ?? '') && imMonat(b.expectedReady),
        )
        .map((b) => ({
          tag: tagesStempel(b.expectedReady!),
          titel: b.orderNumber ?? 'Bestellung',
          neben: b.customer?.name ?? undefined,
          href: `/office/bestellungen/${b.id}`,
          art: 'bestellung' as const,
        })),
      ...angebote
        .filter((a) => a.status === 'versendet' && imMonat(a.validUntil))
        .map((a) => ({
          tag: tagesStempel(a.validUntil!),
          titel: `${a.quoteNumber ?? 'Angebot'} läuft ab`,
          neben: a.customerName ?? undefined,
          href: `/office/angebote/${a.id}`,
          art: 'angebot' as const,
        })),
      ...belege
        .filter((b) => !b.paid && imMonat(b.dueDate))
        .map((b) => ({
          tag: tagesStempel(b.dueDate!),
          titel: b.supplierName || b.title || 'Beleg',
          neben: euro(b.grossAmount),
          href: `/office/belege/${b.id}`,
          art: 'beleg' as const,
        })),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [auftraege, bestellungen, angebote, belege, monat],
  )

  /*
   * Was laufend ist, aber keinen Termin trägt.
   *
   * Der Kalender zeigt, was ein Datum hat — und verschwieg damit alles ohne.
   * Ein Auftrag aus einer Shop-Bestellung entsteht ohne Termin (die Werkstatt
   * setzt ihn, nicht der Shop), stand also in Fertigung und im Kalender
   * nirgends. Genau so gemeldet in #41.
   *
   * Erfunden wird hier kein Datum: Ein gesetzter Termin wandert als Zusage an
   * die Kundschaft (`Jobs.ts` schreibt ihn beim Wechsel in die Fertigung in
   * die Bestellung). Stattdessen stehen die Terminlosen unter dem Blatt, mit
   * dem Weg zum Auftrag — dort trägt man den Termin ein, wenn man ihn weiß.
   *
   * Bewusst unabhängig vom gewählten Monat: Etwas ohne Datum gehört in keinen
   * Monat, und wer im März blättert, soll es trotzdem sehen.
   */
  const ohneTermin = useMemo(
    () =>
      auftraege
        .filter((a) => ['geplant', 'inFertigung', 'fertig'].includes(a.status ?? '') && !a.dueDate)
        .map((a) => ({
          id: a.id,
          titel: a.title ?? a.jobNumber ?? 'Auftrag',
          neben: a.customerName ?? undefined,
        })),
    [auftraege],
  )

  const nachTag = new Map<string, Eintrag[]>()
  for (const e of eintraege) {
    nachTag.set(e.tag, [...(nachTag.get(e.tag) ?? []), e])
  }

  // Montag als erster Tag der Woche — hier arbeitet niemand nach US-Kalender
  const ersterWochentag = (beginn.getDay() + 6) % 7
  const tageImMonat = new Date(gewaehlt.getFullYear(), gewaehlt.getMonth() + 1, 0).getDate()
  const zellen: (number | null)[] = [
    ...Array.from({ length: ersterWochentag }, () => null),
    ...Array.from({ length: tageImMonat }, (_, i) => i + 1),
  ]
  while (zellen.length % 7 !== 0) zellen.push(null)

  const monatsName = beginn.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
  const verschieben = (schritt: number) => {
    const d = new Date(gewaehlt.getFullYear(), gewaehlt.getMonth() + schritt, 1)
    return `/office/kalender?monat=${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }

  return (
    <>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1>Kalender</h1>
          <p className="buero-unterzeile">
            {monatsName} · {eintraege.length} Termine
          </p>
        </div>
        <div style={{ display: 'flex', gap: '.5rem' }}>
          <Link className="buero-knopf leise schmal" href={verschieben(-1)}>
            Zurück
          </Link>
          <Link className="buero-knopf leise schmal" href="/office/kalender">
            Heute
          </Link>
          <Link className="buero-knopf leise schmal" href={verschieben(1)}>
            Weiter
          </Link>
        </div>
      </div>

      <div className="buero-kalender">
        {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((t) => (
          <div key={t} className="buero-kalender-kopf">
            {t}
          </div>
        ))}
        {zellen.map((tag, i) => {
          if (!tag) return <div key={`leer-${i}`} className="buero-kalender-zelle leer" />
          const stempel = tagesStempel(new Date(gewaehlt.getFullYear(), gewaehlt.getMonth(), tag))
          const heutiger = stempel === tagesStempel(heute)
          return (
            <div key={stempel} className={`buero-kalender-zelle${heutiger ? ' heute' : ''}`}>
              <div className="buero-kalender-tag">{tag}</div>
              {(nachTag.get(stempel) ?? []).map((e, k) => (
                <Link key={k} href={e.href} className={`buero-kalender-eintrag ${e.art}`}>
                  <strong>{e.titel}</strong>
                  {e.neben ? <span> {e.neben}</span> : null}
                </Link>
              ))}
            </div>
          )
        })}
      </div>

      <p className="buero-unterzeile" style={{ marginTop: '1rem' }}>
        {Object.values(ART_TEXT).join(' · ')} — Fertigstellungen, zugesagte Liefertermine,
        ablaufende Angebote und fällige Belege.
      </p>

      {ohneTermin.length > 0 && (
        <>
          <h2>Ohne Termin</h2>
          <p className="buero-unterzeile">
            {ohneTermin.length === 1 ? 'Ein Auftrag läuft' : `${ohneTermin.length} Aufträge laufen`},
            ohne dass ein Fertigstellungstermin eingetragen ist — deshalb stehen sie in keinem
            Monat. Aufträge aus dem Shop entstehen so; den Termin setzt die Werkstatt.
          </p>
          <div className="buero-liste">
            {ohneTermin.map((a) => (
              <Link key={a.id} href={`/office/auftraege/${a.id}`} className="buero-zeile ist-offen">
                <div className="buero-zeile-haupt">
                  <div className="buero-zeile-titel">{a.titel}</div>
                  {a.neben ? <div className="buero-zeile-neben">{a.neben}</div> : null}
                </div>
                <span className="buero-marker offen">Termin fehlt</span>
              </Link>
            ))}
          </div>
        </>
      )}
    </>
  )
}
