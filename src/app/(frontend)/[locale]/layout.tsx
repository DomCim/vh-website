import type { Metadata, Viewport } from 'next'
import { notFound } from 'next/navigation'
import React from 'react'

import { Footer } from '../../../components/layout/Footer'
import { Header } from '../../../components/layout/Header'
import { NachOben } from '../../../components/layout/NachOben'
import { SmoothScroll } from '../../../components/motion/SmoothScroll'
import { CartProvider } from '../../../components/shop/CartProvider'
import { getMainCategories, getSiteSettings, payloadClient } from '../../../lib/data'
import { oeffentlicheTermine } from '../../../lib/kalender/oeffentlich'
import { isLocale, t } from '../../../lib/i18n'
import { alternatesFor, BASE_URL, localBusinessJsonLd } from '../../../lib/seo'

export const dynamic = 'force-dynamic'

/**
 * Die Adressleiste des Browsers zieht mit dem Thema mit.
 *
 * Ohne das steht am Handy über einer dunklen Seite ein weißer Balken — der
 * auffälligste Fehler an einem dunklen Thema, weil er genau dort sitzt, wo
 * man beim Scrollen hinschaut.
 */
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#131315' },
  ],
}

type Args = {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const settings = await getSiteSettings(locale)
  const title = settings?.seo?.metaTitle || settings?.siteName || 'Vincent Hellmann'
  return {
    metadataBase: new URL(BASE_URL),
    title: {
      default: title,
      template: `%s – ${settings?.siteName || 'Vincent Hellmann'}`,
    },
    description: settings?.seo?.metaDescription || undefined,
    alternates: alternatesFor(locale, ''),
    /*
     * Das Zeichen fürs Browsertab.
     *
     * Die Website hatte keines — im Tab stand die graue Weltkugel, und auf
     * dem Startbildschirm eines iPhones ein Bildschirmfoto der Seite. Admin
     * und Büro hatten längst eigene; ausgerechnet das, was Kundschaft zu
     * sehen bekommt, hatte keins.
     *
     * Vier Fassungen, weil jede woanders gebraucht wird: das SVG ist in
     * jeder Größe scharf und wird von allem Aktuellen bevorzugt, das PNG ist
     * der Rückfall für ältere Browser, die `.ico` bedient alles, was stur
     * `/favicon.ico` an der Wurzel abfragt (Feedleser, Vorschaudienste), und
     * das Apple-Touch-Icon landet auf dem Startbildschirm.
     */
    icons: {
      icon: [
        { url: '/site-icon.svg', type: 'image/svg+xml' },
        { url: '/site-icon-32.png', type: 'image/png', sizes: '32x32' },
        { url: '/favicon.ico', sizes: '16x16 32x32 48x48' },
      ],
      apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
    },
    openGraph: {
      siteName: settings?.siteName || 'Vincent Hellmann',
      locale,
      type: 'website',
    },
    /*
     * Die Nachweise, dass die Seite uns gehört.
     *
     * Pinterest, Google und Bing wollen das je einmal wissen und bieten dafür
     * ein Meta-Tag an. Sie stehen in einer Zeile, weil `other` genau einmal
     * gesetzt werden darf — zwei Angaben nacheinander überschrieben einander,
     * und der zweite Dienst fände seinen Nachweis nie.
     */
    ...((settings?.pinterestVerification ||
      settings?.googleVerification ||
      settings?.bingVerification) && {
      other: {
        ...(settings?.pinterestVerification && {
          'p:domain_verify': settings.pinterestVerification,
        }),
        ...(settings?.googleVerification && {
          'google-site-verification': settings.googleVerification,
        }),
        ...(settings?.bingVerification && { 'msvalidate.01': settings.bingVerification }),
      },
    }),
  }
}

export default async function LocaleLayout({ children, params }: Args) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  const [categories, settings, termine] = await Promise.all([
    getMainCategories(locale),
    getSiteSettings(locale),
    /*
     * Nur die Frage, ob es ueberhaupt einen gibt — der Menuepunkt haengt
     * daran. Einer genuegt dafuer, also wird auch nur einer geholt.
     */
    payloadClient().then((p) => oeffentlicheTermine(p, locale, 1)),
  ])

  const dict = t(locale)

  // Die Werkstatt als LocalBusiness — Marke, Betrieb dahinter und Anschrift
  const orgJsonLd = localBusinessJsonLd(settings)

  return (
    <html lang={locale}>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: orgJsonLd }}
        />
        {/*
          * Besucherzählung — cookiefrei, deshalb ohne Banner.
          *
          * Der Normalfall ist die eigene Zählung: Skript und Zähladresse
          * liegen auf dieser Domain (`/js/zaehler.js` und `/api/zaehler`) und
          * reichen nach innen weiter an das selbst betriebene Plausible. Für
          * den Besucher ist das eine Datei von dieser Website wie jede
          * andere — kein fremder Server, keine Ausnahme in der
          * Sicherheitsrichtlinie, und kein Werbeblocker, der sie an ihrem
          * Namen erkennt.
          *
          * `data-api` muss dabeistehen: Ohne die Angabe schickt das Skript
          * seine Meldungen dorthin, woher es geladen wurde — und das ist
          * hier nicht die Statistik, sondern die Website.
          *
          * Der Ausweichweg darunter bleibt für eine Statistik außerhalb
          * dieses Servers. Beide gleichzeitig ergäbe doppelte Zählung, also
          * gewinnt die eigene.
          */}
        {settings?.analytics?.eigeneZaehlung && settings.analytics.domain ? (
          <script
            defer
            src="/js/zaehler.js"
            data-domain={settings.analytics.domain}
            data-api="/api/zaehler"
          />
        ) : settings?.analytics?.scriptUrl ? (
          <script
            defer
            src={settings.analytics.scriptUrl}
            {...(settings.analytics.domain ? { 'data-domain': settings.analytics.domain } : {})}
          />
        ) : null}
        <CartProvider>
          <SmoothScroll />
          <Header
            locale={locale}
            categories={categories}
            dict={dict}
            termineVorhanden={termine.length > 0}
          />
          <main className="min-h-screen pt-20">{children}</main>
          <Footer locale={locale} settings={settings} dict={dict} />
          <NachOben beschriftung={dict.nav.nachOben} />
        </CartProvider>
      </body>
    </html>
  )
}
