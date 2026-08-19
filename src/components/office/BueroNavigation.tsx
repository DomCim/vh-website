'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React, { useEffect, useMemo, useRef, useState } from 'react'

import { useRahmen } from '../../lib/buero/bestand'

/**
 * Navigation im Büro.
 *
 * Am Rechner vier Gruppen, die aufklappen. Am Handy dieselben vier Bereiche
 * als Tableiste am unteren Rand — dort kommt der Daumen hin, ohne das Gerät
 * umzugreifen —, und jeder Bereich öffnet sein eigenes Blatt.
 *
 * Vorher lagen unten vier feste Ziele und ein „Mehr", hinter dem alle
 * achtzehn Punkte auf einmal standen: eine Wand aus Kästchen, durch die man
 * scrollen musste, um an die Einstellungen zu kommen. Jetzt ist jeder Punkt
 * in zwei Griffen erreichbar, beide unten.
 *
 * Beide Fassungen zeigen dieselbe Ordnung nach Arbeitsbereichen. Achtzehn
 * Punkte nebeneinander findet niemand: Sie liefen seitlich aus dem Bild, und
 * gesucht wird ohnehin nicht alphabetisch, sondern nach „wo war das mit den
 * Rechnungen".
 */

/*
 * Was oben in der Leiste steht.
 *
 * Vorher standen dort achtzehn Punkte nebeneinander und liefen seitlich aus
 * dem Bild. Gesucht wird aber nicht alphabetisch, sondern nach Arbeitsbereich
 * — dieselbe Ordnung, die das Blatt am Handy schon hatte. Jetzt haben beide
 * dieselbe: vier Gruppen, und was dahinter liegt, klappt auf.
 *
 * `recht` entscheidet, ob ein Punkt überhaupt erscheint. Das ist kein Schutz,
 * der sitzt an den Schnittstellen — es ist eine Frage der Ordnung: Ein Punkt,
 * der beim Antippen „nicht erlaubt" sagt, ist ein Versprechen, das keines war.
 */
type Punkt = { href: string; label: string; recht?: string }

const UEBERSICHT: Punkt = { href: '/office', label: 'Übersicht' }

/** Nach Arbeitsbereichen sortiert — so sucht man auch im Kopf */
const BEREICHE: { titel: string; punkte: Punkt[] }[] = [
  {
    titel: 'Kundschaft',
    punkte: [
      { href: '/office/post', label: 'Postfach', recht: 'postfach.lesen' },
      { href: '/office/anfragen', label: 'Anfragen', recht: 'anfragen.bearbeiten' },
      { href: '/office/bestellungen', label: 'Bestellungen', recht: 'anfragen.bearbeiten' },
      { href: '/office/angebote', label: 'Angebote', recht: 'angebote.schreiben' },
      { href: '/office/wiedervorlagen', label: 'Wiedervorlagen' },
      { href: '/office/newsletter', label: 'Newsletter', recht: 'newsletter.versenden' },
    ],
  },
  {
    titel: 'Werkstatt',
    punkte: [
      { href: '/office/auftraege', label: 'Aufträge', recht: 'auftraege.bearbeiten' },
      { href: '/office/kalender', label: 'Kalender', recht: 'auftraege.bearbeiten' },
      { href: '/office/auslastung', label: 'Auslastung', recht: 'auftraege.bearbeiten' },
      { href: '/office/artikel', label: 'Artikel', recht: 'website.pflegen' },
      { href: '/office/inventar', label: 'Inventar', recht: 'inventar.pflegen' },
      { href: '/office/nachbestellen', label: 'Nachbestellen', recht: 'inventar.pflegen' },
      { href: '/office/wareneingang', label: 'Wareneingang', recht: 'inventar.pflegen' },
      { href: '/office/inventur', label: 'Inventur', recht: 'inventar.pflegen' },
    ],
  },
  {
    titel: 'Geld',
    punkte: [
      { href: '/office/rechnungen', label: 'Rechnungen', recht: 'rechnungen.schreiben' },
      { href: '/office/zahlungen', label: 'Zahlungseingänge', recht: 'rechnungen.schreiben' },
      { href: '/office/belege', label: 'Belege', recht: 'belege.erfassen' },
      { href: '/office/nachkalkulation', label: 'Nachkalkulation', recht: 'zahlen.sehen' },
      { href: '/office/steuer', label: 'Steuer', recht: 'zahlen.sehen' },
      { href: '/office/partner', label: 'Partner', recht: 'partner.pflegen' },
    ],
  },
  {
    titel: 'Sonstiges',
    punkte: [
      { href: '/office/sicherung', label: 'Sicherung', recht: 'sicherung.ausloesen' },
      // Einstellungen und Neuerungen stehen jedem offen: Dort liegen das eigene
      // Konto, die Meldungen dieses Geräts und der Änderungsverlauf.
      { href: '/office/einstellungen', label: 'Einstellungen' },
      { href: '/office/neuerungen', label: 'Neuerungen' },
      { href: '/admin', label: 'Website-Verwaltung', recht: 'website.pflegen' },
    ],
  },
]

const Zeichen = {
  uebersicht: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" />
    </svg>
  ),
  /* Kundschaft: zwei Leute — alles, was von außen hereinkommt */
  Kundschaft: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
      <path d="M16 6.2a3 3 0 0 1 0 5.6M17.5 14.8c2 .7 3.2 2.4 3.2 4.7" />
    </svg>
  ),
  /* Werkstatt: Hammer — was gebaut, gelagert und geplant wird */
  Werkstatt: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M13.5 3.5 20 10l-2.5 2.5L11 6z" />
      <path d="M10.2 7.3 4 13.5a2 2 0 0 0 0 2.8l1.7 1.7a2 2 0 0 0 2.8 0l6.2-6.2" />
    </svg>
  ),
  /* Geld: Schein — Rechnungen, Belege, Steuer */
  Geld: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M6 12h.01M18 12h.01" />
    </svg>
  ),
  /* Sonstiges: Zahnrad — Einstellungen, Sicherung, Verwaltung */
  Sonstiges: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.8v2.4M12 18.8v2.4M4.5 12H2.1M21.9 12h-2.4M6.7 6.7 5 5M19 19l-1.7-1.7M6.7 17.3 5 19M19 5l-1.7 1.7" />
    </svg>
  ),
}

const istAktiv = (pfad: string | null, href: string) =>
  href === '/office' ? pfad === '/office' : Boolean(pfad?.startsWith(href))

export function BueroNavigation() {
  const pfad = usePathname()
  /* Am Handy ist immer höchstens ein Bereich aufgeklappt — hier steht,
     welcher. `null` heißt: kein Blatt offen. */
  const [offenesBlatt, setOffenesBlatt] = useState<string | null>(null)
  const [offeneGruppe, setOffeneGruppe] = useState<string | null>(null)
  const leiste = useRef<HTMLElement>(null)
  const rahmen = useRahmen()

  /*
   * Was jemand nicht darf, steht auch nicht in der Leiste.
   *
   * Solange der Rahmen noch nicht im Gerät liegt — der erste Aufruf, bevor der
   * Abgleich durch ist —, wird nichts gefiltert. Eine Navigation, die beim
   * Laden kurz zusammenschrumpft und dann wieder wächst, sieht kaputt aus.
   */
  const gruppen = useMemo(() => {
    // `?? []` als doppelter Boden: Ein Rahmen aus einer älteren Fassung im
    // Gerät kennt das Feld nicht — und die Navigation hängt an jeder Seite.
    const rechte = rahmen.rechte ?? []
    if (!rechte.length) return BEREICHE
    return BEREICHE.map((b) => ({
      ...b,
      punkte: b.punkte.filter((p) => !p.recht || rechte.includes(p.recht)),
    })).filter((b) => b.punkte.length > 0)
  }, [rahmen.rechte])

  // Beim Seitenwechsel schließen — sonst bliebe das Blatt über der neuen Seite
  useEffect(() => {
    setOffenesBlatt(null)
    setOffeneGruppe(null)
  }, [pfad])

  // Klick daneben schließt das Menü; sonst bliebe es beim Weiterarbeiten offen
  useEffect(() => {
    if (!offeneGruppe) return
    const beiKlick = (e: MouseEvent) => {
      if (!leiste.current?.contains(e.target as Node)) setOffeneGruppe(null)
    }
    const beiTaste = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOffeneGruppe(null)
    }
    document.addEventListener('mousedown', beiKlick)
    window.addEventListener('keydown', beiTaste)
    return () => {
      document.removeEventListener('mousedown', beiKlick)
      window.removeEventListener('keydown', beiTaste)
    }
  }, [offeneGruppe])

  useEffect(() => {
    if (!offenesBlatt) return
    const beiTaste = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOffenesBlatt(null)
    }
    window.addEventListener('keydown', beiTaste)
    return () => window.removeEventListener('keydown', beiTaste)
  }, [offenesBlatt])

  // Auf der Anmeldeseite gibt es nichts zu navigieren
  if (pfad?.startsWith('/office/login') || pfad?.startsWith('/office/kein-zugang')) return null

  return (
    <>
      <nav className="buero-nav" aria-label="Büro" ref={leiste}>
        <Link
          href={UEBERSICHT.href}
          aria-current={istAktiv(pfad, UEBERSICHT.href) ? 'page' : undefined}
        >
          {UEBERSICHT.label}
        </Link>

        {gruppen.map((b) => {
          const offen = offeneGruppe === b.titel
          const drin = b.punkte.some((p) => istAktiv(pfad, p.href))
          return (
            <div
              key={b.titel}
              className="buero-nav-gruppe"
              /*
               * Aufklappen beim Drüberfahren, damit man am Rechner nicht erst
               * klicken muss — und trotzdem ein echter Knopf darunter, weil
               * Hovern auf einem Touchscreen und mit der Tastatur nichts tut.
               */
              onMouseEnter={() => setOffeneGruppe(b.titel)}
              onMouseLeave={() => setOffeneGruppe((v) => (v === b.titel ? null : v))}
            >
              <button
                type="button"
                className={offen ? 'offen' : undefined}
                aria-expanded={offen}
                aria-current={drin ? 'page' : undefined}
                onClick={() => setOffeneGruppe((v) => (v === b.titel ? null : b.titel))}
              >
                {b.titel}
                <svg viewBox="0 0 24 24" aria-hidden="true" className="buero-nav-pfeil">
                  <path d="m7 10 5 5 5-5" />
                </svg>
              </button>

              {offen && (
                <div className="buero-nav-menue" role="menu" aria-label={b.titel}>
                  {b.punkte.map((p) => (
                    <Link
                      key={p.href}
                      href={p.href}
                      role="menuitem"
                      aria-current={istAktiv(pfad, p.href) ? 'page' : undefined}
                      onClick={() => setOffeneGruppe(null)}
                    >
                      {p.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/*
       * Am Handy: Übersicht plus die vier Bereiche. Jeder Bereich öffnet sein
       * eigenes Blatt — zwei Griffe zu jedem Punkt, und beide unten, wo der
       * Daumen ohnehin liegt.
       *
       * Ein Bereich, in dem gerade nichts erlaubt ist, fällt weg statt leer
       * dazustehen: `gruppen` ist bereits gefiltert.
       *
       * Solange ein Blatt offen ist, trägt nur dieses die Markierung: Zwei
       * bronzene Punkte nebeneinander — „hier stehst du" und „das ist
       * aufgeklappt" — sind einer zu viel.
       */}
      <nav className="buero-tableiste" aria-label="Büro">
        <Link
          href={UEBERSICHT.href}
          className="buero-tab"
          aria-current={!offenesBlatt && istAktiv(pfad, UEBERSICHT.href) ? 'page' : undefined}
        >
          {Zeichen.uebersicht}
          <span>{UEBERSICHT.label}</span>
        </Link>

        {gruppen.map((b) => {
          const offen = offenesBlatt === b.titel
          const drin = b.punkte.some((p) => istAktiv(pfad, p.href))
          return (
            <button
              key={b.titel}
              type="button"
              className={`buero-tab${offen ? ' offen' : ''}`}
              aria-expanded={offen}
              aria-current={drin && !offenesBlatt ? 'page' : undefined}
              onClick={() => setOffenesBlatt((v) => (v === b.titel ? null : b.titel))}
            >
              {Zeichen[b.titel as keyof typeof Zeichen] ?? Zeichen.uebersicht}
              <span>{b.titel}</span>
            </button>
          )
        })}
      </nav>

      {offenesBlatt && (
        <>
          <button
            type="button"
            className="buero-blatt-grund"
            aria-label="Schließen"
            onClick={() => setOffenesBlatt(null)}
          />
          <div className="buero-blatt" role="dialog" aria-label={offenesBlatt}>
            <div className="buero-blatt-griff" />
            <h3>{offenesBlatt}</h3>
            <div className="buero-blatt-punkte">
              {(gruppen.find((b) => b.titel === offenesBlatt)?.punkte ?? []).map((p) => (
                <Link
                  key={p.href}
                  href={p.href}
                  aria-current={
                    p.href.startsWith('/office') && istAktiv(pfad, p.href) ? 'page' : undefined
                  }
                >
                  {p.label}
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  )
}
