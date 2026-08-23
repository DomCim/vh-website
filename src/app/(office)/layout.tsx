import type { Metadata, Viewport } from 'next'
import Link from 'next/link'
import React from 'react'

import { AbgleichLeiste } from '../../components/office/AbgleichLeiste'
import { Abgleichpunkt } from '../../components/office/Abgleichpunkt'
import { AdminVerweis } from '../../components/office/AdminVerweis'
import { Abmelden } from '../../components/office/Abmelden'
import { BestandAnbieter } from '../../components/office/BestandAnbieter'
import { BueroNavigation } from '../../components/office/BueroNavigation'
import { Haptik } from '../../components/office/Haptik'
import { Kopftitel } from '../../components/office/Kopftitel'
import { Meldungsglocke } from '../../components/office/Meldungsglocke'
import { NeuerungenBanner } from '../../components/office/NeuerungenBanner'
import { Scrollstart } from '../../components/office/Scrollstart'
import { SitzungVerlaengern } from '../../components/office/SitzungVerlaengern'
import { Tastaturwache } from '../../components/office/Tastaturwache'
import { ZiehenAktualisieren } from '../../components/office/ZiehenAktualisieren'
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
    { media: '(prefers-color-scheme: light)', color: '#f4f2ef' },
    { media: '(prefers-color-scheme: dark)', color: '#111113' },
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
        <Scrollstart />
        <Haptik />
        <ZiehenAktualisieren />
        <SitzungVerlaengern />
        <Tastaturwache />
        <BestandAnbieter />
        <AbgleichLeiste />
        {/*
          * Die Kopfleiste sagt am Handy, wo man ist — am Rechner, wo man ist.
          *
          * Dort trägt sie den Schriftzug: Der Bildschirm ist breit genug, und
          * die Navigation steht ohnehin darunter. Am Handy ist der Platz zu
          * knapp für Zierde — der Schriftzug verlinkte zur Übersicht, die
          * unten der erste Tab ist, und „Abmelden" braucht man selten. Statt
          * dessen steht dort der Name der offenen Seite (`Kopftitel`), und
          * „Abmelden" ist ins Blatt „Sonstiges" gewandert.
          */}
        <header className="buero-kopf">
          <Link href="/office" className="buero-marke buero-nur-breit">
            {/* Auf schmalen Geräten reicht das Kürzel — der volle Name
                bräuchte dort drei Zeilen. */}
            <span className="nur-breit">Vincent Hellmann </span>
            <span className="nur-schmal">VH </span>
            <span className="buero-marke-zusatz">Büro</span>
          </Link>
          <Kopftitel />
          <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
            {/* Die Glocke steht vor dem Punkt: Sie will etwas, er sagt nur, wie
                der Stand ist. Beide sind schmal genug, dass am Handy der Name
                der Seite daneben passt — der schrumpft mit. */}
            <Meldungsglocke />
            <Abgleichpunkt />
            {/* Beide nur am Rechner: Am Handy stehen sie im Blatt „Sonstiges" */}
            <AdminVerweis />
            <span className="buero-nur-breit">
              <Abmelden />
            </span>
          </div>
        </header>
        <BueroNavigation />
        {/* Steht zwischen Navigation und Inhalt: gesehen wird er, im Weg ist er nicht */}
        <NeuerungenBanner />
        <main className="buero-inhalt">{children}</main>
      </body>
    </html>
  )
}
