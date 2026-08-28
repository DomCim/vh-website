'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React, { useEffect, useRef, useState } from 'react'

import { seit } from '../../lib/format'
import { alsGelesen, allesGelesen, meldungsZeit, useMeldungen, useUngelesen } from '../../lib/buero/meldungen'

/**
 * Die Glocke in der Kopfleiste.
 *
 * **Warum es sie gibt.** Das Büro meldet aufs Handy — eine neue Anfrage, ein
 * fälliger Beleg, ein vorbereiteter Rechnungsentwurf. Bisher war das ein Ruf
 * ins Leere: Wer die Meldung im Vorbeigehen wegwischte, konnte nirgends
 * nachsehen, was da eigentlich stand. „Schlussrechnung vorbereitet" — und
 * dann? Die Meldung nannte kein Ziel, das man wiederfindet, und im Büro gab es
 * keine Stelle, an der sie noch einmal auftauchte.
 *
 * Jetzt liegt jede Meldung in einer Liste (siehe collections/Notifications),
 * und die steht dort, wo man beim Aufmachen ohnehin hinschaut: oben rechts,
 * neben dem Abgleichpunkt. Der Punkt sagt „der Stand stimmt", die Glocke sagt
 * „hier will etwas etwas von dir".
 *
 * Gebaut wie der Abgleichpunkt: ein Knopf, ein Blatt darunter, Antippen
 * öffnet. Am Handy gibt es kein Überfahren mit der Maus — was sich erklären
 * soll, braucht einen Tipp.
 */

/** So viele stehen unter der Glocke; alles Weitere auf der eigenen Seite. */
const UNTER_DER_GLOCKE = 20

export function Meldungsglocke() {
  const meldungen = useMeldungen(UNTER_DER_GLOCKE)
  const ungelesen = useUngelesen()
  const [offen, setOffen] = useState(false)
  const [raeumt, setRaeumt] = useState(false)
  const huelle = useRef<HTMLSpanElement>(null)
  const pfad = usePathname()

  // Beim Seitenwechsel schließen — sonst bliebe das Blatt über der neuen Seite
  useEffect(() => setOffen(false), [pfad])

  /*
   * Die Zahl der Glocke auch ans App-Symbol.
   *
   * Wer die Büro-App installiert hat, sieht damit schon am Startbildschirm,
   * dass etwas anliegt — ohne die App zu öffnen. Dieselbe Quelle wie die
   * Glocke selbst, also zeigen beide immer dasselbe; „Alles gelesen" räumt
   * das Symbol mit ab.
   *
   * Still abgesichert: Die Badge-Schnittstelle gibt es nur in installierten
   * Apps (Android/Chrome, iOS ab 16.4 mit Meldungserlaubnis) — im Browser-Tab
   * fehlt sie, und dann soll hier nichts scheppern.
   */
  useEffect(() => {
    const n = navigator as Navigator & {
      setAppBadge?: (n: number) => Promise<void>
      clearAppBadge?: () => Promise<void>
    }
    if (typeof n.setAppBadge !== 'function') return
    if (ungelesen > 0) void n.setAppBadge(ungelesen).catch(() => undefined)
    else void n.clearAppBadge?.().catch(() => undefined)
  }, [ungelesen])

  /*
   * Solange das Blatt offen ist, weiß die Seite davon.
   *
   * Der Grund ist ein handfester: Auf Seiten mit einer Hauptaktion lag deren
   * Knopf mitten im aufgeklappten Blatt (#43, gemeldet aus der
   * Übergabemappe). Über `z-index` war das nicht zu lösen — die Fußleiste
   * steht in einem eigenen Stapel, und aus einem fremden Stapel kommt man
   * mit keiner Zahl heraus. Zwei Anläufe gingen dafür drauf.
   *
   * Die Fußleiste tritt deshalb zur Seite, solange gelesen wird (siehe
   * `office.css`). Das ist auch das richtige Verhalten: Wer die Meldungen
   * durchsieht, will in diesem Moment keine neue Mappe anlegen.
   *
   * Dieselbe Technik wie bei `tastatur-offen` — eine Klasse am `<html>`,
   * die das Stylesheet abfragt.
   */
  useEffect(() => {
    const wurzel = document.documentElement
    wurzel.classList.toggle('meldungen-offen', offen)
    return () => wurzel.classList.remove('meldungen-offen')
  }, [offen])

  // Klick daneben und Escape schließen; dieselben zwei Griffe wie in der Navigation
  useEffect(() => {
    if (!offen) return
    const beiKlick = (e: MouseEvent) => {
      if (!huelle.current?.contains(e.target as Node)) setOffen(false)
    }
    const beiTaste = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOffen(false)
    }
    document.addEventListener('mousedown', beiKlick)
    window.addEventListener('keydown', beiTaste)
    return () => {
      document.removeEventListener('mousedown', beiKlick)
      window.removeEventListener('keydown', beiTaste)
    }
  }, [offen])

  /*
   * Auf der Anmeldeseite gibt es nichts zu melden — dieselbe Regel wie in der
   * Navigation. Eine Glocke über einem leeren Bestand verspricht eine Liste,
   * die es für den, der noch nicht angemeldet ist, gar nicht geben kann.
   */
  const draussen = pfad?.startsWith('/office/login') || pfad?.startsWith('/office/kein-zugang')

  const abhaken = async () => {
    setRaeumt(true)
    try {
      await allesGelesen(meldungen)
    } finally {
      setRaeumt(false)
    }
  }

  if (draussen) return null

  return (
    <span className="buero-glocke-huelle" ref={huelle}>
      <button
        type="button"
        className={`buero-glocke${ungelesen ? ' hat-neue' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={offen}
        aria-label={ungelesen ? `Meldungen — ${ungelesen} ungelesen` : 'Meldungen'}
        onClick={() => setOffen((v) => !v)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M18 9.5a6 6 0 0 0-12 0c0 5-2 6.5-2 6.5h16s-2-1.5-2-6.5z" />
          <path d="M13.7 19.5a2 2 0 0 1-3.4 0" />
        </svg>
        {ungelesen > 0 && (
          <span className="buero-zaehler" aria-hidden="true">
            {ungelesen > 99 ? '99+' : ungelesen}
          </span>
        )}
      </button>

      {offen && (
        <div className="buero-glocke-blatt" role="dialog" aria-label="Meldungen">
          {meldungen.length === 0 ? (
            <p className="buero-glocke-leer">Nichts liegt an.</p>
          ) : (
            <div className="buero-glocke-liste">
              {meldungen.map((m) => (
                <Link
                  key={m.id}
                  href={m.url || '/office'}
                  className={m.gelesen ? undefined : 'ist-neu'}
                  onClick={() => {
                    if (!m.gelesen) void alsGelesen(m.id)
                    setOffen(false)
                  }}
                >
                  <strong>
                    {m.titel}
                    {(m.anzahl ?? 1) > 1 ? ` (${m.anzahl}×)` : ''}
                  </strong>
                  {m.text ? <span>{m.text}</span> : null}
                  <time dateTime={meldungsZeit(m) || undefined}>{seit(meldungsZeit(m))}</time>
                </Link>
              ))}
            </div>
          )}

          <div className="buero-glocke-fuss">
            {ungelesen > 0 && (
              <button type="button" className="buero-knopf leise" disabled={raeumt} onClick={() => void abhaken()}>
                {raeumt ? '…' : 'Alles gelesen'}
              </button>
            )}
            <Link href="/office/meldungen" onClick={() => setOffen(false)}>
              Alle Meldungen
            </Link>
          </div>
        </div>
      )}
    </span>
  )
}
