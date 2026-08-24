'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'

import { useDateiablage } from '../../lib/buero/dateiablage'
import { ordnernameGueltig } from '../../lib/ordnerpfad'
import { EmpfaengerFeld } from './EmpfaengerFeld'
import { signaturAlsHtml } from '../../lib/signaturHtml'
import { Schreibfeld } from './Schreibfeld'
import { WischZeile } from './WischZeile'
import { Rueckmeldung } from './Rueckmeldung'

type Fach = { id: string; label: string; address: string; signatur?: string | null }
type Ordner = { pfad: string; name: string; ungelesen: number; art: string; trenner: string }
type Kopfzeile = {
  uid: number
  betreff: string
  von: string
  vonAdresse: string
  an: string
  datum: string | null
  gelesen: boolean
  markiert: boolean
  anhaenge: boolean
}
type Nachricht = Kopfzeile & {
  text: string
  html: string | null
  messageId?: string
  antwortAn?: string
  dateien: { name: string; groesse: number; typ: string }[]
}

/**
 * Ein Entwurf trägt HTML, nicht mehr bloß Text.
 *
 * `text` bleibt als Rückfallebene: Lädt das Schreibfeld nicht, wird dort
 * einfacher Text getippt, und der Server setzt ihn wie früher auf den
 * Briefbogen.
 */
type Entwurf = {
  an: string
  /* Kopie und Blindkopie stehen im Entwurf, auch wenn sie meist leer sind —
     sonst ginge beim Aufklappen und Zuklappen verloren, was schon getippt war */
  cc: string
  bcc: string
  betreff: string
  text: string
  html: string
  antwortAufMessageId?: string
}

const uhr = (d: Date) => d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })

/**
 * Wann die Nachricht kam — so, wie ein Mensch es sagen würde.
 *
 * In der Liste stand bisher stur das Datum, auch bei einer Mail von vor zwei
 * Stunden. Wer nachsieht, ob etwas Neues da ist, rechnet dann im Kopf
 * „22.08. — ist das heute?" nach. Je näher der Zeitpunkt, desto genauer die
 * Angabe: heute die Uhrzeit, gestern der Tag samt Uhrzeit, in der laufenden
 * Woche der Wochentag, älteres das Datum.
 *
 * Die Grenze bei sechs Tagen ist Absicht: Bei genau sieben stünde „Sa" für
 * einen Samstag vor einer Woche neben dem morgigen — der Wochentag wäre
 * mehrdeutig, und mehrdeutig ist schlechter als lang.
 */
const zeit = (v: string | null) => {
  if (!v) return ''
  const d = new Date(v)
  const jetzt = new Date()
  const tage = Math.round(
    (new Date(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate()).getTime() -
      new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) /
      86_400_000,
  )
  if (tage === 0) return uhr(d)
  if (tage === 1) return `Gestern ${uhr(d)}`
  if (tage > 1 && tage < 7)
    return `${d.toLocaleDateString('de-DE', { weekday: 'short' })} ${uhr(d)}`
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

/**
 * Der vollständige Zeitpunkt — für die geöffnete Nachricht, für das Zitat in
 * einer Antwort und als Tooltip in der Liste.
 *
 * „Gestern" ist in einem zitierten „Am … schrieb …" wertlos: Die Antwort wird
 * gelesen, wenn gestern längst vorgestern ist.
 */
const zeitVoll = (v: string | null) => {
  if (!v) return ''
  const d = new Date(v)
  return `${d.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })}, ${uhr(d)}`
}

const groesse = (b: number) =>
  b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`

/**
 * Die Zeichen für die schmalen Knöpfe.
 *
 * Bewusst als Striche gezeichnet und nicht als Schriftzeichen oder Emoji:
 * Emoji sehen auf jedem Gerät anders aus und tragen Farben, die nichts
 * bedeuten. Diese hier folgen der Schriftfarbe des Knopfes und drehen im
 * dunklen Thema von selbst mit.
 */
const ZEICHEN: Record<string, React.ReactNode> = {
  neuLaden: <path d="M3 10a7 7 0 0 1 12-4.9L18 8M18 3v5h-5M18 10a7 7 0 0 1-12 4.9L3 12M3 17v-5h5" />,
  ungelesen: <path d="M2 5.5h16v10H2zM2 6l8 5.5L18 6" />,
  markieren: (
    <path d="M10 2.5l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L2.2 8.2l5.4-.8z" />
  ),
  verschieben: <path d="M2 5.5h5.5l1.5 2H18v9H2zM2 5.5V16" />,
  loeschen: <path d="M3 5.5h14M8 5.5V3h4v2.5M5 5.5l1 11h8l1-11M8.5 8.5v5M11.5 8.5v5" />,
  zurueck: <path d="M12 4l-6 6 6 6" />,
  antworten: <path d="M8 5L3 10l5 5M3 10h7a6 6 0 0 1 6 6v1" />,
  mehr: <path d="M4.5 10h.01M10 10h.01M15.5 10h.01" />,
  faehnchen: <path d="M5 17V3.5h9l-2 3 2 3H5" />,
  plus: <path d="M10 4v12M4 10h12" />,
}

function Zeichen({ was }: { was: keyof typeof ZEICHEN }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      {ZEICHEN[was]}
    </svg>
  )
}

// Die Aufbereitung der Signatur liegt jetzt in lib/signaturHtml.ts — das
// Versandfenster und der Newsletter brauchen dieselben Regeln.

/** Kurzer, sprechender Name statt des rohen IMAP-Pfads */
function ordnerName(o: Ordner): string {
  const nachArt: Record<string, string> = {
    '\\Inbox': 'Posteingang',
    '\\Sent': 'Gesendet',
    '\\Drafts': 'Entwürfe',
    '\\Trash': 'Papierkorb',
    '\\Junk': 'Spam',
    '\\Archive': 'Archiv',
  }
  if (o.pfad.toUpperCase() === 'INBOX') return 'Posteingang'
  return nachArt[o.art] ?? o.name
}

/**
 * Postfach im Büro.
 *
 * Bewusst zwei Ansichten statt drei Spalten: Liste oder Nachricht. Am Handy
 * ist das die einzige Aufteilung, die ohne Zoomen benutzbar bleibt, und am
 * Rechner stört sie nicht.
 *
 * Fremdes HTML wird in einem abgeschotteten Rahmen angezeigt — ohne Skripte
 * und ohne Zugriff auf die Seite. Eine Mail darf nicht mehr dürfen als
 * hübsch aussehen.
 */
export function Postfach({ vorgabe }: { vorgabe?: Entwurf | null }) {
  const [faecher, setFaecher] = useState<Fach[]>([])
  const [fach, setFach] = useState<string | null>(null)
  const [ordner, setOrdner] = useState('INBOX')
  const [ordnerAlle, setOrdnerAlle] = useState<Ordner[]>([])
  const [liste, setListe] = useState<Kopfzeile[]>([])
  const [offen, setOffen] = useState<Nachricht | null>(null)
  const [entwurf, setEntwurf] = useState<Entwurf | null>(vorgabe ?? null)
  /* Zugeklappt, solange nichts drinsteht: Die meisten Mails haben keine Kopie,
     und zwei leere Felder über der Nachricht sind zwei Zeilen Rauschen. */
  const [kopieOffen, setKopieOffen] = useState(false)
  const [laeuft, setLaeuft] = useState(true)
  const [meldung, setMeldung] = useState<string | null>(null)
  const [nichtEingerichtet, setNichtEingerichtet] = useState(false)
  /** Offen, während ein neuer Ordner benannt wird — leer heißt: zu */
  const [neuerOrdner, setNeuerOrdner] = useState<string | null>(null)
  /** Zeile, deren „⋯"-Menü gerade offen ist — zum Verschieben ohne Öffnen */
  const [mehrOffen, setMehrOffen] = useState<number | null>(null)
  /** Dasselbe in der geöffneten Nachricht: Markieren und Verschieben */
  const [detailMehr, setDetailMehr] = useState(false)
  /** Was an die Mail soll, die gerade geschrieben wird */
  const [anhaenge, setAnhaenge] = useState<File[]>([])
  const ablageBereich = useRef<HTMLDivElement>(null)
  /** Anhängen statt ersetzen: Wer zweimal zieht, meint beides. */
  const nimmDateien = (neue: File[]) => {
    if (neue.length) setAnhaenge((v) => [...v, ...neue])
  }
  const ablage = useDateiablage(ablageBereich, nimmDateien, Boolean(entwurf))

  const laden = useCallback(
    async (fachId?: string | null, ordnerPfad?: string) => {
      setLaeuft(true)
      setMeldung(null)
      try {
        const p = new URLSearchParams()
        if (fachId) p.set('fach', fachId)
        if (ordnerPfad) p.set('ordner', ordnerPfad)
        const res = await fetch(`/api/office/post?${p}`, { credentials: 'include' })
        const j = await res.json()
        if (!res.ok) {
          setMeldung(
            j?.error === 'postfach-nicht-erreichbar'
              ? 'Das Postfach ist gerade nicht erreichbar. Zugangsdaten prüfen?'
              : 'Das hat nicht geklappt.',
          )
          return
        }
        if (j.fehlt === 'kein-postfach') {
          setNichtEingerichtet(true)
          return
        }
        setNichtEingerichtet(false)
        setFaecher(j.faecher ?? [])
        setFach(j.fach)
        setListe(j.nachrichten ?? [])
        if (j.ordnerListe) setOrdnerAlle(j.ordnerListe)
        if (j.ordner) setOrdner(j.ordner)
      } catch {
        setMeldung('Verbindung fehlgeschlagen.')
      } finally {
        setLaeuft(false)
      }
    },
    [],
  )

  useEffect(() => {
    void laden()
  }, [laden])


  /*
   * Die Signatur kommt erst, wenn die Postfächer da sind.
   *
   * Beim Aufruf über `/office/post?an=…` steht der Entwurf schon, bevor der
   * Server geantwortet hat — die Signatur gehört aber zum Postfach und ist zu
   * dem Zeitpunkt noch unbekannt. Nachgelegt wird nur in einen leeren Rumpf:
   * Was jemand schon getippt hat, wird nicht angefasst.
   */
  useEffect(() => {
    if (!entwurf || entwurf.html.trim()) return
    const signatur = signaturAlsHtml(faecher.find((f) => f.id === fach)?.signatur)
    if (signatur) setEntwurf({ ...entwurf, html: signatur })
    // Nur an den Postfächern hängen — sonst liefe es bei jedem Buchstaben
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [faecher, fach])

  async function oeffnen(uid: number) {
    setLaeuft(true)
    try {
      const p = new URLSearchParams({ uid: String(uid), ordner })
      if (fach) p.set('fach', fach)
      const res = await fetch(`/api/office/post?${p}`, { credentials: 'include' })
      const j = await res.json()
      if (!res.ok) {
        setMeldung('Die Nachricht ließ sich nicht öffnen.')
        return
      }
      // Das „⋯"-Menü gehört zu der Nachricht, an der es geöffnet wurde —
      // beim Wechsel wäre es sonst über der nächsten noch offen.
      setDetailMehr(false)
      setOffen(j.nachricht)
      setListe((v) => v.map((n) => (n.uid === uid ? { ...n, gelesen: true } : n)))
    } finally {
      setLaeuft(false)
    }
  }

  async function aktion(uid: number, was: string) {
    const res = await fetch('/api/office/post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ aktion: was, uid, ordner, fach }),
    })
    if (!res.ok) {
      /*
       * Der Grund vom Server, wenn er einen nennt.
       *
       * Solange hier nur „hat nicht geklappt" stand, war der häufigste Fall
       * unerklärlich: Fehlt der Ordner „Papierkorb", blieb die Mail liegen,
       * und niemand kam darauf, in den Postfach-Einstellungen nachzusehen.
       */
      const grund = await res
        .json()
        .then((j) => (typeof j?.grund === 'string' ? j.grund : null))
        .catch(() => null)
      setMeldung(grund ?? 'Das hat nicht geklappt.')
      return
    }
    if (was === 'loeschen') {
      setListe((v) => v.filter((n) => n.uid !== uid))
      setOffen(null)
    } else if (was === 'ungelesen' || was === 'gelesen') {
      setListe((v) => v.map((n) => (n.uid === uid ? { ...n, gelesen: was === 'gelesen' } : n)))
      setOffen(null)
    } else if (was === 'markiert' || was === 'unmarkiert') {
      setListe((v) =>
        v.map((n) => (n.uid === uid ? { ...n, markiert: was === 'markiert' } : n)),
      )
    }
  }

  async function verschieben(uid: number, ziel: string) {
    const res = await fetch('/api/office/post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ aktion: 'verschieben', uid, ordner, ziel, fach }),
    })
    if (!res.ok) {
      setMeldung('Verschieben hat nicht geklappt.')
      return
    }
    // Aus dieser Liste ist sie weg — sie liegt jetzt woanders
    setListe((v) => v.filter((n) => n.uid !== uid))
    setOffen(null)
    const zielName = ordnerAlle.find((o) => o.pfad === ziel)
    setMeldung(`Verschoben nach ${zielName ? ordnerName(zielName) : ziel}.`)
  }

  async function ordnerAnlegen(name: string) {
    if (!ordnernameGueltig(name)) {
      setMeldung('Der Name darf keinen Punkt und keinen Schrägstrich enthalten.')
      return
    }
    const hier = ordnerAlle.find((o) => o.pfad === ordner)
    const res = await fetch('/api/office/post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      // Der Server baut den Pfad selbst — hier geht nur mit, woraus
      body: JSON.stringify({
        aktion: 'ordner-anlegen',
        name,
        ordner,
        trenner: hier?.trenner || '/',
        fach,
      }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) {
      setMeldung(
        j?.error === 'name-ungueltig'
          ? 'Der Name darf keinen Punkt und keinen Schrägstrich enthalten.'
          : 'Der Ordner ließ sich nicht anlegen.',
      )
      return
    }
    setNeuerOrdner(null)
    await laden(fach, ordner)
    setMeldung(`Ordner „${name}" angelegt.`)
  }

  async function senden() {
    if (!entwurf?.an.trim()) {
      setMeldung('Eine Empfängeradresse wird gebraucht.')
      return
    }
    /*
     * Leere Mails gar nicht erst losschicken. Quill hinterlässt beim Leeren
     * ein `<p><br></p>` — wer nur darauf prüft, ob etwas dasteht, schickt
     * genau das raus.
     */
    const inhalt = (entwurf.html || entwurf.text).replace(/<[^>]+>/g, '').replace(/\s|&nbsp;/g, '')
    if (!inhalt) {
      setMeldung('Die Nachricht ist leer.')
      return
    }
    setLaeuft(true)
    try {
      /*
       * Ohne Anhang bleibt es bei JSON — dasselbe wie bisher. Erst wenn
       * Dateien dabei sind, wird ein Formular daraus: Der Browser hat sie
       * ohnehin schon, und als base64 in einem JSON wären sie ein Drittel
       * größer und lägen zusätzlich als Zeichenkette im Speicher, bevor
       * überhaupt jemand entschieden hat, ob sie durchpassen.
       */
      const res = anhaenge.length
        ? await (() => {
            const formular = new FormData()
            formular.append('daten', JSON.stringify({ aktion: 'senden', fach, ...entwurf }))
            for (const datei of anhaenge) formular.append('dateien', datei)
            return fetch('/api/office/post', {
              method: 'POST',
              credentials: 'include',
              body: formular,
            })
          })()
        : await fetch('/api/office/post', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ aktion: 'senden', fach, ...entwurf }),
          })
      const daten = (await res.json().catch(() => null)) as
        | { kopie?: boolean; error?: string; grenze?: number }
        | null
      if (!res.ok) {
        setMeldung(
          daten?.error === 'anhaenge-zu-gross'
            ? `Die Anhänge sind zusammen zu groß (höchstens ${Math.round((daten.grenze ?? 0) / 1024 / 1024)} MB). Bei größeren Dateien ist ein Link der bessere Weg.`
            : 'Die Mail ging nicht raus.',
        )
        return
      }
      setEntwurf(null)
      setAnhaenge([])
      // Verschickt ist verschickt — aber wenn die Kopie fehlt, sucht man sie
      // später vergeblich im eigenen Ordner und hält die Mail für nie geschrieben
      setMeldung(
        daten?.kopie === false
          ? 'Gesendet — aber die Kopie liegt nicht im Ordner „Gesendet". Bitte den Ordnernamen unter Einstellungen prüfen.'
          : 'Gesendet.',
      )
    } catch {
      setMeldung('Verbindung fehlgeschlagen.')
    } finally {
      setLaeuft(false)
    }
  }

  /** Die Signatur des gerade gewählten Postfachs, als HTML für das Schreibfeld */
  function signaturJetzt(): string {
    return signaturAlsHtml(faecher.find((f) => f.id === fach)?.signatur)
  }

  function antworten(n: Nachricht) {
    /*
     * Das Zitat kommt als Blockzitat, nicht als „> "-Zeilen.
     *
     * Die Größer-Zeichen sind eine Krücke aus der Zeit reiner Textmails; in
     * einer gestalteten Mail sehen sie aus wie ein Fehler. Ein eingerücktes,
     * graues Blockzitat sagt dasselbe und wird von jedem Mailprogramm richtig
     * dargestellt.
     */
    const zitat = n.text
      .split('\n')
      .slice(0, 40)
      .map((z) => z.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'))
      .join('<br>')

    setEntwurf({
      an: n.antwortAn || n.vonAdresse,
      cc: '',
      bcc: '',
      betreff: n.betreff.startsWith('Re:') ? n.betreff : `Re: ${n.betreff}`,
      text: '',
      html:
        signaturJetzt() +
        `<p><br></p><p style="color: #666666">Am ${zeitVoll(n.datum)} schrieb ${n.von}:</p>` +
        `<blockquote style="color: #666666">${zitat}</blockquote>`,
      antwortAufMessageId: n.messageId,
    })
    setOffen(null)
  }

  if (nichtEingerichtet) {
    return (
      <div className="buero-karte">
        <p>
          Es ist noch kein Postfach eingerichtet. In der Website-Verwaltung unter{' '}
          <strong>Verwaltung → Integrationen → Postfächer</strong> Server, Benutzername und Passwort
          eintragen — danach steht der Posteingang hier.
        </p>
      </div>
    )
  }

  // ── Schreiben ─────────────────────────────────────────────────────────────
  if (entwurf) {
    return (
      <div className="buero-karte">
        <Rueckmeldung text={meldung} />
        {/* Kein `label` um das Feld: Es bringt eine eigene Liste mit, und ein
            Tipp in ein Label geht ans Eingabefeld statt auf den Vorschlag —
            derselbe Grund wie beim Schreibfeld weiter unten. */}
        <div className="buero-feld">
          <span>An</span>
          <EmpfaengerFeld
            wert={entwurf.an}
            aendern={(an) => setEntwurf((v) => (v ? { ...v, an } : v))}
          />
        </div>
        {/*
          * Kopie und Blindkopie hinter einem Aufklapper.
          *
          * Sie sind selten und sollen trotzdem in einem Griff erreichbar sein.
          * Steht schon etwas drin — beim Antworten oder aus einem Entwurf —,
          * geht der Aufklapper von selbst auf: Ein Empfänger, den man nicht
          * sieht, ist der gefährlichste von allen.
          */}
        <button
          type="button"
          className="buero-aufklapper"
          aria-expanded={kopieOffen || Boolean(entwurf.cc || entwurf.bcc)}
          onClick={() => setKopieOffen((v) => !v)}
        >
          {kopieOffen || entwurf.cc || entwurf.bcc ? '⌄' : '›'} Kopie (CC) & Blindkopie (BCC)
        </button>

        {(kopieOffen || entwurf.cc || entwurf.bcc) && (
          <>
            <div className="buero-feld">
              <span>Kopie (CC)</span>
              <EmpfaengerFeld
                wert={entwurf.cc}
                aendern={(cc) => setEntwurf((v) => (v ? { ...v, cc } : v))}
              />
            </div>
            <div className="buero-feld">
              <span>Blindkopie (BCC)</span>
              <EmpfaengerFeld
                wert={entwurf.bcc}
                aendern={(bcc) => setEntwurf((v) => (v ? { ...v, bcc } : v))}
              />
            </div>
          </>
        )}

        <label className="buero-feld">
          <span>Betreff</span>
          <input
            value={entwurf.betreff}
            onChange={(e) => setEntwurf({ ...entwurf, betreff: e.target.value })}
          />
        </label>
        {/*
          * Ein `div` und **kein** `label` — so wie beim Newsletter und im
          * Versandfenster auch.
          *
          * Ein Tipp irgendwo in ein Label reicht der Browser an dessen
          * Formularfeld weiter. Quills Leiste bringt für jede Auswahlliste ein
          * verstecktes `select` mit; der Tipp landete also dort statt auf der
          * Liste, und am Telefon ging keine einzige Auswahl mehr auf — Größe
          * nicht, Überschrift nicht, Strich nicht. Am Rechner fiel es nicht
          * auf, weil Quill dort schon beim Drücken der Maustaste aufklappt,
          * bevor das Label an die Reihe kommt.
          */}
        <div className="buero-feld">
          <span>Nachricht</span>
          <Schreibfeld
            wert={entwurf.html}
            aendern={(html) => setEntwurf((v) => (v ? { ...v, html } : v))}
          />
        </div>
        {/*
          * Anhänge — auswählen, einfügen oder fallen lassen.
          *
          * Das Fehlen war die meistgenannte Lücke im Postfach: Wer auf eine
          * Anfrage mit einer Zeichnung antworten wollte, musste die Mail im
          * Webmail des Anbieters schreiben und hatte sie danach nicht im
          * eigenen Ausgang. Der Versand konnte Anhänge längst — es fehlte nur
          * der Weg von der Oberfläche bis dorthin.
          */}
        <div
          ref={ablageBereich}
          className={`buero-feld buero-ablage${ablage.drueber ? ' ist-drueber' : ''}`}
        >
          <span>Anhänge</span>
          <input
            type="file"
            multiple
            onChange={(e) => {
              nimmDateien([...(e.target.files ?? [])])
              // Damit dieselbe Datei nach dem Entfernen wieder wählbar ist
              e.target.value = ''
            }}
          />
          <span className="buero-feld-hinweis">
            Oder hierher ziehen — am Rechner geht auch Einfügen mit Strg/Cmd+V.
          </span>
          {anhaenge.length > 0 && (
            <div className="buero-anhaenge">
              {anhaenge.map((d, i) => (
                <div className="buero-anhang" key={`${d.name}-${i}`}>
                  <span className="buero-anhang-name">{d.name}</span>
                  <span className="buero-anhang-groesse">{groesse(d.size)}</span>
                  <button
                    type="button"
                    className="buero-knopf leise schmal"
                    aria-label={`${d.name} entfernen`}
                    onClick={() => setAnhaenge((v) => v.filter((_, j) => j !== i))}
                  >
                    Entfernen
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>
          <button type="button" className="buero-knopf" disabled={laeuft} onClick={() => void senden()}>
            Senden
          </button>
          <button type="button" className="buero-knopf stumm" onClick={() => setEntwurf(null)}>
            Verwerfen
          </button>
          {faecher.length > 1 && (
            <select
              className="buero-fach-wahl"
              value={fach ?? ''}
              onChange={(e) => setFach(e.target.value)}
            >
              {faecher.map((f) => (
                <option key={f.id} value={f.id}>
                  Absender: {f.address}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
    )
  }

  // ── Nachricht lesen ───────────────────────────────────────────────────────
  if (offen) {
    return (
      /*
       * Randlos am Telefon (siehe office.css).
       *
       * Eine fremde Mail bringt ihr eigenes Layout mit — oft eine Tabelle mit
       * fester Breite. Steckt die in einer Karte mit 1,4 rem Polsterung und
       * einem Rahmen, bleiben auf einem 390-px-Gerät keine 340 px übrig, und
       * der Inhalt wird waagerecht scrollbar oder winzig. Am Rechner bleibt
       * die Karte: Dort wäre die volle Breite das andere Extrem.
       */
      <div className="buero-karte buero-mail-offen">
        <button type="button" className="buero-ruecken" onClick={() => setOffen(null)}>
          <Zeichen was="zurueck" /> Zurück
        </button>
        <h2 style={{ marginTop: '.5rem' }}>{offen.betreff}</h2>
        <p className="buero-unterzeile">
          {offen.von} · {zeitVoll(offen.datum)}
          {offen.an ? ` · an ${offen.an}` : ''}
        </p>

        {/*
          * Eine Leiste statt fünf einzelner Kästchen.
          *
          * Vorher stand jede Handlung in einem eigenen Rahmen nebeneinander —
          * am Telefon eine Reihe abgesetzter Quadrate, die mehr nach Formular
          * aussah als nach Werkzeug. Jetzt liegt alles in einem Balken, die
          * Zeichen darin sind flach; das ist die Form, die man aus jedem
          * Mailprogramm kennt (Wunsch Dominik 08/2026, Vorbild Outlook).
          *
          * Offen steht, was man ständig braucht: Antworten, Ungelesen,
          * Löschen. Markieren und Verschieben liegen hinter „⋯" — sie kosten
          * dort einen Tipp mehr und nehmen dafür der Zeile die Unruhe.
          */}
        <div className="buero-mailleiste">
          <button
            type="button"
            className="buero-mailknopf ist-haupt"
            onClick={() => antworten(offen)}
          >
            <Zeichen was="antworten" />
            <span>Antworten</span>
          </button>
          <button
            type="button"
            className="buero-mailknopf"
            title="Als ungelesen zurücklegen"
            aria-label="Als ungelesen zurücklegen"
            onClick={() => void aktion(offen.uid, 'ungelesen')}
          >
            <Zeichen was="ungelesen" />
          </button>
          <button
            type="button"
            className="buero-mailknopf gefahr"
            title="In den Papierkorb legen"
            aria-label="In den Papierkorb legen"
            onClick={() => {
              if (window.confirm('Diese Nachricht in den Papierkorb legen?'))
                void aktion(offen.uid, 'loeschen')
            }}
          >
            <Zeichen was="loeschen" />
          </button>
          <button
            type="button"
            className={`buero-mailknopf${detailMehr ? ' ist-an' : ''}`}
            title="Weitere Handlungen"
            aria-label="Weitere Handlungen"
            aria-expanded={detailMehr}
            onClick={() => setDetailMehr((v) => !v)}
          >
            <Zeichen was="mehr" />
          </button>
        </div>

        {detailMehr && (
          <div className="buero-mail-mehr">
            <button
              type="button"
              className="buero-mailknopf breit"
              aria-pressed={offen.markiert}
              onClick={() => {
                setDetailMehr(false)
                void aktion(offen.uid, offen.markiert ? 'unmarkiert' : 'markiert')
              }}
            >
              <Zeichen was="markieren" />
              <span>{offen.markiert ? 'Markierung entfernen' : 'Markieren'}</span>
            </button>
            {/*
              * Verschieben als Auswahlfeld und nicht als eigenes Menü: Das
              * Zielverzeichnis ist die Frage, nicht das Verschieben selbst. Am
              * Telefon öffnet das native Rad, das man ohnehin kennt.
              */}
            {ordnerAlle.length > 1 && (
              <select
                className="buero-fach-wahl breit"
                aria-label="In einen anderen Ordner verschieben"
                value=""
                onChange={(e) => {
                  if (e.target.value) {
                    setDetailMehr(false)
                    void verschieben(offen.uid, e.target.value)
                  }
                }}
              >
                <option value="">Verschieben nach …</option>
                {ordnerAlle
                  .filter((o) => o.pfad !== ordner)
                  .map((o) => (
                    <option key={o.pfad} value={o.pfad}>
                      {ordnerName(o)}
                    </option>
                  ))}
              </select>
            )}
          </div>
        )}

        {offen.dateien.length > 0 && (
          <div className="buero-liste" style={{ marginBottom: '1rem' }}>
            {offen.dateien.map((d) => (
              <a
                key={d.name}
                className="buero-zeile"
                href={`/api/office/post/anhang?uid=${offen.uid}&ordner=${encodeURIComponent(
                  ordner,
                )}&fach=${fach ?? ''}&name=${encodeURIComponent(d.name)}`}
              >
                <div className="buero-zeile-haupt">
                  <div className="buero-zeile-titel">{d.name}</div>
                  <div className="buero-zeile-neben">{groesse(d.groesse)}</div>
                </div>
                <span className="buero-marker">laden</span>
              </a>
            ))}
          </div>
        )}

        {offen.html ? (
          <iframe
            title="Nachricht"
            className="buero-mailrahmen"
            sandbox=""
            srcDoc={offen.html}
          />
        ) : (
          <div style={{ whiteSpace: 'pre-wrap' }}>{offen.text}</div>
        )}
      </div>
    )
  }

  // ── Liste ─────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="buero-werkzeuge">
        {faecher.length > 1 && (
          <select
            className="buero-fach-wahl"
            aria-label="Postfach"
            value={fach ?? ''}
            onChange={(e) => void laden(e.target.value, 'INBOX')}
          >
            {faecher.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label} — {f.address}
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          className="buero-knopf"
          onClick={() =>
            setEntwurf({ an: '', cc: '', bcc: '', betreff: '', text: '', html: signaturJetzt() })
          }
        >
          Schreiben
        </button>
        <button
          type="button"
          className="buero-symbolknopf"
          disabled={laeuft}
          title="Neu laden"
          aria-label="Neu laden"
          onClick={() => void laden(fach, ordner)}
        >
          <Zeichen was="neuLaden" />
        </button>
      </div>

      {/*
        * Die Ordner offen als Reihe, mit der Zahl der ungelesenen daneben.
        *
        * Als Auswahlfeld musste man erst aufklappen, um zu sehen, ob sich das
        * Aufklappen lohnt — und wie viele Ordner es überhaupt gibt. Hier steht
        * beides sofort da.
        */}
      {ordnerAlle.length > 0 && (
        <div className="buero-ordnerleiste" role="tablist" aria-label="Ordner">
          {ordnerAlle.map((o) => (
            <button
              key={o.pfad}
              type="button"
              role="tab"
              aria-selected={o.pfad === ordner}
              className={`buero-ordner${o.pfad === ordner ? ' ist-hier' : ''}`}
              onClick={() => void laden(fach, o.pfad)}
            >
              {ordnerName(o)}
              {o.ungelesen > 0 && <span className="buero-ordner-zahl">{o.ungelesen}</span>}
            </button>
          ))}
          <button
            type="button"
            className="buero-ordner ist-zugabe"
            title="Ordner anlegen"
            aria-label="Ordner anlegen"
            onClick={() => setNeuerOrdner('')}
          >
            <Zeichen was="plus" />
          </button>
        </div>
      )}

      {neuerOrdner !== null && (
        <form
          className="buero-ordner-neu"
          onSubmit={(e) => {
            e.preventDefault()
            if (neuerOrdner.trim()) void ordnerAnlegen(neuerOrdner.trim())
          }}
        >
          <input
            autoFocus
            value={neuerOrdner}
            placeholder="Name des Ordners"
            onChange={(e) => setNeuerOrdner(e.target.value)}
          />
          <button type="submit" className="buero-knopf" disabled={!neuerOrdner.trim()}>
            Anlegen
          </button>
          <button type="button" className="buero-knopf stumm" onClick={() => setNeuerOrdner(null)}>
            Abbrechen
          </button>
        </form>
      )}

      <Rueckmeldung text={meldung} />

      <div className="buero-liste">
        {liste.length === 0 ? (
          <div className="buero-leer">{laeuft ? 'Lädt …' : 'Keine Nachrichten.'}</div>
        ) : (
          liste.map((n) => (
            <React.Fragment key={n.uid}>
              {/*
                * Die Zeile lässt sich wischen wie in jeder Mail-App: links =
                * Papierkorb, rechts = gelesen/ungelesen umdrehen. Der Rumpf
                * ist deshalb ein div mit Knopfrolle — in einem echten <button>
                * dürfte der „⋯"-Knopf daneben nicht wohnen.
                */}
              <WischZeile
                nachLinks={{
                  text: 'Löschen',
                  art: 'rot',
                  tun: () => void aktion(n.uid, 'loeschen'),
                }}
                nachRechts={{
                  text: n.gelesen ? 'Ungelesen' : 'Gelesen',
                  art: 'bronze',
                  tun: () => void aktion(n.uid, n.gelesen ? 'ungelesen' : 'gelesen'),
                }}
              >
                <div
                  role="button"
                  tabIndex={0}
                  className={`buero-zeile buero-zeile-knopf${n.gelesen ? '' : ' ist-neu'}`}
                  onClick={() => void oeffnen(n.uid)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      void oeffnen(n.uid)
                    }
                  }}
                >
                  {/*
                    * Ungelesen und markiert stehen vorn, nicht hinten als
                    * beschriftete Pille.
                    *
                    * „NEU" und „MARKIERT" brauchten rechts je gut neunzig
                    * Pixel — zusammen mit Zeit und „⋯" blieb dem Absender auf
                    * einem 390-px-Gerät ein Drittel der Zeile, und
                    * „Kundenservice IONOS" wurde mitten im Wort abgeschnitten.
                    *
                    * Ungelesen ist jetzt der Statusbalken links, den die
                    * Listen des Hauses ohnehin haben (`.buero-zeile::before`)
                    * — das Postfach hat ihn nur nie benutzt. Vorgemerkt
                    * bleibt ein Fähnchen davor; zwei Zustände können sich
                    * einen Balken nicht teilen. Vorschlag Dominik 08/2026.
                    */}
                  <span className="buero-mailmarken" aria-hidden={!n.markiert}>
                    {n.markiert && <Zeichen was="faehnchen" />}
                  </span>
                  <div className="buero-zeile-haupt">
                    <div
                      className="buero-zeile-titel"
                      style={{ fontWeight: n.gelesen ? 400 : 600 }}
                    >
                      {!n.gelesen && <span className="buero-nur-vorlesen">Ungelesen: </span>}
                      {n.markiert && <span className="buero-nur-vorlesen">Markiert: </span>}
                      {n.von}
                    </div>
                    <div className="buero-zeile-neben">
                      {n.betreff}
                      {n.anhaenge ? ' · Anhang' : ''}
                    </div>
                  </div>
                  {/*
                    * Marker, Zeit und „⋯" dürfen umbrechen.
                    *
                    * Zu dritt in einer Zeile drängen sie auf einem 390-px-Gerät
                    * den Absender auf ein Drittel zusammen — „Kundenservice
                    * IONOS" wurde dann mitten im Wort abgeschnitten, während
                    * rechts drei Elemente nebeneinander standen. Umbrechen sie,
                    * rutscht der Marker in eine eigene Zeile und der Name bleibt
                    * lesbar; die Zeit bleibt in einem Stück (siehe
                    * `.buero-mailzeit`), weil sie sonst zweizeilig würde.
                    */}
                  <div className="buero-mailzeile-rechts">
                    <span className="buero-zeile-neben buero-mailzeit" title={zeitVoll(n.datum)}>
                      {zeit(n.datum)}
                    </span>
                    <button
                      type="button"
                      className="buero-knopf leise schmal"
                      aria-label="Mehr zu dieser Nachricht"
                      onClick={(e) => {
                        e.stopPropagation()
                        setMehrOffen((v) => (v === n.uid ? null : n.uid))
                      }}
                    >
                      ⋯
                    </button>
                  </div>
                </div>
              </WischZeile>
              {mehrOffen === n.uid && (
                <div className="buero-mail-mehr">
                  <button
                    type="button"
                    className="buero-knopf leise schmal"
                    onClick={() => {
                      setMehrOffen(null)
                      void aktion(n.uid, n.gelesen ? 'ungelesen' : 'gelesen')
                    }}
                  >
                    Als {n.gelesen ? 'ungelesen' : 'gelesen'} markieren
                  </button>
                  <button
                    type="button"
                    className="buero-knopf leise schmal"
                    onClick={() => {
                      setMehrOffen(null)
                      void aktion(n.uid, n.markiert ? 'unmarkiert' : 'markiert')
                    }}
                  >
                    {n.markiert ? 'Markierung entfernen' : 'Markieren'}
                  </button>
                  <button
                    type="button"
                    className="buero-knopf leise schmal"
                    onClick={() => {
                      setMehrOffen(null)
                      void aktion(n.uid, 'loeschen')
                    }}
                  >
                    Löschen
                  </button>
                  {ordnerAlle.filter((o) => o.pfad !== ordner).length > 0 && (
                    <>
                      <span className="buero-unterzeile">Verschieben nach:</span>
                      {ordnerAlle
                        .filter((o) => o.pfad !== ordner)
                        .map((o) => (
                          <button
                            key={o.pfad}
                            type="button"
                            className="buero-knopf leise schmal"
                            onClick={() => {
                              setMehrOffen(null)
                              void verschieben(n.uid, o.pfad)
                            }}
                          >
                            {ordnerName(o)}
                          </button>
                        ))}
                    </>
                  )}
                </div>
              )}
            </React.Fragment>
          ))
        )}
      </div>
    </>
  )
}
