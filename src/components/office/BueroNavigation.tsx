'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React, { useEffect, useMemo, useRef, useState } from 'react'

import { useRahmen } from '../../lib/buero/bestand'

/**
 * Navigation im Büro.
 *
 * Am Rechner vier Gruppen, die aufklappen. Am Handy eine Tableiste unten mit
 * dem täglichen Handwerkszeug — dort kommt der Daumen hin, ohne das Gerät
 * umzugreifen —, und alles Weitere hinter „Mehr".
 *
 * Beide zeigen dieselbe Ordnung nach Arbeitsbereichen. Achtzehn Punkte
 * nebeneinander findet niemand: Sie liefen seitlich aus dem Bild, und gesucht
 * wird ohnehin nicht alphabetisch, sondern nach „wo war das mit den
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
  post: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3.5 7 8.5 6 8.5-6" />
    </svg>
  ),
  auftraege: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 4h6v2.5H9z" />
      <path d="M6 6.5h12a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7.5a1 1 0 0 1 1-1z" />
      <path d="M8.5 12h7M8.5 15.5h4.5" />
    </svg>
  ),
  belege: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M15 3v4h4" />
      <path d="M9 12h6M9 16h4" />
    </svg>
  ),
  mehr: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="5.5" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="18.5" cy="12" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  ),
}

const TABS = [
  { href: '/office', label: 'Übersicht', zeichen: Zeichen.uebersicht },
  { href: '/office/post', label: 'Postfach', zeichen: Zeichen.post },
  { href: '/office/auftraege', label: 'Aufträge', zeichen: Zeichen.auftraege },
  { href: '/office/belege', label: 'Belege', zeichen: Zeichen.belege },
]

const istAktiv = (pfad: string | null, href: string) =>
  href === '/office' ? pfad === '/office' : Boolean(pfad?.startsWith(href))

export function BueroNavigation() {
  const pfad = usePathname()
  const [blattOffen, setBlattOffen] = useState(false)
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
    setBlattOffen(false)
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
    if (!blattOffen) return
    const beiTaste = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setBlattOffen(false)
    }
    window.addEventListener('keydown', beiTaste)
    return () => window.removeEventListener('keydown', beiTaste)
  }, [blattOffen])

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

      <nav className="buero-tableiste" aria-label="Büro">
        {TABS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="buero-tab"
            aria-current={istAktiv(pfad, t.href) ? 'page' : undefined}
          >
            {t.zeichen}
            <span>{t.label}</span>
          </Link>
        ))}
        <button
          type="button"
          className={`buero-tab${blattOffen ? ' offen' : ''}`}
          aria-expanded={blattOffen}
          onClick={() => setBlattOffen((v) => !v)}
        >
          {Zeichen.mehr}
          <span>Mehr</span>
        </button>
      </nav>

      {blattOffen && (
        <>
          <button
            type="button"
            className="buero-blatt-grund"
            aria-label="Schließen"
            onClick={() => setBlattOffen(false)}
          />
          <div className="buero-blatt" role="dialog" aria-label="Alle Bereiche">
            <div className="buero-blatt-griff" />
            {gruppen.map((b) => (
              <React.Fragment key={b.titel}>
                <h3>{b.titel}</h3>
                <div className="buero-blatt-punkte">
                  {b.punkte.map((p) => (
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
              </React.Fragment>
            ))}
          </div>
        </>
      )}
    </>
  )
}
