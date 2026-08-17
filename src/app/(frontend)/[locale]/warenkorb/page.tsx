import { notFound } from 'next/navigation'
import React from 'react'

import { CartView } from '../../../../components/shop/CartView'
import { isLocale, t } from '../../../../lib/i18n'

export const dynamic = 'force-dynamic'

export default async function CartPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const dict = t(locale)

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <h1 className="tracking-nav text-ink mb-8 text-2xl font-semibold uppercase">
        {dict.cart.title}
      </h1>
      <CartView locale={locale} dict={dict.cart} />
    </div>
  )
}
