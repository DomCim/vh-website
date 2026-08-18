import type { Metadata, Viewport } from 'next'
import Link from 'next/link'
import React from 'react'

import { AbgleichLeiste } from '../../components/office/AbgleichLeiste'
import { Abmelden } from '../../components/office/Abmelden'
import { BestandAnbieter } from '../../components/office/BestandAnbieter'
import { BueroNavigation } from '../../components/office/BueroNavigation'
import { SitzungVerlaengern } from '../../components/office/SitzungVerlaengern'
import '../../styles/office.css'

export const metadata: Metadata = {
  title: 'Büro — Vincent Hellmann',
  applicationName: 'VH Büro',
  manifest: '/office-manifest.webmanifest',
  icons: { apple: '/office-icon-180.png' },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'VH Büro',
  },
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7f6f4' },
    { media: '(prefers-color-scheme: dark)', color: '#141416' },
  ],
}

/**
 * Eigene Oberfläche für den Geschäftsbetrieb — bewusst getrennt von der
 * Kundenseite und vom Payload-Admin. Als App installierbar, damit Vincent
 * Belege direkt in der Werkstatt abfotografieren kann.
 */
export default function BueroLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="buero">
        <SitzungVerlaengern />
        <BestandAnbieter />
        <AbgleichLeiste />
        <header className="buero-kopf">
          <Link href="/office" className="buero-marke">
            {/* Auf schmalen Geräten reicht das Kürzel — der volle Name
                bräuchte dort drei Zeilen. */}
            <span className="nur-breit">Vincent Hellmann </span>
            <span className="nur-schmal">VH </span>
            <span className="buero-marke-zusatz">Büro</span>
          </Link>
          <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
            {/* Am Handy steht der Verweis im Blatt hinter „Mehr" — oben wäre
                daneben kein Platz für Marke und Abmelden */}
            <Link href="/admin" className="buero-marker buero-nur-breit">
              Website-Verwaltung
            </Link>
            <Abmelden />
          </div>
        </header>
        <BueroNavigation />
        <main className="buero-inhalt">{children}</main>
      </body>
    </html>
  )
}
