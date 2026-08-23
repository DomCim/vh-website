'use client'

import React, { useCallback, useEffect, useState } from 'react'

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

const zeit = (v: string | null) => {
  if (!v) return ''
  const d = new Date(v)
  const heute = new Date()
  const gleicherTag = d.toDateString() === heute.toDateString()
  return gleicherTag
    ? d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })
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
      const res = await fetch('/api/office/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ aktion: 'senden', fach, ...entwurf }),
      })
      const daten = (await res.json().catch(() => null)) as { kopie?: boolean } | null
      if (!res.ok) {
        setMeldung('Die Mail ging nicht raus.')
        return
      }
      setEntwurf(null)
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
        `<p><br></p><p style="color: #666666">Am ${zeit(n.datum)} schrieb ${n.von}:</p>` +
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
      <div className="buero-karte">
        <button type="button" className="buero-ruecken" onClick={() => setOffen(null)}>
          <Zeichen was="zurueck" /> Zurück
        </button>
        <h2 style={{ marginTop: '.5rem' }}>{offen.betreff}</h2>
        <p className="buero-unterzeile">
          {offen.von} · {zeit(offen.datum)}
          {offen.an ? ` · an ${offen.an}` : ''}
        </p>

        {/*
          * Eine große Handlung, der Rest als Zeichen.
          *
          * „Antworten" ist das, was man hier zu neunzig Prozent will — das
          * bleibt beschriftet. Ungelesen, Markieren, Verschieben und Löschen
          * passen daneben in eine Zeile, statt drei zu füllen. Jeder behält
          * seine 44 Pixel; nur die Beschriftung wandert zum Screenreader.
          */}
        <div className="buero-werkzeuge">
          <button type="button" className="buero-knopf" onClick={() => antworten(offen)}>
            Antworten
          </button>
          <button
            type="button"
            className="buero-symbolknopf"
            title="Als ungelesen zurücklegen"
            aria-label="Als ungelesen zurücklegen"
            onClick={() => void aktion(offen.uid, 'ungelesen')}
          >
            <Zeichen was="ungelesen" />
          </button>
          <button
            type="button"
            className={`buero-symbolknopf${offen.markiert ? ' ist-an' : ''}`}
            title={offen.markiert ? 'Markierung entfernen' : 'Markieren'}
            aria-label={offen.markiert ? 'Markierung entfernen' : 'Markieren'}
            aria-pressed={offen.markiert}
            onClick={() => void aktion(offen.uid, offen.markiert ? 'unmarkiert' : 'markiert')}
          >
            <Zeichen was="markieren" />
          </button>
          {/*
            * Verschieben als Auswahlfeld und nicht als eigenes Menü: Das
            * Zielverzeichnis ist die Frage, nicht das Verschieben selbst. Am
            * Telefon öffnet das native Rad, das man ohnehin kennt.
            */}
          {ordnerAlle.length > 1 && (
            <select
              className="buero-fach-wahl"
              aria-label="In einen anderen Ordner verschieben"
              value=""
              onChange={(e) => {
                if (e.target.value) void verschieben(offen.uid, e.target.value)
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
          <button
            type="button"
            className="buero-symbolknopf gefahr"
            title="In den Papierkorb legen"
            aria-label="In den Papierkorb legen"
            onClick={() => {
              if (window.confirm('Diese Nachricht in den Papierkorb legen?'))
                void aktion(offen.uid, 'loeschen')
            }}
          >
            <Zeichen was="loeschen" />
          </button>
        </div>

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
                  className="buero-zeile buero-zeile-knopf"
                  onClick={() => void oeffnen(n.uid)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      void oeffnen(n.uid)
                    }
                  }}
                >
                  <div className="buero-zeile-haupt">
                    <div
                      className="buero-zeile-titel"
                      style={{ fontWeight: n.gelesen ? 400 : 600 }}
                    >
                      {n.von}
                    </div>
                    <div className="buero-zeile-neben">
                      {n.betreff}
                      {n.anhaenge ? ' · Anhang' : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                    {n.markiert && <span className="buero-marker offen">markiert</span>}
                    {!n.gelesen && <span className="buero-marker gut">neu</span>}
                    <span className="buero-zeile-neben">{zeit(n.datum)}</span>
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
