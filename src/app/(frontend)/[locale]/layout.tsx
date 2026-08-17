import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import React from 'react'

import { Footer } from '../../../components/layout/Footer'
import { Header } from '../../../components/layout/Header'
import { CartProvider } from '../../../components/shop/CartProvider'
import { getMainCategories, getSiteSettings } from '../../../lib/data'
import { isLocale, t } from '../../../lib/i18n'

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
    title: {
      default: title,
      template: `%s – ${settings?.siteName || 'Vincent Hellmann'}`,
    },
    description: settings?.seo?.metaDescription || undefined,
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

  return (
    <html lang={locale}>
      <body>
        <CartProvider>
          <Header locale={locale} categories={categories} dict={dict} />
          <main className="min-h-screen pt-20">{children}</main>
          <Footer locale={locale} settings={settings} dict={dict} />
        </CartProvider>
      </body>
    </html>
  )
}
