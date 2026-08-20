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
      { href: '/office/uebergabe', label: 'Übergabemappen', recht: 'angebote.schreiben' },
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
      // Bewusst ohne Recht: Wer das Teil baut, braucht die Zeichnung — und
      // muss dafür keine Preise ändern dürfen.
      { href: '/office/unterlagen', label: 'Unterlagen' },
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

/*
 * Ein eigenes Zeichen für jeden Punkt, und die Farbe kommt vom Bereich.
 *
 * Achtzehn Punkte unterscheiden sich sonst nur durch ihr Wort, und Wörter
 * liest man — das kostet jedes Mal einen Moment. Mit Form **und** Farbe
 * erkennt man nach ein paar Tagen am Fleck, wo man hingreift: Blau ist
 * Kundschaft, Bronze ist Werkstatt, Grün ist Geld, Violett ist der Rest.
 *
 * Die Farbe allein täte es nicht (vier Farben sind schnell verwechselt), die
 * Form allein auch nicht (achtzehn Umrisse sind zu viele). Zusammen genügt
 * beides sich gegenseitig.
 */
const PUNKT_ZEICHEN: Record<string, React.ReactNode> = {
  '/office/post': (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3.5 7 8.5 6 8.5-6" />
    </>
  ),
  '/office/anfragen': (
    <>
      <path d="M20.5 12c0 4-3.8 7-8.5 7-1 0-2-.15-2.9-.42L4 20l1.5-3.4C4.25 15.3 3.5 13.7 3.5 12c0-4 3.8-7 8.5-7s8.5 3 8.5 7z" />
      <path d="M10.2 10.2a1.9 1.9 0 1 1 2.5 2.2c-.5.25-.7.6-.7 1.1M12 15.6h.01" />
    </>
  ),
  '/office/bestellungen': (
    <>
      <path d="M5.5 7.5h13l-1.2 11a1.5 1.5 0 0 1-1.5 1.3H8.2a1.5 1.5 0 0 1-1.5-1.3z" />
      <path d="M9 9.5V6.8a3 3 0 0 1 6 0V9.5" />
    </>
  ),
  '/office/angebote': (
    <>
      <path d="M6.5 3.5h7l4.5 4.5v12a1 1 0 0 1-1 1h-10.5a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1z" />
      <path d="M13.5 3.5V8H18" />
      <path d="M9 15.5h5M11.5 12.5v6" />
    </>
  ),
  /* Übergabemappen: eine Mappe mit Pfeilen — Unterlagen gehen hin und her */
  '/office/uebergabe': (
    <>
      <path d="M3.5 7.5a1 1 0 0 1 1-1h4l1.7 2h9.3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1z" />
      <path d="M9.5 13.5h5" />
      <path d="m12.5 11.5 2 2-2 2" />
    </>
  ),
  '/office/wiedervorlagen': (
    <>
      <path d="M18 9.5a6 6 0 0 0-12 0c0 5-2 6.5-2 6.5h16s-2-1.5-2-6.5z" />
      <path d="M13.7 19.5a2 2 0 0 1-3.4 0" />
    </>
  ),
  '/office/newsletter': (
    <>
      <path d="M21 4 3 10.8l6.4 2.4L21 4z" />
      <path d="M21 4 9.4 13.2l.9 6.3L14 15.4 21 4z" />
    </>
  ),
  '/office/auftraege': (
    <>
      <path d="M9 4h6v2.5H9z" />
      <path d="M6 6.5h12a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7.5a1 1 0 0 1 1-1z" />
      <path d="M8.5 12h7M8.5 15.5h4.5" />
    </>
  ),
  '/office/kalender': (
    <>
      <rect x="3.5" y="5.5" width="17" height="15" rx="2" />
      <path d="M3.5 10h17M8 3.5v4M16 3.5v4" />
    </>
  ),
  '/office/auslastung': (
    <>
      <path d="M4 20V4" />
      <path d="M7.5 20v-6M12 20V9M16.5 20v-9.5M21 20v-4" />
    </>
  ),
  '/office/artikel': (
    <>
      <path d="M12 3.2 20 7.6v8.8L12 20.8 4 16.4V7.6z" />
      <path d="M4 7.6 12 12l8-4.4M12 12v8.8" />
    </>
  ),
  '/office/inventar': (
    <>
      <rect x="3.5" y="4" width="7" height="7" rx="1" />
      <rect x="13.5" y="4" width="7" height="7" rx="1" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1" />
    </>
  ),
  '/office/nachbestellen': (
    <>
      <path d="M3.5 6h2.2l2.3 10.2h9.6" />
      <path d="M7.4 9h13l-1.6 5.4H8.6" />
      <circle cx="9.5" cy="19.2" r="1.3" />
      <circle cx="17.5" cy="19.2" r="1.3" />
    </>
  ),
  '/office/wareneingang': (
    <>
      <path d="M4 9.5h16v9.5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" />
      <path d="M4 9.5 6.5 5h11L20 9.5" />
      <path d="M12 12v4.5M9.7 14.3 12 16.6l2.3-2.3" />
    </>
  ),
  '/office/inventur': (
    <>
      <path d="M6 4.5h12a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5.5a1 1 0 0 1 1-1z" />
      <path d="m8 9.5 1.6 1.6L13 7.7M8 15.5h8" />
    </>
  ),
  '/office/unterlagen': (
    <>
      <path d="M3.5 7.5a1 1 0 0 1 1-1h4.2l2 2.5H19a1 1 0 0 1 1 1v8.5a1 1 0 0 1-1 1H4.5a1 1 0 0 1-1-1z" />
      <path d="M8.5 13.5h7" />
    </>
  ),
  '/office/rechnungen': (
    <>
      <path d="M6.5 3.5h7l4.5 4.5v12a1 1 0 0 1-1 1h-10.5a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1z" />
      <path d="M13.5 3.5V8H18" />
      <path d="M14 12.2a2.6 2.6 0 1 0 0 4.2M9.5 13.2h4M9.5 15.4h4" />
    </>
  ),
  '/office/zahlungen': (
    <>
      <rect x="2.8" y="6" width="18.4" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M6 12h.01M18 12h.01" />
    </>
  ),
  '/office/belege': (
    <>
      <path d="M6 3.5h12v17l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4-2 1.4z" />
      <path d="M9 8h6M9 11.5h6M9 15h4" />
    </>
  ),
  '/office/nachkalkulation': (
    <>
      <rect x="5" y="3.5" width="14" height="17" rx="2" />
      <path d="M8.5 7.5h7" />
      <path d="M9 11.5h.01M12 11.5h.01M15 11.5h.01M9 14.5h.01M12 14.5h.01M15 14.5h.01M9 17.5h.01M12 17.5h.01M15 17.5h.01" />
    </>
  ),
  '/office/steuer': (
    <>
      <path d="M3.5 20.5h17M5 20.5V9.5M19 20.5V9.5M9 20.5v-5h6v5" />
      <path d="M12 3.2 20.5 9h-17z" />
    </>
  ),
  '/office/partner': (
    <>
      <path d="M6.5 3.5h11a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1z" />
      <path d="M3.5 8h2.5M3.5 12h2.5M3.5 16h2.5" />
      <circle cx="12" cy="10" r="2.2" />
      <path d="M8.8 16.4c.4-1.7 1.7-2.6 3.2-2.6s2.8.9 3.2 2.6" />
    </>
  ),
  '/office/sicherung': (
    <>
      <ellipse cx="12" cy="6.5" rx="7" ry="2.8" />
      <path d="M5 6.5v11c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8v-11" />
      <path d="M5 12c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8" />
    </>
  ),
  '/office/einstellungen': (
    <>
      <path d="M4 7.5h9M17.5 7.5H20M4 16.5h4.5M13 16.5H20" />
      <circle cx="15" cy="7.5" r="2.3" />
      <circle cx="10.5" cy="16.5" r="2.3" />
    </>
  ),
  '/office/neuerungen': (
    <>
      <path d="M12 3.5 13.9 9l5.6.3-4.4 3.5 1.5 5.4L12 15.1l-4.6 3.1L8.9 12.8 4.5 9.3 10.1 9z" />
    </>
  ),
  '/admin': (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.2 2.4 3.3 5.3 3.3 8.5S14.2 18.1 12 20.5c-2.2-2.4-3.3-5.3-3.3-8.5S9.8 5.9 12 3.5z" />
    </>
  ),
}

/** Aus „Kundschaft" wird `bereich-kundschaft` — die Farbe steht im Stylesheet */
const bereichsKlasse = (titel: string) =>
  'bereich-' +
  titel
    .toLowerCase()
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/ß/g, 'ss')

function PunktZeichen({ href }: { href: string }) {
  const inhalt = PUNKT_ZEICHEN[href]
  if (!inhalt) return null
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="buero-punkt-zeichen">
      {inhalt}
    </svg>
  )
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
                <div
                  className={`buero-nav-menue ${bereichsKlasse(b.titel)}`}
                  role="menu"
                  aria-label={b.titel}
                >
                  {b.punkte.map((p) => (
                    <Link
                      key={p.href}
                      href={p.href}
                      role="menuitem"
                      aria-current={istAktiv(pfad, p.href) ? 'page' : undefined}
                      onClick={() => setOffeneGruppe(null)}
                    >
                      <PunktZeichen href={p.href} />
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
              className={`buero-tab ${bereichsKlasse(b.titel)}${offen ? ' offen' : ''}`}
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
          <div
            className={`buero-blatt ${bereichsKlasse(offenesBlatt)}`}
            role="dialog"
            aria-label={offenesBlatt}
          >
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
                  <PunktZeichen href={p.href} />
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
