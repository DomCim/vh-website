'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import React, { useEffect, useMemo, useState } from 'react'

import { type Arbeitsschritt, naechsterSchritt } from '../../../../../lib/arbeitsplan'
import { useAbgleich, useBestand } from '../../../../../lib/buero/bestand'
import { absenden } from '../../../../../lib/buero/warteschlange'
import { datum } from '../../../../../lib/format'
import { Ablauf } from '../../../../../components/office/Ablauf'
import { Rueckmeldung } from '../../../../../components/office/Rueckmeldung'

/**
 * Eine Marke, gescannt vom Büro — die Seite mit den großen Knöpfen.
 *
 * Kein Automatismus: Der Scan **zeigt** nur; jede Buchung ist ein Tipp auf
 * einen Knopf. Ein versehentlicher Scan im Vorbeigehen ändert damit nichts —
 * anders als ein Scan, der von selbst weiterschaltet, und den ein
 * Doppel-Scan verstellt hätte.
 *
 * Die Knöpfe senden über die Warteschlange: In der Werkstatt ist das Netz
 * nicht verlässlich, und „Teil ist raus" soll auch dann gebucht sein, wenn
 * es erst später den Server erreicht.
 */

type Marke = {
  id: number | string
  code?: string | null
  auftrag?: unknown
  gekoppeltAm?: string | null
  notiz?: string | null
}

type Auftrag = {
  id: number | string
  jobNumber?: string | null
  title?: string | null
  status?: string | null
  dueDate?: string | null
  arbeitsplan?: Arbeitsschritt[] | null
}

type Partner = { id: number | string; name?: string | null }

const kennung = (wert: unknown): string =>
  typeof wert === 'object' && wert
    ? String((wert as { id?: number }).id ?? '')
    : wert == null
      ? ''
      : String(wert)

export function MarkeAnsicht() {
  const { code } = useParams<{ code: string }>()
  const marken = useBestand<Marke>('laufmarken')
  const auftraege = useBestand<Auftrag>('auftraege')
  const partner = useBestand<Partner>('partner')
  const { bereit } = useAbgleich()

  const marke = marken.find((m) => m.code === code)
  const auftrag = marke?.auftrag
    ? auftraege.find((a) => String(a.id) === kennung(marke.auftrag))
    : null

  const [wahl, setWahl] = useState<number | ''>('')
  const [laeuft, setLaeuft] = useState(false)
  const [meldung, setMeldung] = useState<string | null>(null)
  /*
   * Die gebrauchte Zeit, gebucht beim Abhaken.
   *
   * `null` heißt „noch nicht angefasst" — dann darf die Planzeit einspringen
   * (siehe unten). Eine leere Zeichenkette heißt „bewusst geleert", und die
   * soll nicht heimlich wieder vollaufen.
   */
  const [zeit, setZeit] = useState<string | null>(null)
  const [regel, setRegel] = useState<{ pflicht: boolean; planzeitVorbelegen: boolean }>({
    pflicht: false,
    planzeitVorbelegen: true,
  })

  // Die zwei Schalter aus den Einstellungen — einmal beim Öffnen
  useEffect(() => {
    let abgebrochen = false
    fetch('/api/office/laufmarken')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!abgebrochen && d?.schrittzeit) setRegel(d.schrittzeit)
      })
      .catch(() => undefined)
    return () => {
      abgebrochen = true
    }
  }, [])

  // Zum Koppeln stehen die Aufträge bereit, die noch durch die Werkstatt gehen
  const koppelbar = useMemo(
    () =>
      [...auftraege]
        .filter((a) => a.status === 'geplant' || a.status === 'inFertigung')
        .sort((a, b) => (b.jobNumber ?? '').localeCompare(a.jobNumber ?? '', 'de')),
    [auftraege],
  )

  const plan = auftrag?.arbeitsplan ?? []
  const jetzt = naechsterSchritt(plan)
  const fremdDran = jetzt?.schritt.art === 'fremd' ? jetzt : null
  const betriebsname = fremdDran
    ? (partner.find((p) => String(p.id) === kennung(fremdDran.schritt.dienstleister))?.name ??
      'Dienstleister')
    : null

  /*
   * Was jetzt im Zeitfeld steht, als Zahl — 0 heißt „keine Buchung".
   *
   * Die Vorbelegung liegt bewusst nicht im Zustand, sondern wird hier
   * gerechnet: Sonst müsste ein Effekt sie beim Schrittwechsel nachziehen,
   * und ein solcher Effekt hat schon einmal die Eingabe eines Menschen
   * überschrieben, während er tippte.
   */
  const minutenJetzt = useMemo(() => {
    const roh =
      zeit ??
      (regel.planzeitVorbelegen && jetzt?.schritt.minuten ? String(jetzt.schritt.minuten) : '')
    const n = Math.round(Number(roh))
    return Number.isFinite(n) && n > 0 ? n : 0
  }, [zeit, regel.planzeitVorbelegen, jetzt])

  async function senden(
    pfad: string,
    bereich: 'laufmarken' | 'auftraege',
    koerper: Record<string, unknown>,
    text: string,
  ) {
    setLaeuft(true)
    setMeldung(null)
    try {
      const { sofort } = await absenden({ pfad, bereich, koerper })
      setMeldung(sofort ? text : 'Gemerkt — geht raus, sobald wieder Netz da ist.')
    } catch {
      setMeldung('Das hat nicht geklappt.')
    } finally {
      setLaeuft(false)
    }
  }

  /**
   * Abhaken und, wenn eine Zeit dabeisteht, sie gleich buchen.
   *
   * Zwei Sendungen, nicht eine: Die Zeit hat ihren eigenen engen Weg
   * (`api/office/zeit`), und der prüft sein eigenes Recht. Beide gehen über
   * die Warteschlange, überleben also einen Netzausfall in der Werkstatt.
   * Zuerst die Zeit — schlägt sie fehl, ist der Schritt noch offen, und die
   * Stunde geht nicht verloren. Umgekehrt wäre der Schritt erledigt und
   * niemand wüsste mehr, dass eine Zeit fehlt.
   */
  async function schrittAbhaken(dran: { index: number; schritt: Arbeitsschritt }) {
    if (!auftrag) return
    const minuten = minutenJetzt
    setLaeuft(true)
    setMeldung(null)
    try {
      if (minuten > 0) {
        await absenden({
          pfad: '/api/office/zeit',
          bereich: 'auftraege',
          koerper: {
            aktion: 'nachtragen',
            id: auftrag.id,
            minuten,
            notiz: dran.schritt.was ?? undefined,
          },
        })
      }
      const { sofort } = await absenden({
        pfad: '/api/office/auftrag',
        bereich: 'auftraege',
        koerper: { aktion: 'schrittErledigt', id: auftrag.id, schritt: dran.index },
      })
      setZeit(null)
      setMeldung(
        sofort
          ? minuten > 0
            ? `Gebucht — erledigt, ${minuten} min auf dem Auftrag.`
            : 'Gebucht — Schritt erledigt.'
          : 'Gemerkt — geht raus, sobald wieder Netz da ist.',
      )
    } catch {
      setMeldung('Das hat nicht geklappt.')
    } finally {
      setLaeuft(false)
    }
  }

  if (!marke) {
    return (
      <>
        <h1>Laufmarke {code}</h1>
        <div className="buero-leer">
          {bereit ? 'Diese Marke gibt es nicht (mehr).' : 'wird geholt …'}
        </div>
      </>
    )
  }

  return (
    <>
      <h1>Laufmarke {marke.code}</h1>
      <p className="buero-unterzeile">
        {auftrag ? (
          <>
            hängt an{' '}
            <Link href={`/office/auftraege/${auftrag.id}`} style={{ textDecoration: 'underline' }}>
              {auftrag.jobNumber} · {auftrag.title}
            </Link>
            {marke.gekoppeltAm ? ` · seit ${datum(marke.gekoppeltAm)}` : ''}
            {auftrag.dueDate ? ` · Termin ${datum(auftrag.dueDate)}` : ''}
          </>
        ) : marke.auftrag ? (
          'Auftrag wird geholt …'
        ) : (
          marke.notiz || 'frei — hängt an der Tafel'
        )}
      </p>
      <Rueckmeldung text={meldung} />

      {!marke.auftrag ? (
        <div className="buero-karte">
          <h2 style={{ marginTop: 0 }}>An einen Auftrag heften</h2>
          <div className="buero-reihe" style={{ alignItems: 'end' }}>
            <label className="buero-feld" style={{ gridColumn: 'span 2' }}>
              <span>Auftrag</span>
              <select value={wahl} onChange={(e) => setWahl(Number(e.target.value) || '')}>
                <option value="">— wählen —</option>
                {koppelbar.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.jobNumber} · {a.title}
                  </option>
                ))}
              </select>
            </label>
            <div style={{ paddingBottom: '.2rem' }}>
              <button
                type="button"
                className="buero-knopf"
                disabled={laeuft || !wahl}
                onClick={() =>
                  void senden(
                    '/api/office/laufmarken',
                    'laufmarken',
                    { aktion: 'koppeln', code: marke.code, auftragId: wahl },
                    'Gekoppelt.',
                  )
                }
              >
                Koppeln
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/*
            * Die großen Knöpfe — für den Griff im Vorbeigehen, mit dem Teil
            * unterm Arm. Sichtbar ist immer nur der eine, der gerade dran ist.
            */}
          {fremdDran && !fremdDran.schritt.rausAm && (
            <button
              type="button"
              className="buero-knopf"
              style={{ padding: '1rem 1.4rem', fontSize: '1.05rem', marginBottom: '.8rem' }}
              disabled={laeuft || !auftrag}
              onClick={() =>
                void senden(
                  '/api/office/auftrag',
                  'auftraege',
                  { aktion: 'schrittRaus', id: auftrag!.id, schritt: fremdDran.index },
                  'Gebucht — Teil ist raus.',
                )
              }
            >
              Teil ist raus zum {betriebsname} ({fremdDran.schritt.was})
            </button>
          )}
          {fremdDran && fremdDran.schritt.rausAm && !fremdDran.schritt.zurueckAm && (
            <button
              type="button"
              className="buero-knopf"
              style={{ padding: '1rem 1.4rem', fontSize: '1.05rem', marginBottom: '.8rem' }}
              disabled={laeuft || !auftrag}
              onClick={() =>
                void senden(
                  '/api/office/auftrag',
                  'auftraege',
                  { aktion: 'schrittZurueck', id: auftrag!.id, schritt: fremdDran.index },
                  'Gebucht — Teil ist zurück.',
                )
              }
            >
              Teil ist zurück vom {betriebsname}
            </button>
          )}
          {fremdDran?.schritt.fertigGemeldetAm && !fremdDran.schritt.zurueckAm && (
            <p className="buero-unterzeile">
              {betriebsname} hat am {datum(fremdDran.schritt.fertigGemeldetAm)} fertig gemeldet.
            </p>
          )}
          {/*
            * Und derselbe große Knopf für eigene Arbeit.
            *
            * Vorher hatte nur der Fremd-Schritt Knöpfe — steht aber eigene
            * Arbeit an (und das ist der häufigere Fall: „CNC - ASP2",
            * „Entgraten", „Verpacken"), zeigte die Scan-Seite den Ablauf
            * nur an. Wer am Ende eines Arbeitsgangs die Marke scannt, will
            * genau das eine tun: abhaken. Ihn stattdessen in die
            * Auftragsliste zu schicken, macht den Scan sinnlos.
            * Gemeldet von Dominik nach dem ersten Scan (08/2026).
            */}
          {jetzt && !fremdDran && (
            <>
              {/*
                * Die gebrauchte Zeit gleich mit — damit sie nicht ein zweites
                * Mal am Auftrag geführt werden muss.
                *
                * Die Buchung geht in dieselbe Arbeitszeit-Liste wie die
                * Stoppuhr im Büro (`api/office/zeit`, Aktion „nachtragen")
                * und trägt damit die Nachkalkulation. Der Wunsch kam von
                * Dominik (08/2026): „dann brauche ich es nicht mehr hier
                * führen und habe dennoch was Belegbares."
                *
                * Ob Pflicht und ob die Planzeit vorsteht, entscheidet der
                * Betrieb unter Einstellungen → Zeit beim Abhaken.
                */}
              <label className="buero-feld" style={{ marginBottom: '.6rem' }}>
                <span>
                  Gebrauchte Zeit (Minuten){regel.pflicht ? '' : ' — darf leer bleiben'}
                </span>
                <input
                  type="number"
                  min={1}
                  inputMode="numeric"
                  placeholder={regel.pflicht ? 'z.B. 60' : 'ohne Zeitbuchung leer lassen'}
                  value={
                    zeit ??
                    (regel.planzeitVorbelegen && jetzt.schritt.minuten
                      ? String(jetzt.schritt.minuten)
                      : '')
                  }
                  onChange={(e) => setZeit(e.target.value)}
                />
              </label>
              <button
                type="button"
                className="buero-knopf"
                style={{ padding: '1rem 1.4rem', fontSize: '1.05rem', marginBottom: '.8rem' }}
                disabled={laeuft || !auftrag || (regel.pflicht && !minutenJetzt)}
                onClick={() => void schrittAbhaken(jetzt)}
              >
                {`„${jetzt.schritt.was}“ ist erledigt`}
                {minutenJetzt ? ` (${minutenJetzt} min)` : ''}
              </button>
            </>
          )}
          {!jetzt && (
            <p className="buero-unterzeile">
              Alle Schritte sind erledigt — die Marke kann zurück an die Tafel.
            </p>
          )}

          <h2>Ablauf</h2>
          <Ablauf plan={plan} />

          <div style={{ marginTop: '1.2rem' }}>
            <button
              type="button"
              className="buero-knopf leise"
              disabled={laeuft}
              onClick={() =>
                void senden(
                  '/api/office/laufmarken',
                  'laufmarken',
                  { aktion: 'entkoppeln', code: marke.code },
                  'Entkoppelt — die Marke ist wieder frei.',
                )
              }
            >
              Marke entkoppeln
            </button>
          </div>
        </>
      )}
    </>
  )
}
