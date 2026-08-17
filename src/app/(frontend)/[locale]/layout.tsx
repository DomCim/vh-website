import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import React from 'react'

import { Footer } from '../../../components/layout/Footer'
import { Header } from '../../../components/layout/Header'
import { CartProvider } from '../../../components/shop/CartProvider'
import { getMainCategories, getSiteSettings } from '../../../lib/data'
import { isLocale, t } from '../../../lib/i18n'
import { alternatesFor, BASE_URL, jsonLd } from '../../../lib/seo'

export const dynamic = 'force-dynamic'

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
    openGraph: {
      siteName: settings?.siteName || 'Vincent Hellmann',
      locale,
      type: 'website',
    },
  }
}

export default async function LocaleLayout({ children, params }: Args) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  const [categories, settings] = await Promise.all([
    getMainCategories(locale),
    getSiteSettings(locale),
  ])

  const dict = t(locale)

  const orgJsonLd = jsonLd({
    '@type': 'Organization',
    name: settings?.siteName || 'Vincent Hellmann',
    url: BASE_URL,
    logo: `${BASE_URL}/logo.png`,
    ...(settings?.contact?.phone && { telephone: settings.contact.phone }),
    ...(settings?.contact?.email && { email: settings.contact.email }),
    sameAs: [
      settings?.social?.facebook,
      settings?.social?.instagram,
      settings?.social?.youtube,
    ].filter(Boolean),
  })

  return (
    <html lang={locale}>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: orgJsonLd }}
        />
        <CartProvider>
          <Header locale={locale} categories={categories} dict={dict} />
          <main className="min-h-screen pt-20">{children}</main>
          <Footer locale={locale} settings={settings} dict={dict} />
        </CartProvider>
      </body>
    </html>
  )
}
