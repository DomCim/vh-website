import Link from 'next/link'
import { notFound } from 'next/navigation'
import React from 'react'

import { Reveal } from '../../../../../components/motion/Reveal'
import { GoogleBewertung } from '../../../../../components/shop/GoogleBewertung'
import { payloadClient } from '../../../../../lib/data'
import { bewertungsDaten } from '../../../../../lib/googleBewertung'
import { isLocale, t } from '../../../../../lib/i18n'
import { markOrderPaid } from '../../../../../lib/orderHooks'
import { capturePayPalOrder, paypalConfig } from '../../../../../lib/paypal'

export const dynamic = 'force-dynamic'

/**
 * Rückkehr von PayPal: Zahlung server-seitig einziehen und Bestellung
 * abschließen. Gibt die Bestellung zurück — die Seite braucht sie für die
 * Frage nach der Bewertung (Bestellnummer, Adresse, Lieferland).
 */
async function capturePayPalIfPresent(paypalToken?: string) {
  if (!paypalToken) return null
  try {
    const payload = await payloadClient()
    const cfg = await paypalConfig(payload)
    if (!cfg) return null
    const { docs } = await payload.find({
      collection: 'orders',
      where: { paypalOrderId: { equals: paypalToken } },
      overrideAccess: true,
      limit: 1,
      depth: 0,
    })
    const order = docs[0]
    if (!order) return null
    if (order.status !== 'pending') return order
    const result = await capturePayPalOrder(cfg, paypalToken)
    if (result.status === 'COMPLETED') {
      // Lieferadresse aus PayPal übernehmen, falls noch keine an der Bestellung steht
      if (result.shipping?.line1 && !order.shippingAddress?.line1) {
        await payload.update({
          collection: 'orders',
          id: order.id,
          overrideAccess: true,
          context: { skipShippedMail: true },
          data: {
            shippingAddress: {
              line1: result.shipping.line1,
              line2: result.shipping.line2,
              postalCode: result.shipping.postalCode,
              city: result.shipping.city,
              country: result.shipping.countryCode,
            },
          },
        })
      }
      await markOrderPaid(payload, order.id, { paypalCaptureId: result.captureId })
    }
    return order
  } catch (err) {
    console.error('PayPal-Capture fehlgeschlagen:', err)
    return null
  }
}

export default async function ThankYouPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ token?: string }>
}) {
  const { locale } = await params
  const { token } = await searchParams
  if (!isLocale(locale)) notFound()
  const dict = t(locale)

  const bestellung = await capturePayPalIfPresent(token)

  /*
   * Die Frage nach der Bewertung — nur, wenn im Büro eine Händler-ID steht
   * und die Bestellung bekannt ist. Ohne beides bleibt die Seite so, wie sie
   * war, und im Browser wird nichts von Google geladen.
   */
  const bewertung = bestellung
    ? await bewertungsDaten(await payloadClient(), bestellung as never)
    : null

  return (
    <div className="mx-auto max-w-2xl px-4 py-24 text-center sm:px-6">
      <Reveal>
        <div className="bg-ink mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-full text-2xl text-on-ink">
          ✓
        </div>
        <h1 className="tracking-nav text-ink text-2xl font-semibold uppercase">
          {dict.thanks.title}
        </h1>
        <p className="text-ink-soft mt-4 leading-relaxed">{dict.thanks.text}</p>
        <Link
          href={`/${locale}`}
          className="bg-ink tracking-nav hover:bg-bronze mt-8 inline-block px-8 py-3 text-xs font-semibold text-on-ink uppercase transition-colors"
        >
          {dict.thanks.backHome}
        </Link>
      </Reveal>

      {bewertung && (
        <GoogleBewertung
          daten={bewertung}
          labels={{
            title: dict.thanks.reviewTitle,
            text: dict.thanks.reviewText,
            button: dict.thanks.reviewButton,
            loading: dict.thanks.reviewLoading,
            error: dict.thanks.reviewError,
          }}
        />
      )}
    </div>
  )
}
