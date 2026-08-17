import { notFound } from 'next/navigation'
import React from 'react'

import { CheckoutForm } from '../../../../components/shop/CheckoutForm'
import { getSiteSettings, payloadClient } from '../../../../lib/data'
import { isLocale, t } from '../../../../lib/i18n'
import { paypalConfigured } from '../../../../lib/paypal'

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

  const payload = await payloadClient()
  const [paypalAvailable, settings] = await Promise.all([
    paypalConfigured(payload),
    getSiteSettings(locale),
  ])
  const vatRate = settings?.company?.vatRate ?? 20

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <h1 className="tracking-nav text-ink mb-8 text-2xl font-semibold uppercase">
        {dict.checkout.title}
      </h1>
      <CheckoutForm
        locale={locale}
        dict={dict.checkout}
        cartDict={dict.cart}
        initialCode={code}
        paypalAvailable={paypalAvailable}
        vatRate={vatRate}
      />
    </div>
  )
}
