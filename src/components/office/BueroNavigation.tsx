'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const PUNKTE = [
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
  { href: '/office/einstellungen', label: 'Einstellungen' },
]

export function BueroNavigation() {
  const pfad = usePathname()

  // Auf der Anmeldeseite gibt es nichts zu navigieren
  if (pfad?.startsWith('/office/login') || pfad?.startsWith('/office/kein-zugang')) return null

  return (
    <nav className="buero-nav" aria-label="Büro">
      {PUNKTE.map((p) => {
        const aktiv = p.href === '/office' ? pfad === '/office' : pfad?.startsWith(p.href)
        return (
          <Link key={p.href} href={p.href} aria-current={aktiv ? 'page' : undefined}>
            {p.label}
          </Link>
        )
      })}
    </nav>
  )
}
