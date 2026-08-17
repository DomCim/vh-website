import { notFound } from 'next/navigation'
import React from 'react'

import { CheckoutForm } from '../../../../components/shop/CheckoutForm'
import { isLocale, t } from '../../../../lib/i18n'

export const dynamic = 'force-dynamic'

export default async function CheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ code?: string }>
}) {
  const { locale } = await params
  const { code } = await searchParams
  if (!isLocale(locale)) notFound()
  const dict = t(locale)

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <h1 className="tracking-nav text-ink mb-8 text-2xl font-semibold uppercase">
        {dict.checkout.title}
      </h1>
      <CheckoutForm locale={locale} dict={dict.checkout} cartDict={dict.cart} initialCode={code} />
    </div>
  )
}
