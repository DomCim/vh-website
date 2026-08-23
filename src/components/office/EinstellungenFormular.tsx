'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'

import type { FeldBeschreibung } from '../../lib/felderLesen'
import { locales, type Locale } from '../../lib/i18n'
import { hatUebersetzbares, uebersetzbarerTeil } from '../../lib/sprachfelder'
import { htmlHatInhalt } from '../../lib/mailhtml'
import { Fussleiste } from './Fussleiste'
import { Schreibfeld } from './Schreibfeld'
import { Zahleingabe } from './Zahleingabe'
import { Rueckmeldung } from './Rueckmeldung'

/**
 * Einstellungen im Büro — gerendert aus der Feldbeschreibung von Payload.
 *
 * Bewusst nicht von Hand nachgebaut: Die Integrationen allein sind über
 * fünfhundert Zeilen Felddefinition. Ein zweites, handgeschriebenes Formular
 * liefe auseinander, sobald jemand ein Feld ergänzt — und zwar unbemerkt. So
 * erscheint hier, was dort steht.
 *
 * **Warum nicht alles untereinander.** Genau so war es: 7523 Pixel am Telefon,
 * knapp neun Bildschirmhöhen. Zum Postfach kam man, indem man an PayPal und
 * Facebook vorbeiscrollte, und wer eines eintragen wollte, hatte neun Felder vor
 * sich und daneben alles andere. Die Übersicht braucht jetzt 1337 Pixel.
 *
 * Deshalb drei Ebenen mit **einer** Bewegung: Liste antippen, Ansicht bearbeiten,
 * zurück. Oben die Bereiche (E-Mail, Postfächer, PayPal …), darin die Felder —
 * und wo ein Bereich mehrere gleichartige Einträge hat, noch eine Liste. Ein
 * Postfach ist dann eine Zeile mit Namen und Adresse, und die neun Felder
 * erscheinen erst, wenn man es öffnet.
 *
 * **Der Stand bleibt dabei überall im selben Objekt.** Das Umblättern ist keine
 * Navigation, sondern eine Anzeigefrage — sonst wäre jede Rückkehr ein
 * Datenverlust, und gespeichert wird ohnehin am Ende alles auf einmal.
 *
 * Passwörter und Schlüssel sind verdeckt, aber kopierfähig: Man braucht sie
 * regelmäßig zum Einfügen woanders, und ein Feld, das man nur überschreiben
 * kann, ist beim Nachsehen wertlos.
 */

type Werte = Record<string, unknown>

/**
 * Alle drei Sprachfassungen nebeneinander.
 *
 * Früher lag immer nur eine im Formular, und das Umschalten holte neu. Das
 * erzwang einen Modus, in dem die halbe Liste verschwand — denn Anschrift und
 * Bankverbindung gibt es nur einmal. Jetzt liegen alle drei bereit, und jedes
 * Feld greift sich die Fassung, die es angeht.
 */
type AlleWerte = Record<Locale, Werte>

const LEERE_WERTE: AlleWerte = { de: {}, fr: {}, en: {} }

function tiefLesen(werte: Werte, pfad: string[]): unknown {
  return pfad.reduce<unknown>(
    (stand, teil) => (stand && typeof stand === 'object' ? (stand as Werte)[teil] : undefined),
    werte,
  )
}

/**
 * Einen Wert tief in der Struktur setzen — ohne die Struktur zu verändern.
 *
 * Der Haken sitzt bei den Listen. `{ ...werte, [kopf]: … }` macht aus einem
 * Array ein gewöhnliches Objekt: Aus `[{…}]` wird `{ '0': {…} }`. Beim
 * Anzeigen fragt das Formular `Array.isArray` — und findet nichts mehr.
 * Genau das passierte beim Anlegen eines Postfachs: Der Eintrag stand da, und
 * beim ersten Buchstaben war er wieder weg.
 */
function tiefSetzen(stand: unknown, pfad: string[], wert: unknown): unknown {
  const [kopf, ...rest] = pfad

  if (Array.isArray(stand)) {
    const kopie = stand.slice()
    const i = Number(kopf)
    kopie[i] = rest.length ? tiefSetzen(kopie[i] ?? {}, rest, wert) : wert
    return kopie
  }

  const alt = (stand && typeof stand === 'object' ? stand : {}) as Werte
  return { ...alt, [kopf]: rest.length ? tiefSetzen(alt[kopf], rest, wert) : wert }
}

/** Steht in diesem Feld (oder irgendwo darunter) etwas? */
function istGefuellt(wert: unknown): boolean {
  if (wert == null || wert === '') return false
  if (typeof wert === 'boolean') return wert
  if (Array.isArray(wert)) return wert.length > 0
  if (typeof wert === 'object') return Object.values(wert as Werte).some(istGefuellt)
  return true
}

/**
 * Die Zeile unter dem Namen eines Listeneintrags.
 *
 * Gesucht wird nach den Feldern, an denen man einen Eintrag wiedererkennt —
 * erst eine Bezeichnung, dann eine Adresse. Fest verdrahtete Feldnamen wären
 * hier falsch: Die Liste soll auch für eine Liste funktionieren, die es noch
 * nicht gibt. Findet sich nichts, bleibt die Zeile eben leer.
 */
const NAMENSFELDER = ['label', 'name', 'titel', 'title', 'bezeichnung']
const KENNFELDER = ['address', 'email', 'adresse', 'user', 'benutzer', 'host']

function eintragTitel(eintrag: Werte, felder: FeldBeschreibung[], nummer: number): string {
  for (const schluessel of NAMENSFELDER) {
    if (felder.some((f) => f.name === schluessel)) {
      const wert = eintrag?.[schluessel]
      if (typeof wert === 'string' && wert.trim()) return wert.trim()
    }
  }
  return `Eintrag ${nummer}`
}

function eintragNeben(eintrag: Werte, felder: FeldBeschreibung[]): string {
  for (const schluessel of KENNFELDER) {
    if (felder.some((f) => f.name === schluessel)) {
      const wert = eintrag?.[schluessel]
      if (typeof wert === 'string' && wert.trim()) return wert.trim()
    }
  }
  return ''
}

/** Ältere Klartext-Signaturen fürs Schreibfeld zu Absätzen machen */
function klartextAlsHtml(wert: string): string {
  const sauber = wert.trim()
  if (!sauber || sauber.includes('<')) return sauber
  return sauber
    .split(/\r?\n/)
    .map(
      (z) =>
        `<p>${z.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') || '<br>'}</p>`,
    )
    .join('')
}

function Geheimfeld({ wert, aendern }: { wert: string; aendern: (neu: string) => void }) {
  const [sichtbar, setSichtbar] = useState(false)
  return (
    <div style={{ display: 'flex', gap: '.4rem', alignItems: 'stretch' }}>
      <input
        type={sichtbar ? 'text' : 'password'}
        value={wert}
        onChange={(e) => aendern(e.target.value)}
        style={{ flex: 1, minWidth: 0 }}
        // Kopierfähig soll es bleiben, auch verdeckt
        onFocus={(e) => e.currentTarget.select()}
      />
      <button
        type="button"
        className="buero-knopf schmal leise"
        onClick={() => setSichtbar((s) => !s)}
        aria-label={sichtbar ? 'Verdecken' : 'Anzeigen'}
      >
        {sichtbar ? 'verdecken' : 'zeigen'}
      </button>
    </div>
  )
}

/**
 * Ein einzelnes Feld — alles außer Gruppen und Listen.
 *
 * Die beiden fehlen hier nicht aus Versehen: Sie sind keine Eingabe, sondern
 * eine Ebene, und Ebenen entscheidet das Blatt weiter unten.
 */
function Feld({
  feld,
  pfad,
  werte,
  setzen,
  sprache,
  erbt,
}: {
  feld: FeldBeschreibung
  pfad: string[]
  werte: AlleWerte
  setzen: (sprache: Locale, pfad: string[], wert: unknown) => void
  /** Welche Fassung gerade bearbeitet wird */
  sprache: Locale
  /** Steht dieses Feld in etwas, das es je Sprache gibt? (Einträge einer übersetzten Liste) */
  erbt: boolean
}) {
  const eigenerPfad = [...pfad, feld.name]

  /*
   * Die Sprache hängt am Feld, nicht am Blatt.
   *
   * Ein übersetzbares Feld wird in der gewählten Sprache gelesen und
   * geschrieben. Alles andere — Anschrift, IBAN, Stundensatz — gibt es nur
   * einmal; es bleibt sichtbar und bearbeitbar, geht aber immer in die
   * deutsche Fassung. Früher verschwand es stattdessen aus der Ansicht, und
   * wer eine Übersetzung pflegte, sah die halbe Seite nicht mehr.
   */
  const jeSprache = erbt || feld.uebersetzt === true
  const ziel: Locale = jeSprache ? sprache : 'de'
  const wert = tiefLesen(werte[ziel], eigenerPfad)
  const nurEinmal = !jeSprache && sprache !== 'de'

  if (feld.art === 'haken') {
    return (
      <label className="buero-feld buero-haken">
        <input
          type="checkbox"
          checked={Boolean(wert)}
          onChange={(e) => setzen(ziel, eigenerPfad, e.target.checked)}
        />
        <span>{feld.label}</span>
        {nurEinmal && <span className="buero-unterzeile"> — gilt für alle Sprachen</span>}
        {feld.hinweis && <span className="buero-unterzeile"> — {feld.hinweis}</span>}
      </label>
    )
  }

  if (feld.art === 'gestaltet') {
    return (
      <div className="buero-feld">
        <span>{feld.label}</span>
        {/*
          * Das Schreibfeld der Mails, hier für die Signatur: Was man beim
          * Schreiben gestalten kann, soll auch die Grußformel können. Ältere
          * Klartext-Signaturen werden beim Öffnen zu Absätzen; leer gemachte
          * werden wieder als leer gespeichert, damit der Rückfall auf
          * Absendername und Kontaktdaten greift.
          */}
        <Schreibfeld
          wert={klartextAlsHtml((wert as string) ?? '')}
          aendern={(html) => setzen(ziel, eigenerPfad, htmlHatInhalt(html) ? html : '')}
          platzhalter="Mit freundlichen Grüßen …"
        />
        {feld.hinweis && <span className="buero-unterzeile">{feld.hinweis}</span>}
      </div>
    )
  }

  return (
    <label className="buero-feld">
      <span>
        {feld.label}
        {feld.pflicht ? ' *' : ''}
        {nurEinmal && <span className="buero-unterzeile"> · gilt für alle Sprachen</span>}
      </span>

      {feld.art === 'absatz' ? (
        <textarea
          rows={3}
          value={(wert as string) ?? ''}
          onChange={(e) => setzen(ziel, eigenerPfad, e.target.value)}
        />
      ) : feld.art === 'auswahl' ? (
        <select
          value={(wert as string) ?? ''}
          onChange={(e) => setzen(ziel, eigenerPfad, e.target.value)}
        >
          <option value="">— bitte wählen —</option>
          {(feld.optionen ?? []).map((o) => (
            <option key={o.wert} value={o.wert}>
              {o.text}
            </option>
          ))}
        </select>
      ) : feld.geheim ? (
        <Geheimfeld wert={(wert as string) ?? ''} aendern={(neu) => setzen(ziel, eigenerPfad, neu)} />
      ) : (
        /*
         * Zahlen bekommen ein eigenes Feld, und das ist hier besonders
         * wichtig: Hinter „Zahl" stecken der Stundensatz, der Steuersatz und
         * der Wunschaufschlag. Mit dem alten `type="number"` ließ sich kein
         * Komma eintippen — ein französischer Satz von 5,5 % war schlicht
         * nicht einzugeben, und ein halb getipptes „19," stand als „NaN" im
         * Feld.
         */
        feld.art === 'zahl' ? (
          <Zahleingabe
            wert={typeof wert === 'number' ? wert : null}
            aendern={(neu) => setzen(ziel, eigenerPfad, neu)}
          />
        ) : (
          <input
            type={feld.art === 'email' ? 'email' : 'text'}
            value={wert == null ? '' : String(wert)}
            onChange={(e) => setzen(ziel, eigenerPfad, e.target.value)}
          />
        )
      )}

      {feld.hinweis && <span className="buero-unterzeile">{feld.hinweis}</span>}
    </label>
  )
}

/**
 * Die Einträge einer Liste — ohne Überschrift.
 *
 * Ohne Titel, weil es zwei Stellen gibt, die ihn setzen: innerhalb eines
 * Bereichs steht er als Zwischenüberschrift, als eigener Bereich schon oben
 * auf dem Blatt. Trüge der Block ihn selbst, stünde er dort zweimal.
 */
function Listenblock({
  feld,
  pfad,
  werte,
  setzen,
  oeffnen,
  sprache,
  erbt,
}: {
  feld: FeldBeschreibung
  pfad: string[]
  werte: AlleWerte
  setzen: (sprache: Locale, pfad: string[], wert: unknown) => void
  oeffnen: (weg: string[]) => void
  sprache: Locale
  erbt: boolean
}) {
  const eigenerPfad = [...pfad, feld.name]
  // Eine übersetzte Liste hat je Sprache eigene Einträge — die häufigen Fragen
  // etwa können auf Französisch andere sein als auf Deutsch.
  const ziel: Locale = erbt || feld.uebersetzt === true ? sprache : 'de'
  const wert = tiefLesen(werte[ziel], eigenerPfad)
  const eintraege = Array.isArray(wert) ? (wert as Werte[]) : []
  const unterfelder = feld.felder ?? []

  return (
    <>
      <div className="buero-liste" style={{ marginTop: '.6rem' }}>
        {eintraege.length === 0 ? (
          <div className="buero-leer">Noch nichts eingetragen.</div>
        ) : (
          eintraege.map((eintrag, i) => (
            <button
              key={i}
              type="button"
              className="buero-zeile buero-zeile-knopf"
              onClick={() => oeffnen([...eigenerPfad, String(i)])}
            >
              <div className="buero-zeile-haupt">
                <div className="buero-zeile-titel">{eintragTitel(eintrag, unterfelder, i + 1)}</div>
                <div className="buero-zeile-neben">{eintragNeben(eintrag, unterfelder)}</div>
              </div>
              <span className="buero-marker">öffnen</span>
            </button>
          ))
        )}
      </div>

      <button
        type="button"
        className="buero-knopf leise schmal"
        style={{ marginTop: '.8rem' }}
        onClick={() => {
          // Gleich öffnen: Wer „Hinzufügen" tippt, will tippen, nicht eine
          // neue leere Zeile ansehen
          setzen(ziel, eigenerPfad, [...eintraege, {}])
          oeffnen([...eigenerPfad, String(eintraege.length)])
        }}
      >
        Hinzufügen
      </button>
    </>
  )
}

/**
 * Die Felder einer Ebene — einfache direkt, Listen als Liste, Gruppen
 * eingerückt darunter.
 *
 * Gruppen bekommen **keine** eigene Ebene: Eine Gruppe in einer Gruppe ist
 * eine Ordnungshilfe (etwa „DKIM" innerhalb von E-Mail), kein eigener Ort. Sie
 * dafür anzutippen wäre ein Klick für nichts.
 */
function Ebene({
  felder,
  pfad,
  werte,
  setzen,
  oeffnen,
  sprache,
  erbt,
}: {
  felder: FeldBeschreibung[]
  pfad: string[]
  werte: AlleWerte
  setzen: (sprache: Locale, pfad: string[], wert: unknown) => void
  oeffnen: (weg: string[]) => void
  sprache: Locale
  erbt: boolean
}) {
  return (
    <>
      {felder.map((feld) => {
        const eigenerPfad = [...pfad, feld.name]

        if (feld.art === 'liste') {
          return (
            <section key={feld.name} style={{ marginBottom: '1.4rem' }}>
              <h3 className="buero-zeile-titel">{feld.label}</h3>
              {feld.hinweis && <p className="buero-unterzeile">{feld.hinweis}</p>}
              <Listenblock
                feld={feld}
                pfad={pfad}
                werte={werte}
                setzen={setzen}
                oeffnen={oeffnen}
                sprache={sprache}
                erbt={erbt}
              />
            </section>
          )
        }

        if (feld.art === 'gruppe') {
          return (
            <fieldset key={feld.name} className="buero-karte" style={{ marginBottom: '1rem' }}>
              <legend className="buero-zeile-titel">{feld.label}</legend>
              {feld.hinweis && <p className="buero-unterzeile">{feld.hinweis}</p>}
              <Ebene
                felder={feld.felder ?? []}
                pfad={eigenerPfad}
                werte={werte}
                setzen={setzen}
                oeffnen={oeffnen}
                sprache={sprache}
                erbt={erbt || feld.uebersetzt === true}
              />
            </fieldset>
          )
        }

        return (
          <Feld
            key={feld.name}
            feld={feld}
            pfad={pfad}
            werte={werte}
            setzen={setzen}
            sprache={sprache}
            erbt={erbt}
          />
        )
      })}
    </>
  )
}

const SPRACHNAMEN: Record<Locale, string> = {
  de: 'Deutsch',
  fr: 'Französisch',
  en: 'Englisch',
}

export function EinstellungenFormular({
  bereich,
  titel,
}: {
  bereich: 'betrieb' | 'integrationen'
  titel: string
}) {
  const [felder, setFelder] = useState<FeldBeschreibung[] | null>(null)
  const [werte, setWerte] = useState<AlleWerte>(LEERE_WERTE)
  /** Der Stand beim Öffnen — daran wird gemessen, was wirklich geändert wurde. */
  const [urspruenglich, setUrspruenglich] = useState<AlleWerte>(LEERE_WERTE)
  const [meldung, setMeldung] = useState<string | null>(null)
  const [laeuft, setLaeuft] = useState(false)
  /** Wo man gerade ist: [] = Übersicht, ['email'] = Bereich, ['mailboxes','0'] = Eintrag */
  const [weg, setWeg] = useState<string[]>([])
  /**
   * Welche Sprachfassung gerade bearbeitet wird — gilt nur innerhalb eines
   * geöffneten Eintrags. Beim Zurückgehen fällt sie auf Deutsch, sonst stünde
   * man im nächsten Eintrag unversehens auf Französisch.
   */
  const [sprache, setSprache] = useState<Locale>('de')

  useEffect(() => {
    let abgebrochen = false
    void (async () => {
      try {
        const antwort = await fetch(`/api/office/einstellungen?bereich=${bereich}`, {
          credentials: 'include',
        })
        if (!antwort.ok) throw new Error('nicht erreichbar')
        const daten = await antwort.json()
        if (abgebrochen) return
        const alle: AlleWerte = { ...LEERE_WERTE, ...(daten.werte ?? {}) }
        setFelder(daten.felder)
        setWerte(alle)
        setUrspruenglich(alle)
      } catch {
        if (!abgebrochen) setMeldung('Einstellungen brauchen eine Verbindung.')
      }
    })()
    return () => {
      abgebrochen = true
    }
  }, [bereich])

  const setzen = useCallback((wohin: Locale, pfad: string[], wert: unknown) => {
    setWerte((v) => ({ ...v, [wohin]: tiefSetzen(v[wohin], pfad, wert) as Werte }))
    setMeldung(null)
  }, [])

  /** Zurück zur Übersicht — und zurück auf Deutsch */
  const zurueck = useCallback((neuerWeg: string[]) => {
    setWeg(neuerWeg)
    setSprache('de')
    setMeldung(null)
  }, [])

  /** Das Feld, auf das der Weg zeigt — und der Datenpfad dorthin */
  const ziel = useMemo(() => {
    if (!felder || weg.length === 0) return null
    const oben = felder.find((f) => f.name === weg[0])
    if (!oben) return null
    // Zweiter Schritt ist immer eine Nummer: der Eintrag einer Liste
    const eintrag = weg.length > 1 ? weg[1] : null
    return { feld: oben, eintrag }
  }, [felder, weg])

  /**
   * Die Sprachwahl über einem geöffneten Eintrag — und nur dort, wo es etwas
   * zu übersetzen gibt.
   */
  const sprachwahl =
    ziel && hatUebersetzbares(ziel.feld) ? (
      <div className="buero-reiter" role="tablist">
        {locales.map((l) => (
          <button
            key={l}
            type="button"
            role="tab"
            aria-selected={l === sprache}
            onClick={() => {
              setSprache(l)
              setMeldung(null)
            }}
          >
            {SPRACHNAMEN[l]}
          </button>
        ))}
      </div>
    ) : null

  async function speichern() {
    /*
     * Nur das Geänderte schicken, nicht das ganze Blatt.
     *
     * Sonst überschriebe ein Speichern hier still, was jemand anderes in der
     * Zwischenzeit an einer anderen Stelle geändert hat — und dieses Formular
     * kann lange offen stehen. Payload übernimmt, was mitkommt, und lässt den
     * Rest, wie er ist.
     */
    const geaendert: Partial<Record<Locale, Werte>> = {}
    for (const l of locales) {
      const proSprache: Werte = {}
      for (const schluessel of Object.keys(werte[l])) {
        if (JSON.stringify(werte[l][schluessel]) !== JSON.stringify(urspruenglich[l][schluessel])) {
          proSprache[schluessel] = werte[l][schluessel]
        }
      }
      if (Object.keys(proSprache).length) geaendert[l] = proSprache
    }

    if (!Object.keys(geaendert).length) {
      setMeldung('Nichts geändert.')
      return
    }

    setLaeuft(true)
    setMeldung(null)
    try {
      const antwort = await fetch('/api/office/einstellungen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ bereich, werte: geaendert }),
      })
      if (antwort.ok) {
        setUrspruenglich(werte)
        setMeldung('Gespeichert.')
      } else {
        /*
         * Sagen, woran es lag. „Das hat nicht geklappt." ist beim Anlegen
         * eines Postfachs mit fünf Pflichtfeldern keine Auskunft, sondern
         * ein Ratespiel — Payload weiß genau, welches Feld fehlt.
         */
        const grund = await antwort
          .json()
          .then((d: { grund?: string }) => d?.grund)
          .catch(() => undefined)
        setMeldung(grund ? `Das hat nicht geklappt — ${grund}` : 'Das hat nicht geklappt.')
      }
    } catch {
      setMeldung('Einstellungen brauchen eine Verbindung.')
    } finally {
      setLaeuft(false)
    }
  }

  const fussleiste = (
    <Fussleiste>
      <button type="button" className="buero-knopf" disabled={laeuft} onClick={speichern}>
        {laeuft ? 'speichert …' : 'Speichern'}
      </button>
    </Fussleiste>
  )

  if (!felder) {
    return (
      <>
        <h2>{titel}</h2>
        <div className="buero-leer">{meldung ?? 'wird geholt …'}</div>
      </>
    )
  }

  // ── Ein Listeneintrag, z.B. ein einzelnes Postfach ─────────────────────────
  if (ziel?.eintrag != null) {
    const unterfelder = ziel.feld.felder ?? []
    const datenPfad = [ziel.feld.name, ziel.eintrag]
    // Eine übersetzte Liste hat je Sprache eigene Einträge
    const listenSprache: Locale = ziel.feld.uebersetzt ? sprache : 'de'
    const eintrag = (tiefLesen(werte[listenSprache], datenPfad) ?? {}) as Werte
    const alle = (tiefLesen(werte[listenSprache], [ziel.feld.name]) ?? []) as Werte[]

    return (
      <>
        <button type="button" className="buero-ruecken" onClick={() => setWeg([ziel.feld.name])}>
          ← {ziel.feld.label}
        </button>
        <h2 style={{ marginTop: '.5rem' }}>
          {eintragTitel(eintrag, unterfelder, Number(ziel.eintrag) + 1)}
        </h2>
        {sprachwahl}
        <Rueckmeldung text={meldung} />

        <div className="buero-karte">
          <Ebene
            felder={unterfelder}
            pfad={datenPfad}
            werte={werte}
            setzen={setzen}
            oeffnen={setWeg}
            sprache={sprache}
            erbt={ziel.feld.uebersetzt === true}
          />
          <button
            type="button"
            className="buero-knopf schmal gefahr"
            style={{ marginTop: '.8rem' }}
            onClick={() => {
              if (!window.confirm('Diesen Eintrag entfernen?')) return
              setzen(
                listenSprache,
                [ziel.feld.name],
                alle.filter((_, k) => k !== Number(ziel.eintrag)),
              )
              setWeg([ziel.feld.name])
            }}
          >
            Entfernen
          </button>
        </div>

        {fussleiste}
      </>
    )
  }

  // ── Ein Bereich, z.B. „E-Mail" oder „Postfächer" ───────────────────────────
  if (ziel) {
    return (
      <>
        <button type="button" className="buero-ruecken" onClick={() => zurueck([])}>
          ← {titel}
        </button>
        <h2 style={{ marginTop: '.5rem' }}>{ziel.feld.label}</h2>
        {sprachwahl}
        <Rueckmeldung text={meldung} />

        {ziel.feld.art === 'liste' ? (
          <>
            {ziel.feld.hinweis && <p className="buero-unterzeile">{ziel.feld.hinweis}</p>}
            <Listenblock
              feld={ziel.feld}
              pfad={[]}
              werte={werte}
              setzen={setzen}
              oeffnen={setWeg}
              sprache={sprache}
              erbt={false}
            />
          </>
        ) : (
          <div className="buero-karte">
            <Ebene
              felder={ziel.feld.felder ?? [ziel.feld]}
              pfad={ziel.feld.art === 'gruppe' ? [ziel.feld.name] : []}
              werte={werte}
              setzen={setzen}
              oeffnen={setWeg}
              sprache={sprache}
              erbt={ziel.feld.art === 'gruppe' && ziel.feld.uebersetzt === true}
            />
          </div>
        )}

        {fussleiste}
      </>
    )
  }

  // ── Die Übersicht ──────────────────────────────────────────────────────────
  return (
    <>
      <h2>{titel}</h2>
      <Rueckmeldung text={meldung} />

      <div className="buero-liste">
        {felder.map((feld) => {
          const wert = tiefLesen(werte.de, [feld.name])
          const gefuellt = istGefuellt(wert)
          const anzahl = Array.isArray(wert) ? wert.length : null

          /*
           * Bei allem Übersetzbaren steht statt „eingerichtet" der Stand je
           * Sprache: DE FR EN, gefüllte hervorgehoben. Das ist der Ersatz für
           * den alten Schalter oben — und er sagt mehr als der: Man sieht,
           * **wo** noch etwas fehlt, ohne dreimal umzuschalten.
           */
          const sprachen = hatUebersetzbares(feld)
            ? locales.map((l) => ({
                sprache: l,
                da: istGefuellt(uebersetzbarerTeil(feld, tiefLesen(werte[l], [feld.name]))),
              }))
            : null

          return (
            <button
              key={feld.name}
              type="button"
              className="buero-zeile buero-zeile-knopf"
              onClick={() => zurueck([feld.name])}
            >
              <div className="buero-zeile-haupt">
                <div className="buero-zeile-titel">{feld.label}</div>
                {feld.hinweis && (
                  <div className="buero-zeile-neben knapp">{feld.hinweis}</div>
                )}
              </div>
              {sprachen ? (
                <span className="buero-sprachstand" aria-label="Gepflegte Sprachen">
                  {sprachen.map((e) => (
                    <span key={e.sprache} className={e.da ? 'da' : undefined}>
                      {e.sprache.toUpperCase()}
                    </span>
                  ))}
                </span>
              ) : (
                /*
                 * Ein Wort dazu, ob hier etwas steht. Das ist der eigentliche
                 * Grund für die Übersicht: Man sieht auf einen Blick, was
                 * eingerichtet ist, statt sieben Bereiche zu öffnen, um es
                 * herauszufinden.
                 */
                <span className={`buero-marker${gefuellt ? ' gut' : ''}`}>
                  {anzahl != null
                    ? anzahl === 0
                      ? 'keine'
                      : anzahl === 1
                        ? '1 Eintrag'
                        : `${anzahl} Einträge`
                    : gefuellt
                      ? 'eingerichtet'
                      : 'leer'}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {fussleiste}
    </>
  )
}
