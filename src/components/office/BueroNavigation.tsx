'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React, { useEffect, useState } from 'react'

/**
 * Navigation im Büro.
 *
 * Am Rechner die gewohnte Leiste oben. Am Handy eine Tableiste unten mit dem
 * täglichen Handwerkszeug — dort kommt der Daumen hin, ohne das Gerät
 * umzugreifen. Alles Weitere steht hinter „Mehr", nach Arbeitsbereichen
 * geordnet; dreizehn Punkte in einer seitlich scrollenden Leiste findet sonst
 * niemand.
 */

const ALLE = [
  { href: '/office', label: 'Übersicht' },
  { href: '/office/post', label: 'Postfach' },
  { href: '/office/anfragen', label: 'Anfragen' },
  { href: '/office/bestellungen', label: 'Bestellungen' },
  { href: '/office/angebote', label: 'Angebote' },
  { href: '/office/auftraege', label: 'Aufträge' },
  { href: '/office/rechnungen', label: 'Rechnungen' },
  { href: '/office/belege', label: 'Belege' },
  { href: '/office/artikel', label: 'Artikel' },
  { href: '/office/inventar', label: 'Inventar' },
  { href: '/office/inventur', label: 'Inventur' },
  { href: '/office/partner', label: 'Partner' },
  { href: '/office/steuer', label: 'Steuer' },
  { href: '/office/sicherung', label: 'Sicherung' },
  { href: '/office/einstellungen', label: 'Einstellungen' },
  { href: '/office/neuerungen', label: 'Neuerungen' },
]

/** Fürs Blatt nach Arbeitsbereichen sortiert — so sucht man auch im Kopf */
const BEREICHE: { titel: string; punkte: { href: string; label: string }[] }[] = [
  {
    titel: 'Kundschaft',
    punkte: [
      { href: '/office/post', label: 'Postfach' },
      { href: '/office/anfragen', label: 'Anfragen' },
      { href: '/office/bestellungen', label: 'Bestellungen' },
      { href: '/office/angebote', label: 'Angebote' },
    ],
  },
  {
    titel: 'Werkstatt',
    punkte: [
      { href: '/office/auftraege', label: 'Aufträge' },
      { href: '/office/artikel', label: 'Artikel' },
      { href: '/office/inventar', label: 'Inventar' },
      { href: '/office/inventur', label: 'Inventur' },
    ],
  },
  {
    titel: 'Geld',
    punkte: [
      { href: '/office/rechnungen', label: 'Rechnungen' },
      { href: '/office/belege', label: 'Belege' },
      { href: '/office/steuer', label: 'Steuer' },
      { href: '/office/partner', label: 'Partner' },
    ],
  },
  {
    titel: 'Sonstiges',
    punkte: [
      { href: '/office/sicherung', label: 'Sicherung' },
      { href: '/office/einstellungen', label: 'Einstellungen' },
      { href: '/office/neuerungen', label: 'Neuerungen' },
      { href: '/admin', label: 'Website-Verwaltung' },
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

  // Beim Seitenwechsel schließen — sonst bliebe das Blatt über der neuen Seite
  useEffect(() => {
    setBlattOffen(false)
  }, [pfad])

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
      <nav className="buero-nav" aria-label="Büro">
        {ALLE.map((p) => (
          <Link key={p.href} href={p.href} aria-current={istAktiv(pfad, p.href) ? 'page' : undefined}>
            {p.label}
          </Link>
        ))}
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
            {BEREICHE.map((b) => (
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
