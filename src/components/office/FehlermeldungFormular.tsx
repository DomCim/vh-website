'use client'

import React, { useEffect, useRef, useState } from 'react'

import { MAX_FOTOS } from '../../lib/fehlermeldung'
import { Fussleiste } from './Fussleiste'
import { Rueckmeldung } from './Rueckmeldung'
import { alsListe, useDateiablage } from '../../lib/buero/dateiablage'

/**
 * „Das stimmt hier nicht" — der Weg vom Auffallen zum Eintrag.
 *
 * **Warum das Formular so kurz ist.** Gemeldet wird zwischen zwei Aufträgen,
 * mit einer Hand, und meistens ärgerlich. Jedes Pflichtfeld mehr ist eine
 * Gelegenheit, es sein zu lassen — und eine Meldung, die nicht geschrieben
 * wird, ist die einzige, die sicher nichts bringt. Deshalb genügt eine
 * Überschrift **oder** eine Beschreibung; alles Weitere trägt die Seite von
 * selbst bei.
 *
 * **Was sie von selbst beiträgt.** Wo es passiert ist, was für ein Gerät und
 * welcher Stand gerade läuft. Genau die drei Angaben fehlen erfahrungsgemäß,
 * wenn jemand später nachsehen will, und genau die drei kann niemand aus dem
 * Kopf. Die Seite steht sichtbar im Formular und lässt sich ändern: Wer von
 * der Inventarliste hierherkommt, aber die Bestellung meint, soll das
 * hinschreiben können.
 *
 * **Die Fotos sind der eigentliche Grund für das Ganze.** Ein Bildschirmfoto
 * beantwortet in einem Blick, wofür drei Absätze nicht reichen. Sie werden
 * geschützt abgelegt und im Eintrag über einen unterschriebenen Link gezeigt
 * — was das heißt, steht in `lib/fehlermeldung.ts`.
 *
 * **Ohne Netz geht es hier ausdrücklich nicht.** Das übrige Büro merkt sich
 * Eingaben und schickt sie später; hier wäre das falsch. Eine Meldung, die
 * schweigend in einer Warteschlange liegt, hilft niemandem, und die Antwort
 * — die Nummer des Eintrags — ist der halbe Zweck.
 */

const LEER = { titel: '', text: '' }

export function FehlermeldungFormular() {
  const [w, setW] = useState(LEER)
  const [seite, setSeite] = useState('')
  const [fotos, setFotos] = useState<File[]>([])
  const [laeuft, setLaeuft] = useState(false)
  const [meldung, setMeldung] = useState<string | null>(null)
  const [fertig, setFertig] = useState<{ nummer?: number; url?: string } | null>(null)
  const dateiwahl = useRef<HTMLInputElement>(null)

  /*
   * Woher die Meldung kommt: die Seite davor.
   *
   * **Warum das der Navigationspunkt mitbringt und nicht `document.referrer`.**
   * Genau so stand es hier zuerst, und es war falsch: Das Büro wechselt die
   * Seite im Browser, ohne das Dokument neu zu laden. Der Verweis bleibt
   * dabei auf dem stehen, womit das Dokument einmal geladen wurde — im Feld
   * stand deshalb immer „/office", ganz gleich, wo man herkam.
   *
   * Der Verweis bleibt als zweite Wahl stehen: Wer die Adresse aus einem
   * Lesezeichen oder aus einer Nachricht öffnet, hat kein Anhängsel, und
   * dann ist ein frisch geladenes Dokument genau der Fall, in dem
   * `document.referrer` etwas taugt.
   */
  useEffect(() => {
    try {
      const von = new URLSearchParams(window.location.search).get('von')
      if (von) {
        setSeite(von)
        return
      }
      const her = document.referrer
      if (her && new URL(her).origin === window.location.origin) setSeite(new URL(her).pathname)
    } catch {
      // Kein Verweis, kein Schaden — das Feld bleibt leer und ist tippbar
    }
  }, [])

  function fotosDazu(neue: FileList | null) {
    if (!neue?.length) return
    setFotos((bisher) => [...bisher, ...Array.from(neue)].slice(0, MAX_FOTOS))
    setMeldung(null)
  }

  /*
   * Ziehen und Einfügen zusätzlich zum Knopf (siehe lib/buero/dateiablage.ts).
   *
   * Gerade hier zählt das Einfügen: Eine Fehlermeldung entsteht meist direkt
   * nach einem Bildschirmfoto, und das liegt dann schon im Zwischenspeicher.
   * Bis eben musste man es erst irgendwohin speichern, um es wieder auswählen
   * zu können.
   */
  const ablageBereich = useRef<HTMLDivElement>(null)
  const ablage = useDateiablage(
    ablageBereich,
    (d) => fotosDazu(alsListe(d)),
    fotos.length < MAX_FOTOS,
  )

  async function senden() {
    if (!w.titel.trim() && !w.text.trim()) {
      setMeldung('Ein Wort dazu braucht es schon — sonst weiß niemand, worum es geht.')
      return
    }
    setLaeuft(true)
    setMeldung(null)
    try {
      const formular = new FormData()
      formular.append('titel', w.titel)
      formular.append('text', w.text)
      formular.append(
        'umgebung',
        JSON.stringify({ seite, geraet: navigator.userAgent }),
      )
      for (const foto of fotos) formular.append('fotos', foto, foto.name)

      const antwort = await fetch('/api/office/fehlermeldung', {
        method: 'POST',
        body: formular,
      })
      const daten = (await antwort.json().catch(() => ({}))) as Record<string, unknown>

      if (!antwort.ok) {
        setMeldung(
          {
            'nicht-eingerichtet':
              'Dafür fehlt der Zugang. In den Einstellungen unter Integrationen → Fehlermeldungen Repository und Zugangswort eintragen.',
            zugang:
              'Das Zugangswort wird abgelehnt. Vermutlich abgelaufen oder ohne Recht auf Issues — in den Einstellungen erneuern.',
            'zu-gross': 'Ein Foto ist zu groß. Bis 12 MB geht.',
            'kein-bild': 'Angehängt werden können nur Bilder.',
            'zu-viele-fotos': `Höchstens ${MAX_FOTOS} Fotos.`,
            github: 'GitHub hat die Meldung abgelehnt. Bitte später noch einmal.',
          }[String(daten.error)] ?? 'Das hat nicht geklappt — dafür braucht es Netz.',
        )
        return
      }

      setFertig({ nummer: daten.nummer as number, url: daten.url as string })
      setW(LEER)
      setFotos([])
    } catch {
      setMeldung('Das hat nicht geklappt — dafür braucht es Netz.')
    } finally {
      setLaeuft(false)
    }
  }

  if (fertig) {
    return (
      <div className="buero-karte">
        <p className="buero-hinweis">
          Ist notiert — als Eintrag <strong>#{fertig.nummer}</strong> im Repository.
        </p>
        <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>
          {fertig.url && (
            <a
              className="buero-knopf leise"
              href={fertig.url}
              target="_blank"
              rel="noreferrer noopener"
            >
              Eintrag ansehen
            </a>
          )}
          <button type="button" className="buero-knopf stumm" onClick={() => setFertig(null)}>
            Noch etwas melden
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="buero-karte">
      <Rueckmeldung text={meldung} />

      <label className="buero-feld">
        <span>Worum geht es?</span>
        <input
          value={w.titel}
          onChange={(e) => setW((v) => ({ ...v, titel: e.target.value }))}
          placeholder="z.B. Komma lässt sich beim Wert je Einheit nicht eintippen"
        />
      </label>

      <label className="buero-feld">
        <span>Was ist passiert?</span>
        <textarea
          rows={5}
          value={w.text}
          onChange={(e) => setW((v) => ({ ...v, text: e.target.value }))}
          placeholder="Was hast du gemacht, was hast du erwartet, was kam stattdessen?"
        />
        <span style={{ marginTop: '.4rem' }}>
          Lieber zu ausführlich als zu knapp — wer das später liest, war nicht dabei.
        </span>
      </label>

      <label className="buero-feld">
        <span>Wo war das?</span>
        <input value={seite} onChange={(e) => setSeite(e.target.value)} placeholder="z.B. /office/inventar/neu" />
        <span style={{ marginTop: '.4rem' }}>
          Kommt von der Seite, auf der du warst. Wenn es woanders war, hier ändern.
        </span>
      </label>

      <div
        ref={ablageBereich}
        className={`buero-feld buero-ablage${ablage.drueber ? ' ist-drueber' : ''}`}
      >
        <span>Fotos</span>
        {/* `capture` fehlt bewusst: Meistens ist es ein Bildschirmfoto aus der
            Mediathek und nicht die Kamera. */}
        <input
          ref={dateiwahl}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            fotosDazu(e.target.files)
            e.target.value = ''
          }}
        />
        <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            className="buero-knopf leise"
            disabled={fotos.length >= MAX_FOTOS}
            onClick={() => dateiwahl.current?.click()}
          >
            {fotos.length ? 'Noch ein Foto' : 'Foto anhängen'}
          </button>
          <span className="buero-unterzeile">
            {fotos.length
              ? `${fotos.length} von ${MAX_FOTOS}`
              : 'Ein Bildschirmfoto sagt mehr als drei Absätze.'}
          </span>
        </div>

        {fotos.length > 0 && (
          <div className="buero-liste" style={{ marginTop: '.6rem' }}>
            {fotos.map((foto, i) => (
              <div key={`${foto.name}-${i}`} className="buero-zeile">
                <div className="buero-zeile-haupt">
                  <div className="buero-zeile-titel">{foto.name}</div>
                  <div className="buero-zeile-neben">
                    {Math.round(foto.size / 1024).toLocaleString('de-DE')} kB
                  </div>
                </div>
                <button
                  type="button"
                  className="buero-knopf stumm"
                  onClick={() => setFotos((alle) => alle.filter((_, idx) => idx !== i))}
                >
                  Entfernen
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="buero-unterzeile">
        Mitgeschickt werden außerdem dein Name, der Zeitpunkt, das Gerät und die laufende Fassung.
      </p>

      <Fussleiste>
        <button type="button" className="buero-knopf" disabled={laeuft} onClick={() => void senden()}>
          {laeuft ? 'geht raus …' : 'Melden'}
        </button>
      </Fussleiste>
    </div>
  )
}
