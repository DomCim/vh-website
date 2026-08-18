'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const PUNKTE = [
  { href: '/office', label: 'Übersicht' },
  { href: '/office/belege', label: 'Belege' },
  { href: '/office/rechnungen', label: 'Rechnungen' },
  { href: '/office/inventar', label: 'Inventar' },
  { href: '/office/inventur', label: 'Inventur' },
  { href: '/office/steuer', label: 'Steuer' },
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
