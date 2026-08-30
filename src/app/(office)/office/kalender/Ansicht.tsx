'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import React, { useMemo, useState } from 'react'

import { useBestand } from '../../../../lib/buero/bestand'
import { euro } from '../../../../lib/format'
import { TerminMaske } from './TerminMaske'
import { Zugang } from './Zugang'

/**
 * Kalender: was wann fällig ist.
 *
 * Vorher standen Termine in vier Listen — Aufträge, Bestellungen, Angebote,
 * Belege — und ob eine Woche überladen ist, sah man erst, wenn es zu spät
 * war. Hier liegt alles nebeneinander auf einem Blatt.
 *
 * Die vier Abfragen von früher sind vier Filter über den Bestand im Gerät
 * geworden. Das Blättern durch die Monate ist damit ohne Wartezeit.
 *
 * Seit 08/2026 kommt eine fünfte Quelle dazu, und sie ist die einzige, die
 * man von Hand füllt: eigene Termine (`collections/Appointments.ts`). Der
 * Kalender war bis dahin ein reiner Ableitungskalender — er konnte alles
 * zeigen, was aus einem Vorgang folgt, und das Naheliegendste nicht:
 * „Dienstag 9 Uhr Steuerberater" eintragen.
 *
 * Dazu drei Ansichten. Der Monat gibt den Überblick, aber in einer vollen
 * Woche stapeln sich die Einträge in einer Zelle, bis nichts mehr lesbar ist;
 * Woche und Tag zeigen dann Uhrzeiten statt bloßer Balken. Umgeschaltet wird
 * über die Adresse (`?sicht=`), damit ein Link auf genau das zeigt, was der
 * Absender vor sich hatte.
 */

type Art = 'termin' | 'auftrag' | 'bestellung' | 'angebot' | 'beleg'

type Eintrag = {
  tag: string
  titel: string
  neben?: string
  href?: string
  art: Art
  /** Beginn als Zeitpunkt — nur bei eigenen Terminen mit Uhrzeit. */
  zeit?: Date | null
  /** Das Ende — die Tagesansicht zeichnet den Termin darüber hinweg. */
  bis?: Date | null
  ganztaegig?: boolean
  /** Die Kennung des eigenen Termins, zum Bearbeiten. */
  terminId?: number | string
}

const ART_TEXT: Record<Art, string> = {
  termin: 'Termin',
  auftrag: 'Auftrag',
  bestellung: 'Bestellung',
  angebot: 'Angebot',
  beleg: 'Beleg',
}

type Sicht = 'monat' | 'woche' | 'tag'

const tagesStempel = (v: string | Date) => {
  const d = new Date(v)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

/** Aus einem Tagesstempel wieder ein Datum — ohne Zeitzonenrutsch. */
const ausStempel = (s: string) => new Date(`${s}T00:00:00`)

const uhrzeit = (d: Date) =>
  d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })

type Termin = {
  id: number | string
  title?: string | null
  start?: string | null
  ende?: string | null
  ganztaegig?: boolean | null
  ort?: string | null
  notiz?: string | null
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
  const router = useRouter()
  const monat = suche.get('monat') ?? undefined
  const sicht = (suche.get('sicht') as Sicht) ?? 'monat'
  const gewaehlterTag = suche.get('tag') ?? undefined

  /** Welcher Termin gerade bearbeitet wird — `null` heißt: keiner. */
  const [maske, setMaske] = useState<{ id?: number | string; tag?: string } | null>(null)

  const termine = useBestand<Termin>('termine')
  const auftraege = useBestand<Auftrag>('auftraege')
  const bestellungen = useBestand<Bestellung>('bestellungen')
  const angebote = useBestand<Angebot>('angebote')
  const belege = useBestand<Beleg>('belege')

  const heute = new Date()

  /*
   * Der Anker der Ansicht.
   *
   * Im Monat zählt der Monat, in Woche und Tag der gewählte Tag. Ein Klick im
   * Monatsblatt setzt `tag` und schaltet auf `tag` um — deshalb muss beides
   * nebeneinander in der Adresse stehen können.
   */
  const anker = useMemo(
    () =>
      gewaehlterTag
        ? ausStempel(gewaehlterTag)
        : /^\d{4}-\d{2}$/.test(monat ?? '')
          ? new Date(`${monat}-01T00:00:00`)
          : new Date(heute.getFullYear(), heute.getMonth(), 1),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gewaehlterTag, monat],
  )

  /** Montag der Woche, in der dieser Tag liegt. */
  const wochenBeginn = (d: Date) => {
    const m = new Date(d)
    m.setDate(m.getDate() - ((m.getDay() + 6) % 7))
    m.setHours(0, 0, 0, 0)
    return m
  }

  /* Der Zeitraum, den die gewählte Ansicht abdeckt. */
  const { beginn, ende } = useMemo(() => {
    if (sicht === 'tag') {
      const a = new Date(anker)
      a.setHours(0, 0, 0, 0)
      const b = new Date(a)
      b.setDate(b.getDate() + 1)
      return { beginn: a, ende: b }
    }
    if (sicht === 'woche') {
      const a = wochenBeginn(anker)
      const b = new Date(a)
      b.setDate(b.getDate() + 7)
      return { beginn: a, ende: b }
    }
    return {
      beginn: new Date(anker.getFullYear(), anker.getMonth(), 1),
      ende: new Date(anker.getFullYear(), anker.getMonth() + 1, 1),
    }
  }, [anker, sicht])

  const imZeitraum = (wert: string | null | undefined) => {
    if (!wert) return false
    const zeit = new Date(wert).getTime()
    return zeit >= beginn.getTime() && zeit < ende.getTime()
  }

  const eintraege = useMemo<Eintrag[]>(
    () => [
      ...termine
        .filter((t) => imZeitraum(t.start))
        .map((t) => ({
          tag: tagesStempel(t.start!),
          titel: t.title ?? 'Termin',
          neben: t.ort ?? undefined,
          art: 'termin' as const,
          zeit: t.ganztaegig ? null : new Date(t.start!),
          bis: t.ganztaegig || !t.ende ? null : new Date(t.ende),
          ganztaegig: Boolean(t.ganztaegig),
          terminId: t.id,
        })),
      ...auftraege
        .filter(
          (a) =>
            ['geplant', 'inFertigung', 'fertig'].includes(a.status ?? '') && imZeitraum(a.dueDate),
        )
        .map((a) => ({
          tag: tagesStempel(a.dueDate!),
          titel: a.title ?? a.jobNumber ?? 'Auftrag',
          neben: a.customerName ?? undefined,
          href: `/office/auftraege/${a.id}`,
          art: 'auftrag' as const,
          ganztaegig: true,
        })),
      ...bestellungen
        .filter(
          (b) => ['paid', 'inProduction'].includes(b.status ?? '') && imZeitraum(b.expectedReady),
        )
        .map((b) => ({
          tag: tagesStempel(b.expectedReady!),
          titel: b.orderNumber ?? 'Bestellung',
          neben: b.customer?.name ?? undefined,
          href: `/office/bestellungen/${b.id}`,
          art: 'bestellung' as const,
          ganztaegig: true,
        })),
      ...angebote
        .filter((a) => a.status === 'versendet' && imZeitraum(a.validUntil))
        .map((a) => ({
          tag: tagesStempel(a.validUntil!),
          titel: `${a.quoteNumber ?? 'Angebot'} läuft ab`,
          neben: a.customerName ?? undefined,
          href: `/office/angebote/${a.id}`,
          art: 'angebot' as const,
          ganztaegig: true,
        })),
      ...belege
        .filter((b) => !b.paid && imZeitraum(b.dueDate))
        .map((b) => ({
          tag: tagesStempel(b.dueDate!),
          titel: b.supplierName || b.title || 'Beleg',
          neben: euro(b.grossAmount),
          href: `/office/belege/${b.id}`,
          art: 'beleg' as const,
          ganztaegig: true,
        })),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [termine, auftraege, bestellungen, angebote, belege, beginn, ende],
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
   * Bewusst unabhängig vom gewählten Zeitraum: Etwas ohne Datum gehört in
   * keinen Monat, und wer im März blättert, soll es trotzdem sehen.
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
  // Innerhalb eines Tages: Ganztägiges zuerst, danach nach Uhrzeit
  for (const [, liste] of nachTag) {
    liste.sort((a, b) => {
      if (!a.zeit && !b.zeit) return 0
      if (!a.zeit) return -1
      if (!b.zeit) return 1
      return a.zeit.getTime() - b.zeit.getTime()
    })
  }

  /** Die Adresse für einen Wechsel — vorhandene Angaben bleiben stehen. */
  const weg = (aend: { sicht?: Sicht; tag?: string | null; monat?: string | null }) => {
    const p = new URLSearchParams()
    const s = aend.sicht ?? sicht
    if (s !== 'monat') p.set('sicht', s)

    const t = aend.tag === null ? undefined : (aend.tag ?? gewaehlterTag)
    if (t) p.set('tag', t)

    const m = aend.monat === null ? undefined : (aend.monat ?? monat)
    if (m && !t) p.set('monat', m)

    const q = p.toString()
    return `/office/kalender${q ? `?${q}` : ''}`
  }

  /** Einen Schritt vor oder zurück — je nach Ansicht Monat, Woche oder Tag. */
  const verschieben = (schritt: number) => {
    if (sicht === 'monat') {
      const d = new Date(anker.getFullYear(), anker.getMonth() + schritt, 1)
      return weg({
        monat: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        tag: null,
      })
    }
    const d = new Date(anker)
    d.setDate(d.getDate() + (sicht === 'woche' ? 7 * schritt : schritt))
    return weg({ tag: tagesStempel(d) })
  }

  const titelZeile = () => {
    if (sicht === 'tag') {
      return anker.toLocaleDateString('de-DE', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    }
    if (sicht === 'woche') {
      const bis = new Date(beginn)
      bis.setDate(bis.getDate() + 6)
      const gleicherMonat = beginn.getMonth() === bis.getMonth()
      return `${beginn.toLocaleDateString('de-DE', {
        day: 'numeric',
        ...(gleicherMonat ? {} : { month: 'long' }),
      })}. – ${bis.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })}`
    }
    return beginn.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
  }

  /** Ein einzelner Eintrag — als Link, wenn er einen Vorgang hat. */
  const Stueck = ({
    e,
    mitZeit,
    mitSpanne,
  }: {
    e: Eintrag
    mitZeit?: boolean
    /** Auch das Ende zeigen — nur wo Platz ist, also nicht im Monatsblatt. */
    mitSpanne?: boolean
  }) => {
    const inhalt = (
      <>
        {/*
          * Mit Ende, wo eines da ist: „09:00 – 18:00" sagt, wie lange der Tag
          * belegt ist. Im Monatsblatt bliebe dafür kein Platz — dort steht
          * nur der Beginn.
          */}
        {mitZeit && e.zeit ? (
          <em>
            {mitSpanne && e.bis && !e.ganztaegig
              ? `${uhrzeit(e.zeit)} – ${uhrzeit(e.bis)}`
              : uhrzeit(e.zeit)}
          </em>
        ) : null}
        <strong>{e.titel}</strong>
        {e.neben ? <span> {e.neben}</span> : null}
      </>
    )
    if (e.href) {
      return (
        <Link href={e.href} className={`buero-kalender-eintrag ${e.art}`}>
          {inhalt}
        </Link>
      )
    }
    // Eigene Termine führen nirgendwohin — sie öffnen die Maske
    return (
      <button
        type="button"
        className={`buero-kalender-eintrag ${e.art}`}
        onClick={() => setMaske({ id: e.terminId, tag: e.tag })}
      >
        {inhalt}
      </button>
    )
  }

  /* ── Monat ─────────────────────────────────────────────────────────── */
  const monatsBlatt = () => {
    const ersterWochentag = (beginn.getDay() + 6) % 7
    const tageImMonat = new Date(anker.getFullYear(), anker.getMonth() + 1, 0).getDate()
    const zellen: (number | null)[] = [
      ...Array.from({ length: ersterWochentag }, () => null),
      ...Array.from({ length: tageImMonat }, (_, i) => i + 1),
    ]
    while (zellen.length % 7 !== 0) zellen.push(null)

    return (
      <div className="buero-kalender">
        {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((t) => (
          <div key={t} className="buero-kalender-kopf">
            {t}
          </div>
        ))}
        {zellen.map((tag, i) => {
          if (!tag) return <div key={`leer-${i}`} className="buero-kalender-zelle leer" />
          const stempel = tagesStempel(new Date(anker.getFullYear(), anker.getMonth(), tag))
          const heutiger = stempel === tagesStempel(heute)
          const drin = nachTag.get(stempel) ?? []
          /*
           * Mehr als drei Einträge sprengen die Zelle. Statt sie zu stapeln,
           * bis nichts mehr lesbar ist, steht dort „+2 weitere" — und der
           * Klick führt in die Tagesansicht, wo alle Platz haben.
           */
          const sichtbar = drin.slice(0, 3)
          const rest = drin.length - sichtbar.length

          return (
            <div key={stempel} className={`buero-kalender-zelle${heutiger ? ' heute' : ''}`}>
              <Link
                href={weg({ sicht: 'tag', tag: stempel })}
                className="buero-kalender-tag"
                title="Diesen Tag ansehen"
              >
                {tag}
              </Link>
              {sichtbar.map((e, k) => (
                <Stueck key={k} e={e} mitZeit />
              ))}
              {rest > 0 && (
                <Link href={weg({ sicht: 'tag', tag: stempel })} className="buero-kalender-mehr">
                  +{rest} weitere
                </Link>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  /* ── Woche ─────────────────────────────────────────────────────────── */
  const wochenBlatt = () => {
    const tage = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(beginn)
      d.setDate(d.getDate() + i)
      return d
    })

    return (
      <div className="buero-kalender woche">
        {tage.map((d) => (
          <div key={`kopf-${tagesStempel(d)}`} className="buero-kalender-kopf">
            {d.toLocaleDateString('de-DE', { weekday: 'short' })} {d.getDate()}.
          </div>
        ))}
        {tage.map((d) => {
          const stempel = tagesStempel(d)
          const heutiger = stempel === tagesStempel(heute)
          const drin = nachTag.get(stempel) ?? []
          return (
            <div
              key={stempel}
              className={`buero-kalender-zelle hoch${heutiger ? ' heute' : ''}`}
              onDoubleClick={() => setMaske({ tag: stempel })}
              title="Doppelklick legt hier einen Termin an"
            >
              {drin.length === 0 ? (
                <span className="buero-kalender-leer">—</span>
              ) : (
                drin.map((e, k) => <Stueck key={k} e={e} mitZeit mitSpanne />)
              )}
            </div>
          )
        })}
      </div>
    )
  }

  /* ── Tag ───────────────────────────────────────────────────────────── */
  const tagesBlatt = () => {
    const stempel = tagesStempel(anker)
    const drin = nachTag.get(stempel) ?? []
    const ganztags = drin.filter((e) => !e.zeit)
    const mitUhr = drin.filter((e) => e.zeit)

    return (
      <div className="buero-kalender-tagblatt">
        {ganztags.length > 0 && (
          <div className="buero-kalender-ganztags">
            {ganztags.map((e, k) => (
              <Stueck key={k} e={e} />
            ))}
          </div>
        )}

        {/*
          * Die Stundenleiste von 6 bis 20 Uhr.
          *
          * Nicht von 0 bis 24: Vierundzwanzig Zeilen, von denen zwei Drittel
          * immer leer sind, machen die Ansicht nur lang. Was früher oder
          * später liegt, steht trotzdem — in der Zeile davor beziehungsweise
          * danach, damit nichts verschwindet.
          */}
        {Array.from({ length: 15 }, (_, i) => i + 6).map((stunde) => {
          /*
           * Ein Termin steht in **jeder** Stunde, die er berührt.
           *
           * Vorher zählte allein die Anfangsstunde: Ein Termin von 9 bis 18
           * Uhr war ein Strich in der Zeile „09:00" und darunter neun leere
           * Zeilen — die Ansicht behauptete, der Tag sei frei, obwohl er
           * belegt war. Genau so gemeldet.
           *
           * Die Beschriftung trägt nur die erste Zeile; in den folgenden
           * steht der Balken ohne Text weiter, sonst stünde derselbe Titel
           * zehnmal untereinander.
           */
          const drinnen = mitUhr.filter((e) => {
            const von = e.zeit!.getHours()
            // Ohne Ende eine Stunde annehmen — wie beim Ausliefern ans Telefon
            const bis = e.bis ? e.bis : new Date(e.zeit!.getTime() + 60 * 60 * 1000)
            /*
             * Endet ein Termin auf einer vollen Stunde, gehört diese ihm
             * nicht mehr: 9–18 Uhr belegt 9 bis 17, nicht 9 bis 18. Sonst
             * stünde er eine Zeile länger da, als er dauert.
             */
            const letzte = bis.getMinutes() > 0 ? bis.getHours() : bis.getHours() - 1
            const endstunde = Math.max(von, letzte)

            if (stunde === 6) return von <= 6
            if (stunde === 20) return endstunde >= 20 || von >= 20
            return stunde >= von && stunde <= endstunde
          })
          return (
            <div key={stunde} className="buero-kalender-stunde">
              <div className="buero-kalender-uhr">{String(stunde).padStart(2, '0')}:00</div>
              <div
                className="buero-kalender-spur"
                onDoubleClick={() => setMaske({ tag: stempel })}
                title="Doppelklick legt hier einen Termin an"
              >
                {drinnen.map((e, k) =>
                  // Beschriftet nur dort, wo er anfängt — siehe oben
                  e.zeit!.getHours() === stunde || stunde === 6 ? (
                    <Stueck key={k} e={e} mitZeit mitSpanne />
                  ) : (
                    <div key={k} className={`buero-kalender-weiter ${e.art}`} aria-hidden="true" />
                  ),
                )}
              </div>
            </div>
          )
        })}

        {drin.length === 0 && (
          <p className="buero-unterzeile" style={{ marginTop: '1rem' }}>
            An diesem Tag steht nichts an.
          </p>
        )}
      </div>
    )
  }

  return (
    <>
      <div className="buero-kalender-leiste">
        <div>
          <h1>Kalender</h1>
          <p className="buero-unterzeile">
            {titelZeile()} · {eintraege.length}{' '}
            {eintraege.length === 1 ? 'Eintrag' : 'Einträge'}
          </p>
        </div>

        <div className="buero-kalender-knoepfe">
          {/* Die Ansicht wählen */}
          <div className="buero-kalender-umschalter">
            {(['monat', 'woche', 'tag'] as Sicht[]).map((s) => (
              <Link
                key={s}
                href={weg({
                  sicht: s,
                  // Ein Wechsel in Woche oder Tag braucht einen Tag als Anker;
                  // ohne gewählten nimmt er heute
                  tag: s === 'monat' ? null : (gewaehlterTag ?? tagesStempel(heute)),
                  monat: s === 'monat' ? monat : null,
                })}
                className={`buero-kalender-umschalter-knopf${sicht === s ? ' an' : ''}`}
              >
                {s === 'monat' ? 'Monat' : s === 'woche' ? 'Woche' : 'Tag'}
              </Link>
            ))}
          </div>

          {/*
            * Blättern als eine zusammenhängende Gruppe.
            *
            * Vorher standen hier drei einzelne Knöpfe. Am Handy passten sie
            * nicht mehr neben den Umschalter, „Weiter" rutschte in eine
            * zweite Zeile und die Leiste zerfiel — genau so gemeldet. Als
            * Gruppe brauchen sie knapp die Hälfte: Die Pfeile tragen sich
            * selbst, „Heute" steht in der Mitte.
            */}
          <div className="buero-kalender-blaettern">
            <Link
              className="buero-kalender-pfeil"
              href={verschieben(-1)}
              aria-label={sicht === 'monat' ? 'Voriger Monat' : sicht === 'woche' ? 'Vorige Woche' : 'Voriger Tag'}
            >
              ‹
            </Link>
            <Link className="buero-kalender-heute" href={weg({ tag: null, monat: null })}>
              Heute
            </Link>
            <Link
              className="buero-kalender-pfeil"
              href={verschieben(1)}
              aria-label={sicht === 'monat' ? 'Nächster Monat' : sicht === 'woche' ? 'Nächste Woche' : 'Nächster Tag'}
            >
              ›
            </Link>
          </div>

          <button
            type="button"
            className="buero-knopf schmal"
            onClick={() => setMaske({ tag: gewaehlterTag ?? tagesStempel(heute) })}
          >
            Termin anlegen
          </button>
        </div>
      </div>

      {sicht === 'monat' ? monatsBlatt() : sicht === 'woche' ? wochenBlatt() : tagesBlatt()}

      <p className="buero-unterzeile" style={{ marginTop: '1rem' }}>
        {Object.values(ART_TEXT).join(' · ')} — eigene Termine, Fertigstellungen, zugesagte
        Liefertermine, ablaufende Angebote und fällige Belege.
      </p>

      <Zugang />

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

      {maske && (
        <TerminMaske
          id={maske.id}
          tag={maske.tag}
          termine={termine}
          schliessen={() => setMaske(null)}
          fertig={() => {
            setMaske(null)
            router.refresh()
          }}
        />
      )}
    </>
  )
}
