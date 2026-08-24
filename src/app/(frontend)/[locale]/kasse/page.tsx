import { notFound } from 'next/navigation'
import React from 'react'

import { CheckoutForm } from '../../../../components/shop/CheckoutForm'
import { getSiteSettings, payloadClient } from '../../../../lib/data'
import { isLocale, t } from '../../../../lib/i18n'
import { paypalConfigured } from '../../../../lib/paypal'
import { landName, versandzonen } from '../../../../lib/versand'

export const dynamic = 'force-dynamic'

/*
 * Gehört nicht in den Index — und braucht deshalb eine eigene Angabe.
 *
 * Die Kasse ist ein Formular mitten im Kaufvorgang. Wer über eine
 * Suchmaschine hier hereinkommt, steht ohne Warenkorb davor.
 *
 * `follow: true`, damit den Verweisen von hier trotzdem gefolgt wird: Der
 * Warenkorb verlinkt zurück in den Laden, und diese Wege sollen nicht
 * abreißen. Ohne eigene Angabe erbte die Seite die des Layouts und erklärte
 * sich zur Startseite (`rel=canonical` auf `/de`) — drei Sprachen, dieselbe
 * dünne Seite, und Google entscheidet selbst, was davon zählt.
 */
export const metadata = { robots: { index: false, follow: true } }

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
  const [paypalAvailable, settings, zonen] = await Promise.all([
    paypalConfigured(payload),
    getSiteSettings(locale),
    versandzonen(payload),
  ])
  const vatRate = settings?.company?.vatRate ?? 20

  /*
   * Die Länderauswahl entsteht hier und nicht im Browser: Die Zonen stehen in
   * der Verwaltung, und die Kasse soll den Aufschlag schon beim Umstellen
   * zeigen — ohne dafür eine zweite Anfrage zu stellen. Gerechnet wird beim
   * Abschicken trotzdem noch einmal auf dem Server.
   */
  const laender = zonen.flatMap((z) =>
    z.laender.map((code) => ({
      code,
      name: landName(code, locale),
      aufschlag: z.aufschlag,
      hinweis: z.hinweis,
    })),
  )

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <h1 className="tracking-nav text-ink mb-8 text-2xl font-semibold uppercase">
        {dict.checkout.title}
      </h1>
      <CheckoutForm
        locale={locale}
        dict={dict.checkout}
        cartDict={dict.cart}
        downloadDict={dict.downloads}
        initialCode={code}
        paypalAvailable={paypalAvailable}
        vatRate={vatRate}
        laender={laender}
      />
    </div>
  )
}
